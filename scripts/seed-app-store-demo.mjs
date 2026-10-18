import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(repoRoot, 'backend/supabase/fixtures/app-store-demo.sql');
const legalVersionsPath = resolve(repoRoot, 'apps/mobile-expo/src/lib/legal-versions.ts');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const SCREENSHOT_EMAIL = 'app-store-demo@fieldsoli.local';
const SCREENSHOT_PASSWORD = 'LocalDemoOnly!2026';
const SCREENSHOT_JOB_COUNT = 13;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result;
}

function parseEnvOutput(output) {
  const values = new Map();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }

  return values;
}

function readLegalVersion(name) {
  const source = readFileSync(legalVersionsPath, 'utf8');
  const match = source.match(new RegExp(`export const ${name} = ['\"]([^'\"]+)['\"]`));
  if (!match) {
    throw new Error(`Could not find ${name} in ${legalVersionsPath}.`);
  }
  return match[1];
}

function assertLocalApiUrl(apiUrl) {
  let host;
  try {
    host = new URL(apiUrl).hostname;
  } catch {
    throw new Error('Supabase returned an invalid API URL.');
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Refusing to seed a non-local Supabase project (${host}).`);
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  if (!response.ok) {
    const detail =
      body && typeof body === 'object'
        ? body.msg ?? body.message ?? body.error_description ?? JSON.stringify(body)
        : raw;
    throw new Error(`Local Supabase request failed (${response.status}): ${detail || 'unknown error'}`);
  }
  return body;
}

async function main() {
  console.log('Preparing the local Supabase stack and Expo environment...');
  run(npmCommand, ['run', 'local:setup'], { stdio: 'inherit' });

  console.log('Resetting the local database from migrations...');
  run(npxCommand, ['supabase', 'db', 'reset', '--local', '--workdir', 'backend'], {
    stdio: 'inherit',
  });

  const status = run(npxCommand, ['supabase', 'status', '--workdir', 'backend', '--output', 'env']);
  const values = parseEnvOutput(status.stdout);
  const apiUrl = values.get('API_URL');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  const publishableKey = values.get('PUBLISHABLE_KEY') ?? values.get('ANON_KEY');

  if (!apiUrl || !serviceRoleKey || !publishableKey) {
    throw new Error('Local Supabase status did not include API_URL, SERVICE_ROLE_KEY, and a publishable key.');
  }
  assertLocalApiUrl(apiUrl);

  console.log('Creating the local App Store screenshot account...');
  const user = await requestJson(new URL('/auth/v1/admin/users', apiUrl), {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: SCREENSHOT_EMAIL,
      password: SCREENSHOT_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Alex', last_name: 'Carter' },
    }),
  });

  if (!user || typeof user.id !== 'string') {
    throw new Error('Local Supabase did not return an id for the screenshot account.');
  }

  const privacyVersion = readLegalVersion('REQUIRED_PRIVACY_VERSION');
  const termsVersion = readLegalVersion('REQUIRED_TERMS_VERSION');
  console.log('Seeding fictional business settings, jobs, sessions, notes, and costs...');
  run(
    'psql',
    [
      '-h',
      '127.0.0.1',
      '-p',
      '54322',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'demo_user_id=' + user.id,
      '-v',
      'privacy_version=' + privacyVersion,
      '-v',
      'terms_version=' + termsVersion,
      '-f',
      fixturePath,
    ],
    { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'inherit' },
  );

  console.log('Verifying the normal authenticated API can read the fixture...');
  const token = await requestJson(new URL('/auth/v1/token?grant_type=password', apiUrl), {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: SCREENSHOT_EMAIL, password: SCREENSHOT_PASSWORD }),
  });
  if (!token || typeof token.access_token !== 'string') {
    throw new Error('Local Supabase did not return a session for the screenshot account.');
  }

  const jobs = await requestJson(
    new URL('/rest/v1/jobs?select=id,short_description,job_work_status&order=list_recency_at.desc', apiUrl),
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  );
  const activeSessionCount = Array.isArray(jobs)
    ? jobs.filter((job) => job?.job_work_status === 'in_progress').length
    : 0;
  if (!Array.isArray(jobs) || jobs.length !== SCREENSHOT_JOB_COUNT || activeSessionCount !== 1) {
    throw new Error(
      `Authenticated fixture verification expected ${SCREENSHOT_JOB_COUNT} visible jobs with one in-progress job.`,
    );
  }

  const settings = await requestJson(
    new URL('/rest/v1/business_settings?select=*', apiUrl),
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token.access_token}`,
      },
    },
  );
  const business = Array.isArray(settings) && settings.length === 1 ? settings[0] : null;
  if (
    business?.user_id !== user.id
    || business.business_name !== 'Carter Home Services'
    || !business.address || !business.phone || !business.email || !business.website || !business.license
    || business.material_markup_bps !== 2000
    || business.tax_rate_bps !== 825
    || JSON.stringify(business.taxable_categories) !== JSON.stringify(['materials'])
    || business.payment_terms !== 'net_15'
    || business.estimate_expiration_days !== 30
  ) {
    throw new Error('Authenticated fixture verification expected complete business information and invoice defaults.');
  }

  console.log('\nApp Store fixture is ready (local only).');
  console.log(`Sign in with ${SCREENSHOT_EMAIL}`);
  console.log(`Password: ${SCREENSHOT_PASSWORD}`);
  console.log('Run `npm run mobile`, open the iOS Simulator, and capture the desired screens.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
