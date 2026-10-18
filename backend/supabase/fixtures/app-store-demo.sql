-- App Store screenshot fixture. This is intentionally NOT part of db.seed.sql:
-- it is loaded only by `npm run screenshots:reset` against the local stack.
--
-- psql variables supplied by scripts/seed-app-store-demo.mjs:
--   demo_user_id, privacy_version, terms_version

\set ON_ERROR_STOP on

begin;

-- The Auth admin API creates this profile first. Keep its screenshot identity
-- complete and stable without granting the mobile client any special access.
insert into public.profiles (id, first_name, last_name, trades)
values (
  :'demo_user_id'::uuid,
  'Alex',
  'Carter',
  array['Handyman', 'Carpentry', 'Painting']::text[]
)
on conflict (id) do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  trades = excluded.trades;

-- Fictional business identity and invoice defaults for capture-ready settings.
-- Seed before materials so the fixture uses the same defaults as new app data.
insert into public.business_settings (
  user_id, business_name, address, phone, email, website, license,
  material_markup_bps, tax_rate_bps, taxable_categories,
  payment_terms, estimate_expiration_days
)
values (
  :'demo_user_id'::uuid,
  'Carter Home Services',
  E'125 Maple Avenue\nSpringfield, IL 62704',
  '(217) 555-0142',
  'alex@carterhomeservices.example',
  'https://carterhomeservices.example',
  'DEMO-2026-0142',
  2000,
  825,
  array['materials']::text[],
  'net_15',
  30
);

-- Sign-in should lead directly to capture-ready content rather than a legal or
-- analytics prompt. These are local fixture records only.
insert into public.legal_acceptances (
  user_id,
  document_type,
  document_version,
  source,
  app_version,
  platform
)
values
  (:'demo_user_id'::uuid, 'privacy_policy', :'privacy_version', 'local_app_store_fixture', 'local', 'ios'),
  (:'demo_user_id'::uuid, 'terms', :'terms_version', 'local_app_store_fixture', 'local', 'ios');

insert into public.analytics_consent (user_id, status)
values (:'demo_user_id'::uuid, 'withdrawn')
on conflict (user_id) do update set status = excluded.status;

-- Thirteen fictional, user-owned jobs cover the primary app states and produce
-- useful Earnings rankings: five completed jobs in the past week and ten in
-- the past month. Dates are relative so screenshots continue to look current.
insert into public.jobs (
  id,
  user_id,
  short_description,
  customer_name,
  service_address,
  job_type,
  created_via,
  job_work_status,
  revenue_cents,
  collected_cents,
  created_at
)
values
  (
    '1b57c0a1-0000-4000-8000-000000000001',
    :'demo_user_id'::uuid,
    'Drywall patch and paint',
    'Jordan Lee',
    '102 Maple Street',
    'Handyman',
    'add_job',
    'in_progress',
    48500,
    25000,
    now() - interval '2 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000002',
    :'demo_user_id'::uuid,
    'Interior door replacement',
    'Taylor Morgan',
    '47 Cedar Lane',
    'Handyman',
    'add_job',
    'completed',
    98000,
    98000,
    now() - interval '8 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000003',
    :'demo_user_id'::uuid,
    'Deck stair repair',
    'Casey Rivera',
    '18 Willow Court',
    'Handyman',
    'add_job',
    'completed',
    76000,
    0,
    now() - interval '14 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000004',
    :'demo_user_id'::uuid,
    'Bathroom vanity refresh',
    'Sam Patel',
    '9 Birch Avenue',
    'Handyman',
    'add_job',
    'on_hold',
    64000,
    0,
    now() - interval '20 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000005',
    :'demo_user_id'::uuid,
    'Fence gate repair',
    'Riley Chen',
    '221 Pine Drive',
    'Handyman',
    'add_job',
    'not_started',
    32500,
    0,
    now() - interval '1 day'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000006',
    :'demo_user_id'::uuid,
    'Floating shelf installation',
    'Morgan Brooks',
    '56 Oak Street',
    'Handyman',
    'add_job',
    'completed',
    35000,
    35000,
    now() - interval '3 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000007',
    :'demo_user_id'::uuid,
    'Baseboard and trim repair',
    'Avery Kim',
    '74 Elm Circle',
    'Handyman',
    'add_job',
    'completed',
    42500,
    42500,
    now() - interval '4 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000008',
    :'demo_user_id'::uuid,
    'Closet organizer installation',
    'Jamie Davis',
    '33 Spruce Court',
    'Handyman',
    'add_job',
    'completed',
    115000,
    115000,
    now() - interval '6 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000009',
    :'demo_user_id'::uuid,
    'Interior paint touch-ups',
    'Robin Flores',
    '16 Ash Lane',
    'Painting',
    'add_job',
    'completed',
    54000,
    54000,
    now() - interval '7 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000010',
    :'demo_user_id'::uuid,
    'Garage storage shelving',
    'Cameron Wells',
    '89 Sycamore Road',
    'Handyman',
    'add_job',
    'completed',
    135000,
    135000,
    now() - interval '18 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000011',
    :'demo_user_id'::uuid,
    'Exterior caulk and weatherstripping',
    'Drew Nguyen',
    '5 Juniper Place',
    'Handyman',
    'add_job',
    'completed',
    42500,
    42500,
    now() - interval '24 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000012',
    :'demo_user_id'::uuid,
    'Cabinet hardware update',
    'Quinn Harper',
    '140 Lakeview Drive',
    'Handyman',
    'add_job',
    'completed',
    49000,
    49000,
    now() - interval '29 days'
  ),
  (
    '1b57c0a1-0000-4000-8000-000000000013',
    :'demo_user_id'::uuid,
    'Screen door replacement',
    'Blake Turner',
    '61 Meadow Lane',
    'Handyman',
    'add_job',
    'completed',
    62000,
    62000,
    now() - interval '30 days'
  );

