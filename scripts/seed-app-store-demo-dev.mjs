import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnvFile } from 'node:process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEV_PROJECT_REF = 'anypejjoovlatmrkrxvx';
export const DEV_API_URL = `https://${DEV_PROJECT_REF}.supabase.co`;
export const DEMO_EMAIL = 'app-store-demo@fieldsoli.example';
const FIXTURE_MARKER = 'screenshots-dev-v1';
const credentialsPath = resolve(repoRoot, '.env.screenshots-dev.local');
const mobileEnvPath = resolve(repoRoot, 'apps/mobile-expo/.env.local');

const literal = (value) => "'" + value.replaceAll("'", "''") + "'";

export function assertDevProject(project) {
  if (project?.id !== DEV_PROJECT_REF || project?.status !== 'ACTIVE_HEALTHY') {
    throw new Error(`Refusing to seed: expected healthy Dev project ${DEV_PROJECT_REF}.`);
  }
}

export function buildResetSql(userId, privacyVersion, termsVersion, fixture) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid demo user id.');
  }
  const values = { demo_user_id: userId, privacy_version: privacyVersion, terms_version: termsVersion };
  let body = fixture.replace(/^\\set ON_ERROR_STOP on\s*$/m, '')
    .replace(/^begin;\s*$/m, '').replace(/^commit;\s*$/m, '');
  body = body.replace(/:'(demo_user_id|privacy_version|terms_version)'/g, (_, name) => literal(values[name]))
    .replaceAll("'local_app_store_fixture'", "'hosted_dev_screenshot_fixture'");
  if (/^\\|:'\w+'/m.test(body)) throw new Error('Unsupported fixture psql syntax.');
  const ids = [...new Set(fixture.match(/[1-4]b57c0a1-0000-4000-8000-\d{12}/g))];
  if (ids.length !== 53) throw new Error('Fixture identities changed; review hosted reset collision checks.');

  return `begin;
set local standard_conforming_strings = on;
set local lock_timeout = '10s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtextextended('screenshots-dev-v1', 0));
set constraints jobs_revenue_document_owner_job_fkey deferred;
-- Recheck the reserved account inside the same transaction as the reset.
do $guard$
begin
  perform 1 from auth.users
  where id = ${literal(userId)}::uuid and email = ${literal(DEMO_EMAIL)}
    and raw_app_meta_data ->> 'fieldsoli_fixture' = ${literal(FIXTURE_MARKER)}
  for update;
  if not found then raise exception 'Reserved Dev demo account does not match'; end if;
  if exists (select 1 from public.attachments where user_id = ${literal(userId)}::uuid) then
    raise exception 'Remove demo attachments through the app before resetting, to avoid orphaning Storage files';
  end if;
end;
$guard$;
-- Fixed fixture ids must never overwrite or delete another developer's rows.
do $collision$
declare
  table_name text;
  has_collision boolean;
begin
  foreach table_name in array array['jobs', 'sessions', 'job_costs', 'notes'] loop
    execute format('select exists (select 1 from public.%I where id = any($1) and user_id is distinct from $2)', table_name)
      into has_collision using array[${ids.map(literal).join(',')}]::uuid[], ${literal(userId)}::uuid;
    if has_collision then raise exception 'Fixture id collision in %', table_name; end if;
  end loop;
end;
$collision$;
-- Keep Auth identity and export requests/files; only replace the demo app dataset.
${['notes', 'job_costs', 'sessions', 'job_activity_events', 'financial_documents',
    'jobs', 'customers', 'financial_document_counters', 'business_settings', 'legal_acceptances']
    .map((table) => `delete from public.${table} where user_id = ${literal(userId)}::uuid;`).join('\n')}
${body}
commit;`;
}

