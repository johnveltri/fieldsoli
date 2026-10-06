# Invoicing — Production Migration Evidence

Checked 2026-10-06 at the PM's explicit request. Read-only aggregate SQL; no production mutations, Job IDs, customer/contact details, descriptions, or owner identifiers were retrieved.

Project: FieldSoli, gfvqmxsiuhhujnckghpa (production). Staging anypejjoovlatmrkrxvx was not queried. Organization subscription was confirmed Free through Supabase metadata.

## Method

Inspect the relevant columns in information_schema, then sum non-deleted material job_costs by their direct Job or active, non-deleted Session's Job. Enforce equal user_id across parents. Left join every Job, including deleted Jobs, and compare the sum with its persisted Revenue. This matches the material inclusion boundary in packages/api-client/src/jobDetail.ts, where deleted Sessions and costs are excluded.

The query uses all owned Jobs by created_via; it does not infer which records are customer businesses, demo data, or tests from descriptions. Deleted cost rows remain excluded because restoring a Job does not imply restoring independently deleted costs.

## Results

| Job state | Creation source | Jobs | Unknown Revenue | Zero Revenue | Materials > known Revenue | Positive Revenue with negative residual | Zero Revenue with Materials | Unknown Revenue with Materials |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Active | add_job | 19 | 4 | 2 | 0 | 0 | 0 | 0 |
| Active | session_start | 4 | 0 | 1 | 0 | 0 | 0 | 0 |
| Soft-deleted | add_job | 32 | 21 | 3 | 1 | 1 | 0 | 0 |
| Soft-deleted | session_start | 39 | 29 | 1 | 0 | 0 | 0 | 2 |

There are 23 active Jobs and none would receive negative Labor & Services under D-02A. Four active Jobs have unknown Revenue; preserve null rather than treating it as $0. Among 71 soft-deleted Jobs, one has positive Revenue below its recorded material costs. Two other deleted Jobs have unknown Revenue and recorded Materials.

## Consequence

The normal active-Job backfill can preserve Revenue without a negative-residual review for the current dataset. A restoration exception is still real; do not clamp a negative residual to zero and silently increase historic Revenue. PM follow-up asks whether to retain a narrow pricing-review guard or defer conversion until restoration. Re-run the aggregate check before implementation migration because production can change.

## Capacity observation

pg_database_size(current_database()) returned 77,532,307 bytes (about 77.5 decimal MB). This is a point-in-time database measurement, not a forecast or confirmation of remaining egress, Storage, compute, function, or hosting limits. No table size or quota was changed.

## Exact aggregate query

```sql
with material_totals as (
  select coalesce(c.job_id, s.job_id) as job_id, c.user_id,
         sum(c.total_cost_cents) as material_cents
  from public.job_costs c
  left join public.sessions s
    on s.id = c.session_id and s.user_id = c.user_id
   and s.deleted_at is null and s.session_status <> 'deleted'
  where c.deleted_at is null and c.cost_type = 'material'
    and (c.job_id is not null or s.id is not null)
  group by coalesce(c.job_id, s.job_id), c.user_id
), scoped as (
  select j.deleted_at is not null as deleted,
         j.created_via::text as created_via, j.revenue_cents,
         coalesce(m.material_cents, 0) as material_cents
  from public.jobs j
  left join material_totals m on m.job_id = j.id and m.user_id = j.user_id
)
select deleted, created_via, count(*) as job_count,
       count(*) filter (where revenue_cents is null) as revenue_unknown_count,
       count(*) filter (where revenue_cents = 0) as revenue_zero_count,
       count(*) filter (where revenue_cents is not null
                        and material_cents > revenue_cents) as negative_labor_count,
       count(*) filter (where revenue_cents > 0
                        and material_cents > revenue_cents) as positive_revenue_negative_labor_count,
       count(*) filter (where revenue_cents = 0
                        and material_cents > 0) as zero_revenue_with_materials_count,
       count(*) filter (where revenue_cents is null
                        and material_cents > 0) as unknown_revenue_with_materials_count
from scoped group by deleted, created_via order by deleted, created_via;
```