insert into public.sessions (
  id,
  job_id,
  user_id,
  entry_mode,
  session_status,
  started_at,
  ended_at,
  started_tz
)
values
  (
    '2b57c0a1-0000-4000-8000-000000000001',
    '1b57c0a1-0000-4000-8000-000000000001',
    :'demo_user_id'::uuid,
    'live',
    'in_progress',
    now() - interval '1 hour 25 minutes',
    null,
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000002',
    '1b57c0a1-0000-4000-8000-000000000002',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '4 days 5 hours',
    now() - interval '4 days 30 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000003',
    '1b57c0a1-0000-4000-8000-000000000003',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '10 days 7 hours',
    now() - interval '10 days 1 hour',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000004',
    '1b57c0a1-0000-4000-8000-000000000004',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '17 days 3 hours',
    now() - interval '17 days 1 hour 15 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000005',
    '1b57c0a1-0000-4000-8000-000000000006',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '2 days 4 hours 30 minutes',
    now() - interval '2 days 2 hours',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000006',
    '1b57c0a1-0000-4000-8000-000000000007',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '3 days 6 hours',
    now() - interval '3 days 1 hour 45 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000007',
    '1b57c0a1-0000-4000-8000-000000000008',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '5 days 10 hours',
    now() - interval '5 days 2 hours',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000008',
    '1b57c0a1-0000-4000-8000-000000000009',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '6 days 8 hours',
    now() - interval '6 days 2 hours 30 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000009',
    '1b57c0a1-0000-4000-8000-000000000010',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '16 days 10 hours',
    now() - interval '16 days 1 hour 30 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000010',
    '1b57c0a1-0000-4000-8000-000000000011',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '22 days 7 hours',
    now() - interval '22 days 1 hour 45 minutes',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000011',
    '1b57c0a1-0000-4000-8000-000000000012',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '27 days 6 hours',
    now() - interval '27 days 2 hours',
    'America/Chicago'
  ),
  (
    '2b57c0a1-0000-4000-8000-000000000012',
    '1b57c0a1-0000-4000-8000-000000000013',
    :'demo_user_id'::uuid,
    'manual',
    'ended',
    now() - interval '29 days 5 hours',
    now() - interval '29 days 1 hour 30 minutes',
    'America/Chicago'
  );

