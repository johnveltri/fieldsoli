import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { assertDevProject, buildResetSql, resetDevDemo, DEMO_EMAIL, DEV_PROJECT_REF, DEV_API_URL } from './seed-app-store-demo-dev.mjs';

const fixture = readFileSync(new URL('../backend/supabase/fixtures/app-store-demo.sql', import.meta.url), 'utf8');
const userId = '00000000-0000-4000-8000-000000000001';
const password = 'DedicatedDevPassword!2026';
const migrations = readdirSync(new URL('../backend/supabase/migrations/', import.meta.url)).map((name) => ({ version: name.slice(0, 14) }));

function mockApi({ projectId = DEV_PROJECT_REF, marked = true, existing = true, loginId = userId, jobCount = 13, pending = false } = {}) {
  const calls = [];
  const logs = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    let data;
    if (url === `https://api.supabase.com/v1/projects/${DEV_PROJECT_REF}`) data = { id: projectId, status: 'ACTIVE_HEALTHY' };
    else if (path.endsWith('/api-keys')) data = [
      { type: 'secret', api_key: 'sb_secret_private' }, { type: 'publishable', api_key: 'sb_publishable_public' },
    ];
    else if (path.endsWith('/database/query')) {
      const { query } = JSON.parse(options.body);
      if (query.includes('select version from')) data = pending ? [] : migrations;
      else if (query.includes('select id, raw_app_meta_data')) data = existing ? [{ id: userId, fixture: marked ? 'screenshots-dev-v1' : null }] : [];
      else data = [];
    } else if (path.endsWith('/admin/users')) data = { id: userId };
    else if (path.endsWith('/token')) data = { user: { id: loginId }, access_token: 'private_session' };
    else if (path.endsWith('/logout')) return { ok: true, status: 204 };
    else if (path.endsWith('/jobs')) data = Array.from({ length: jobCount }, (_, index) => ({ id: index, job_work_status: index === 0 ? 'in_progress' : 'completed' }));
    else if (path.endsWith('/business_settings')) data = [{ user_id: userId, business_name: 'Carter Home Services',
      address: 'fictional', phone: 'fictional', email: 'fictional', website: 'fictional', license: 'fictional',
      material_markup_bps: 2000, tax_rate_bps: 825, taxable_categories: ['materials'], payment_terms: 'net_15', estimate_expiration_days: 30 }];
    else throw new Error(`Unexpected request: ${url}`);
    return { ok: true, status: 200, json: async () => data };
  };
  return { calls, logs, options: { token: 'private_pat', password, fetchImpl, log: (line) => logs.push(line) } };
}
const resets = (calls) => calls.filter(({ options }) => options.body && JSON.parse(options.body).query?.startsWith('begin;'));

test('production or unhealthy project is rejected before reading keys or writing data', async () => {
  assert.throws(() => assertDevProject({ id: DEV_PROJECT_REF, status: 'PAUSED' }));
  const api = mockApi({ projectId: 'gfvqmxsiuhhujnckghpa' });
  await assert.rejects(resetDevDemo(api.options), /expected healthy Dev/);
  assert.equal(api.calls.length, 1);
});

test('missing credentials and the local demo password fail before any network request', async () => {
  const api = mockApi();
  await assert.rejects(resetDevDemo({ ...api.options, token: '' }), /SUPABASE_ACCESS_TOKEN/);
  await assert.rejects(resetDevDemo({ ...api.options, password: 'LocalDemoOnly!2026' }), /separate password/);
  assert.equal(api.calls.length, 0);
});

test('unmarked account and pending migrations cannot be reset', async () => {
  for (const config of [{ marked: false }, { pending: true }]) {
    const api = mockApi(config);
    await assert.rejects(resetDevDemo(api.options), /unmarked|pending Dev migrations/);
    assert.equal(resets(api.calls).length, 0);
    assert.ok(!api.calls.some(({ url }) => url.includes('/auth/')));
  }
});

test('existing account sign-in must match before deleting demo data', async () => {
  const api = mockApi({ loginId: 'someone-else' });
  await assert.rejects(resetDevDemo(api.options), /reserved account/);
  assert.equal(resets(api.calls).length, 0);
});

test('new account is confirmed, server-marked, seeded once and verified without leaking secrets', async () => {
  const api = mockApi({ existing: false });
  const result = await resetDevDemo(api.options);
  assert.equal(result.publicKey, 'sb_publishable_public');
  const creation = api.calls.find(({ url }) => url.endsWith('/admin/users'));
  const body = JSON.parse(creation.options.body);
  assert.equal(body.email, DEMO_EMAIL);
  assert.equal(body.email_confirm, true);
  assert.equal(body.app_metadata.fieldsoli_fixture, 'screenshots-dev-v1');
  assert.equal(resets(api.calls).length, 1);
  for (const call of api.calls) {
    assert.ok(call.url.startsWith(DEV_API_URL) || call.url.startsWith(`https://api.supabase.com/v1/projects/${DEV_PROJECT_REF}`));
    if (call.url.includes('/rest/')) assert.equal(call.options.headers.apikey, 'sb_publishable_public');
  }
  assert.ok(api.calls.at(-1).url.endsWith('/logout?scope=local'));
  assert.ok(!api.logs.join().match(/private_pat|private_session|sb_secret|DedicatedDevPassword/));
});

test('repeat reset keeps Auth identity and checks normal API results', async () => {
  const api = mockApi();
  await resetDevDemo(api.options);
  await resetDevDemo(api.options);
  assert.equal(resets(api.calls).length, 2);
  assert.ok(!api.calls.some(({ url }) => url.endsWith('/admin/users')));
  const invalid = mockApi({ jobCount: 12 });
  await assert.rejects(resetDevDemo(invalid.options), /verification failed/);
  assert.ok(invalid.calls.at(-1).url.endsWith('/logout?scope=local'));
});

test('SQL uses a single transaction, checks ownership and safely renders fixture values', () => {
  const sql = buildResetSql(userId, "privacy'quoted", 'terms', fixture);
  assert.ok(sql.startsWith('begin;') && sql.endsWith('commit;'));
  assert.equal(sql.match(/^begin;/gm).length, 1);
  assert.equal(sql.match(/^commit;/gm).length, 1);
  assert.ok(sql.includes("'privacy''quoted'"));
  assert.ok(sql.includes('user_id is distinct from $2'));
  assert.ok(sql.includes('for update;'));
  assert.ok(!sql.includes('delete from auth.users'));
  assert.ok(!sql.includes('delete from public.job_export_requests'));
  assert.ok(!sql.includes('truncate '));
  assert.ok(!sql.includes(":'demo_user_id'"));
  assert.throws(() => buildResetSql("'; delete from auth.users;", 'p', 't', fixture), /Invalid demo/);
});

test('API errors never echo response bodies that may contain credentials', async () => {
  await assert.rejects(resetDevDemo({ token: 'pat', password, fetchImpl: async () => ({ ok: false, status: 403,
    json: () => { throw new Error('secret'); } }) }), /HTTP 403/);
});
