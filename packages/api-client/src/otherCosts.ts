import type { JobId } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import type { Database } from './database.types';
import type { SessionId } from './sessions';

export type OtherCostId = string;

/** Non-material `job_costs.cost_type` values allowed by the DB check constraint. */
export type OtherCostTypeDb =
  | 'helper_labor'
  | 'equipment_rental'
  | 'permit'
  | 'disposal'
  | 'travel_parking'
  | 'other';

export type CreateOtherCostInput = {
  jobId: JobId | null;
  sessionId: SessionId | null;
  costType: OtherCostTypeDb;
  description: string;
  costCents: number;
  invoiceCustomer?: boolean;
};

export type UpdateOtherCostInput = {
  costType?: OtherCostTypeDb;
  description?: string;
  costCents?: number;
  sessionId?: SessionId | null;
  jobId?: JobId | null;
  invoiceCustomer?: boolean;
};

export const OTHER_COST_TYPE_VALUES = [
  'helper_labor',
  'equipment_rental',
  'permit',
  'disposal',
  'travel_parking',
  'other',
] as const satisfies readonly OtherCostTypeDb[];

function assertOtherCostType(costType: string): asserts costType is OtherCostTypeDb {
  if (!OTHER_COST_TYPE_VALUES.includes(costType as OtherCostTypeDb)) {
    throw new Error('Invalid other cost type.');
  }
}

function normalizeOptionalDescription(description: string): string | null {
  const trimmed = description.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertCostNonNegative(costCents: number): void {
  if (!Number.isFinite(costCents) || costCents < 0) {
    throw new Error('Other cost amount must be a non-negative number of cents.');
  }
}

function isMaterialCostType(costType: string | null | undefined): boolean {
  return costType == null || costType === 'material';
}

/** Inserts a non-material job cost scoped to either a job or a session (exactly one). */
export async function createOtherCost(
  client: FieldSoloSupabaseClient,
  input: CreateOtherCostInput,
): Promise<OtherCostId> {
  assertOtherCostType(input.costType);
  assertCostNonNegative(input.costCents);

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('No authenticated user available to create an other cost.');
  }

  const row = {
    user_id: userId,
    description: normalizeOptionalDescription(input.description),
    quantity: 1,
    unit: 'ea',
    unit_cost_cents: input.costCents,
    total_cost_cents: Math.round(input.costCents),
    cost_type: input.costType,
    job_id: input.sessionId ? null : (input.jobId ?? null),
    session_id: input.sessionId ?? null,
    ...(input.invoiceCustomer !== undefined ? { invoice_customer: input.invoiceCustomer } : {}),
  };

  const { data, error } = await client
    .from('job_costs')
    .insert(row)
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateOtherCost(
  client: FieldSoloSupabaseClient,
  otherCostId: OtherCostId,
  input: UpdateOtherCostInput,
): Promise<void> {
  const patch: Database['public']['Tables']['job_costs']['Update'] = {};

  if (input.costType !== undefined) {
    assertOtherCostType(input.costType);
    patch.cost_type = input.costType;
  }
  if (input.description !== undefined) {
    patch.description = normalizeOptionalDescription(input.description);
  }
  if (input.invoiceCustomer !== undefined) {
    patch.invoice_customer = input.invoiceCustomer;
  }
  if (input.costCents !== undefined) {
    assertCostNonNegative(input.costCents);
    patch.unit_cost_cents = input.costCents;
    patch.total_cost_cents = Math.round(input.costCents);
    patch.quantity = 1;
  }

  if (input.sessionId !== undefined) {
    if (input.sessionId === null) {
      if (input.jobId !== undefined && input.jobId !== null) {
        patch.job_id = input.jobId;
        patch.session_id = null;
      } else {
        const { data: current, error: readErr } = await client
          .from('job_costs')
          .select('job_id, session_id, cost_type')
          .eq('id', otherCostId)
          .is('deleted_at', null)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!current || isMaterialCostType((current as { cost_type: string }).cost_type)) {
          throw new Error(
            'Other cost not found (check RLS: cost must be owned by you).',
          );
        }
        const row = current as { job_id: string | null; session_id: string | null };
        let jobId = row.job_id;
        if (!jobId && row.session_id) {
          const { data: sess, error: sessErr } = await client
            .from('sessions')
            .select('job_id')
            .eq('id', row.session_id)
            .maybeSingle();
          if (sessErr) throw sessErr;
          jobId = (sess as { job_id: string } | null)?.job_id ?? null;
        }
        if (!jobId) {
          throw new Error('Could not resolve parent job for other cost reassignment.');
        }
        patch.job_id = jobId;
        patch.session_id = null;
      }
    } else {
      patch.job_id = null;
      patch.session_id = input.sessionId;
    }
  }

  if (Object.keys(patch).length === 0) return;

  const { data, error } = await client
    .from('job_costs')
    .update(patch)
    .eq('id', otherCostId)
    .in('cost_type', [...OTHER_COST_TYPE_VALUES])
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Update affected no rows (check RLS: other cost must be owned by you).',
    );
  }
}

export async function deleteOtherCost(
  client: FieldSoloSupabaseClient,
  otherCostId: OtherCostId,
): Promise<void> {
  const { data, error } = await client
    .from('job_costs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', otherCostId)
    .in('cost_type', [...OTHER_COST_TYPE_VALUES])
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Delete affected no rows (check RLS: other cost must be owned by you).',
    );
  }
}