insert into public.job_costs (
  id,
  user_id,
  job_id,
  session_id,
  description,
  quantity,
  unit,
  unit_cost_cents,
  total_cost_cents,
  incurred_on,
  cost_type
)
values
  (
    '3b57c0a1-0000-4000-8000-000000000001',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000001',
    '2b57c0a1-0000-4000-8000-000000000001',
    'Drywall patch kit',
    1,
    'ea',
    3800,
    3800,
    current_date,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000002',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000001',
    null,
    'Travel and parking',
    null,
    null,
    null,
    1200,
    current_date,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000003',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000002',
    null,
    'Pre-hung interior door',
    1,
    'set',
    24500,
    24500,
    current_date - 4,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000004',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000002',
    null,
    'Haul-away',
    null,
    null,
    null,
    3500,
    current_date - 4,
    'disposal'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000005',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000003',
    '2b57c0a1-0000-4000-8000-000000000003',
    'Pressure-treated stair stringer',
    2,
    'ea',
    3750,
    7500,
    current_date - 10,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000006',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000003',
    null,
    'Tool rental',
    null,
    null,
    null,
    4500,
    current_date - 10,
    'equipment_rental'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000007',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000004',
    '2b57c0a1-0000-4000-8000-000000000004',
    'Vanity hardware kit',
    1,
    'set',
    3800,
    3800,
    current_date - 17,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000008',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000004',
    null,
    'Helper labor',
    2,
    'hr',
    3000,
    6000,
    current_date - 17,
    'helper_labor'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000009',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000006',
    '2b57c0a1-0000-4000-8000-000000000005',
    'Floating shelf kit',
    1,
    'set',
    4500,
    4500,
    current_date - 2,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000010',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000006',
    null,
    'Travel and parking',
    null,
    null,
    null,
    1200,
    current_date - 2,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000011',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000007',
    '2b57c0a1-0000-4000-8000-000000000006',
    'Pre-primed baseboard',
    24,
    'ft',
    200,
    4800,
    current_date - 3,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000012',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000007',
    null,
    'Disposal',
    null,
    null,
    null,
    1200,
    current_date - 3,
    'disposal'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000013',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000008',
    '2b57c0a1-0000-4000-8000-000000000007',
    'Closet organizer kit',
    1,
    'set',
    36000,
    36000,
    current_date - 5,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000014',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000008',
    null,
    'Travel and parking',
    null,
    null,
    null,
    2000,
    current_date - 5,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000015',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000009',
    '2b57c0a1-0000-4000-8000-000000000008',
    'Interior paint and supplies',
    1,
    'set',
    10500,
    10500,
    current_date - 6,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000016',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000009',
    null,
    'Travel and parking',
    null,
    null,
    null,
    1500,
    current_date - 6,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000017',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000010',
    '2b57c0a1-0000-4000-8000-000000000009',
    'Garage storage rack materials',
    1,
    'set',
    39000,
    39000,
    current_date - 16,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000018',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000010',
    null,
    'Tool rental',
    null,
    null,
    null,
    6000,
    current_date - 16,
    'equipment_rental'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000019',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000011',
    '2b57c0a1-0000-4000-8000-000000000010',
    'Exterior caulk and supplies',
    1,
    'set',
    7000,
    7000,
    current_date - 22,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000020',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000011',
    null,
    'Travel and parking',
    null,
    null,
    null,
    1200,
    current_date - 22,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000021',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000012',
    '2b57c0a1-0000-4000-8000-000000000011',
    'Cabinet pulls and screws',
    12,
    'ea',
    792,
    9500,
    current_date - 27,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000022',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000012',
    null,
    'Travel and parking',
    null,
    null,
    null,
    3500,
    current_date - 27,
    'travel_parking'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000023',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000013',
    '2b57c0a1-0000-4000-8000-000000000012',
    'Screen door assembly',
    1,
    'ea',
    19500,
    19500,
    current_date - 29,
    'material'
  ),
  (
    '3b57c0a1-0000-4000-8000-000000000024',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000013',
    null,
    'Haul-away',
    null,
    null,
    null,
    5000,
    current_date - 29,
    'disposal'
  );

insert into public.notes (id, user_id, job_id, session_id, body)
values
  (
    '4b57c0a1-0000-4000-8000-000000000001',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000001',
    '2b57c0a1-0000-4000-8000-000000000001',
    'Patching the anchor holes, feathering the repair, then matching the existing eggshell finish.'
  ),
  (
    '4b57c0a1-0000-4000-8000-000000000002',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000001',
    null,
    'Customer approved the patch location and paint touch-up before work began.'
  ),
  (
    '4b57c0a1-0000-4000-8000-000000000003',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000002',
    null,
    'Installed the new bedroom door, adjusted the reveal, and tested the latch.'
  ),
  (
    '4b57c0a1-0000-4000-8000-000000000004',
    :'demo_user_id'::uuid,
    '1b57c0a1-0000-4000-8000-000000000003',
    null,
    'Awaiting payment after stair cleanup and the customer walkthrough.'
  );

commit;