export async function resetDevDemo({ token, password, fetchImpl = fetch, log = console.log }) {
  if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN in .env.screenshots-dev.local (see .env.screenshots-dev.example).');
  if (!password || password.length < 16 || password === 'LocalDemoOnly!2026') {
    throw new Error('DEV_SCREENSHOT_PASSWORD must be a separate password with at least 16 characters.');
  }
  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) {
      // Never echo API bodies: Auth responses can contain passwords, keys, or sessions.
      throw new Error(`Supabase ${new URL(url).pathname} failed (HTTP ${response.status}). No response secrets were logged.`);
    }
    return response.status === 204 ? null : response.json();
  }
  function management(path, body) {
    return request(`https://api.supabase.com/v1/projects/${DEV_PROJECT_REF}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const query = (sql) => management('/database/query', { query: sql });
  assertDevProject(await management(''));
  const fixture = readFileSync(resolve(repoRoot, 'backend/supabase/fixtures/app-store-demo.sql'), 'utf8');
  const legal = readFileSync(resolve(repoRoot, 'apps/mobile-expo/src/lib/legal-versions.ts'), 'utf8');
  const version = (name) => {
    const match = legal.match(new RegExp(`export const ${name} = ['"]([^'"]+)['"]`));
    if (!match) throw new Error(`Missing legal version: ${name}`);
    return match[1];
  };
  const privacy = version('REQUIRED_PRIVACY_VERSION');
  const terms = version('REQUIRED_TERMS_VERSION');
  const applied = await query('select version from supabase_migrations.schema_migrations');
  const pending = readdirSync(resolve(repoRoot, 'backend/supabase/migrations'))
    .filter((name) => name.endsWith('.sql') && !applied.some((row) => row.version === name.slice(0, 14)));
  if (pending.length) throw new Error(`Apply pending Dev migrations first: ${pending.join(', ')}`);

  const keys = await management('/api-keys?reveal=true');
  const adminKey = keys.find((key) => key.type === 'secret')?.api_key
    ?? keys.find((key) => key.name === 'service_role')?.api_key;
  const publicKey = keys.find((key) => key.type === 'publishable')?.api_key
    ?? keys.find((key) => key.name === 'anon')?.api_key;
  if (!adminKey || !publicKey) throw new Error('Dev API keys unavailable; token needs permission to read API keys and secrets.');
  const adminHeaders = { apikey: adminKey, 'Content-Type': 'application/json',
    ...(adminKey.startsWith('eyJ') ? { Authorization: `Bearer ${adminKey}` } : {}) };
  const users = await query(`select id, raw_app_meta_data ->> 'fieldsoli_fixture' as fixture
    from auth.users where email = ${literal(DEMO_EMAIL)}`);
  if (users.length > 1 || (users[0] && users[0].fixture !== FIXTURE_MARKER)) {
    throw new Error('Reserved demo email belongs to an unmarked account; refusing to modify it.');
  }
  let userId = users[0]?.id;
  // Validate fixture rendering before creating an account or deleting any rows.
  buildResetSql(userId ?? '00000000-0000-4000-8000-000000000000', privacy, terms, fixture);
  if (!userId) {
    const created = await request(`${DEV_API_URL}/auth/v1/admin/users`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ email: DEMO_EMAIL, password, email_confirm: true,
        app_metadata: { fieldsoli_fixture: FIXTURE_MARKER },
        user_metadata: { first_name: 'Alex', last_name: 'Carter' } }),
    });
    userId = created.id;
    log('Created the reserved Dev demo account.');
  }
  // Verify the existing password before resetting. Never silently rotate it.
  const session = await request(`${DEV_API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password }),
  });
  if (session.user?.id !== userId || !session.access_token) throw new Error('Demo sign-in did not match the reserved account.');
  try {
    log(`Resetting demo data on Dev (${DEV_PROJECT_REF})...`);
    await query(buildResetSql(userId, privacy, terms, fixture));
    const headers = { apikey: publicKey, Authorization: `Bearer ${session.access_token}` };
    const jobs = await request(`${DEV_API_URL}/rest/v1/jobs?select=id,job_work_status`, { headers });
    const settings = await request(`${DEV_API_URL}/rest/v1/business_settings?select=*`, { headers });
    const business = settings.length === 1 ? settings[0] : null;
    if (jobs.length !== 13 || jobs.filter((job) => job.job_work_status === 'in_progress').length !== 1
      || business?.user_id !== userId || business.business_name !== 'Carter Home Services'
      || business.material_markup_bps !== 2000 || business.tax_rate_bps !== 825
      || JSON.stringify(business.taxable_categories) !== JSON.stringify(['materials'])
      || business.payment_terms !== 'net_15' || business.estimate_expiration_days !== 30
      || !business.address || !business.phone || !business.email || !business.website || !business.license) {
      throw new Error('Authenticated Dev fixture verification failed.');
    }
    log('Verified 13 jobs and complete business/invoice settings through the authenticated API.');
    return { publicKey, userId };
  } finally {
    await request(`${DEV_API_URL}/auth/v1/logout?scope=local`, {
      method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => log('Could not close verification session; it will expire normally.'));
  }
}

export function configureMobile(publicKey) {
  const managed = {
    EXPO_PUBLIC_APP_ENV: 'development', EXPO_PUBLIC_SUPABASE_URL: DEV_API_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: publicKey, EXPO_PUBLIC_ANALYTICS_PROVIDER: 'none',
    EXPO_PUBLIC_POSTHOG_KEY: '', EXPO_PUBLIC_JOB_DETAIL_FULLSCREEN_EDIT: 'true',
    EXPO_PUBLIC_ANALYTICS_DEBUG_RICH: 'false', EXPO_PUBLIC_IS_TESTFLIGHT: 'false',
  };
  const existing = existsSync(mobileEnvPath) ? readFileSync(mobileEnvPath, 'utf8') : '';
  const preserved = existing.split(/\r?\n/).filter((line) => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=/)?.[1];
    return line !== '# Hosted Dev screenshot environment.' && (!key || !(key in managed));
  }).join('\n').trim();
  writeFileSync(mobileEnvPath, [preserved, '# Hosted Dev screenshot environment.',
    ...Object.entries(managed).map(([key, value]) => `${key}=${value}`), ''].filter((line, i) => i > 0 || line).join('\n'), { mode: 0o600 });
  chmodSync(mobileEnvPath, 0o600);
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: npm run screenshots:reset:dev\n'
      + 'Only targets FieldSoli Dev (anypejjoovlatmrkrxvx). No Docker, CLI, or database reset.\n'
      + 'Set SUPABASE_ACCESS_TOKEN in .env.screenshots-dev.local. A separate demo password is generated there.\n'
      + 'Replaces only the marked demo account dataset, then configures Expo for Dev.');
    return;
  }
  if (process.argv.length > 2) throw new Error('This command accepts no target or URL overrides. Use --help for setup.');
  if (existsSync(credentialsPath)) loadEnvFile(credentialsPath);
  if (!process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Set SUPABASE_ACCESS_TOKEN in .env.screenshots-dev.local (see .env.screenshots-dev.example).');
  let password = process.env.DEV_SCREENSHOT_PASSWORD;
  if (!password) {
    password = randomBytes(24).toString('base64url') + '!aA1';
    appendFileSync(credentialsPath, `\nDEV_SCREENSHOT_PASSWORD=${password}\n`, { mode: 0o600 });
  }
  if (existsSync(credentialsPath)) chmodSync(credentialsPath, 0o600);
  const { publicKey } = await resetDevDemo({ token: process.env.SUPABASE_ACCESS_TOKEN, password });
  configureMobile(publicKey);
  console.log(`Dev demo ready. Sign in with ${DEMO_EMAIL}.`);
  console.log('Password: DEV_SCREENSHOT_PASSWORD in .env.screenshots-dev.local (or your injected environment).');
  console.log('Expo now points to Dev. Run npm run mobile; restart Metro if it is already running.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
