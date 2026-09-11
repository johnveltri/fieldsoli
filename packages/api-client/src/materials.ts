import type { JobId } from '@fieldsolo/shared-types';

import type { FieldSoloSupabaseClient } from './client';
import type { Database } from './database.types';
import type { SessionId } from './sessions';

export type MaterialId = string;

/**
 * Input for creating a new material entry. At least one of `jobId` /
 * `sessionId` must be non-null to satisfy `materials_at_least_one_parent`;
 * however the `createMaterial` helper mirrors the Notes pattern by always
 * writing **exactly one** parent (job_id OR session_id) so the UI stays
 * symmetric with Notes.
 *
 * When both quantity and unit cost are explicit, `total_cost_cents` is
 * computed as `Math.round(unitCostCents * quantity)`. A total-only capture
 * instead preserves its authoritative `totalCostCents` and marks the
 * breakdown fields as non-explicit.
 */
export type CreateMaterialInput = {
  /**
   * Parent job, or `null` for an Inbox quick capture with no parent. When
   * `sessionId` is set, `job_id` is nulled out (session-scoped).
   */
  jobId: JobId | null;
  sessionId: SessionId | null;
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
  quantityExplicit?: boolean;
  unitCostExplicit?: boolean;
  totalCostCents?: number;
};

/**
 * Partial update for an existing material entry.
 *
 * - `description` / `quantity` / `unit` / `unitCostCents` — field edits.
 *   Whenever `quantity` or `unitCostCents` is written the total is
 *   recomputed; if only one side is provided we read the current row to
 *   resolve the other factor before persisting.
 * - `sessionId` — when provided (including `null`) reassigns the parent.
 *   Pass a session id to attach to that session; pass `null` to move the
 *   material back to the unassigned (job-scoped) bucket.
 * - `jobId` — optional optimization for the `sessionId: null` path. When
 *   provided, reassignment can skip parent-resolution reads and still
 *   update both parent columns in one statement.
 */
export type UpdateMaterialInput = {
  description?: string;
  quantity?: number;
  unit?: string;
  unitCostCents?: number;
  quantityExplicit?: boolean;
  unitCostExplicit?: boolean;
  totalCostCents?: number;
  sessionId?: SessionId | null;
  jobId?: JobId | null;
};

function assertDescriptionNotBlank(description: string): void {
  if (!description || !description.trim()) {
    throw new Error('Material description must not be blank.');
  }
}

function assertQuantityPositive(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Material quantity must be a positive number.');
  }
}

function assertUnitCostNonNegative(unitCostCents: number): void {
  if (!Number.isFinite(unitCostCents) || unitCostCents < 0) {
    throw new Error('Material unit cost must be a non-negative number of cents.');
  }
}

function assertTotalCostNonNegative(totalCostCents: number): void {
  if (!Number.isFinite(totalCostCents) || totalCostCents < 0) {
    throw new Error('Material total cost must be a non-negative number of cents.');
  }
}

function computeTotalCostCents(unitCostCents: number, quantity: number): number {
  return Math.round(unitCostCents * quantity);
}

/** Inserts a new material scoped to either a job or a session (exactly one). */
export async function createMaterial(
  client: FieldSoloSupabaseClient,
  input: CreateMaterialInput,
): Promise<MaterialId> {
  assertDescriptionNotBlank(input.description);
  assertQuantityPositive(input.quantity);
  assertUnitCostNonNegative(input.unitCostCents);
  if (input.totalCostCents !== undefined) {
    assertTotalCostNonNegative(input.totalCostCents);
  }

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) {
    throw new Error('No authenticated user available to create a material.');
  }

  const row = {
    user_id: userId,
    description: input.description.trim(),
    quantity: input.quantityExplicit === false ? null : input.quantity,
    ...(input.quantityExplicit === undefined
      ? {}
      : { quantity_explicit: input.quantityExplicit }),
    unit: input.unit.trim(),
    unit_cost_cents: input.unitCostExplicit === false ? null : input.unitCostCents,
    ...(input.unitCostExplicit === undefined
      ? {}
      : { unit_cost_explicit: input.unitCostExplicit }),
    total_cost_cents:
      input.totalCostCents ?? computeTotalCostCents(input.unitCostCents, input.quantity),
    cost_type: 'material',
    // When a session is chosen we null out job_id. Otherwise job-scoped, or —
    // when jobId is also null — an Inbox quick capture with no parent. Matches
    // how fetchJobDetail / inbox lists bucket materials.
    job_id: input.sessionId ? null : (input.jobId ?? null),
    session_id: input.sessionId ?? null,
  };

  const { data, error } = await client
    .from('job_costs')
    .insert(row)
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Updates a material's fields and/or reassigns its parent session.
 *
 * When `sessionId` is provided we always write both `job_id` and
 * `session_id` in a single UPDATE so the `materials_at_least_one_parent`
 * check never sees a transient state with both parents null.
 *
 * When `quantity` or `unitCostCents` is provided, `total_cost_cents` is
 * recomputed using the provided field plus the current value of the
 * unspecified field read back from the row.
 */
export async function updateMaterial(
  client: FieldSoloSupabaseClient,
  materialId: MaterialId,
  input: UpdateMaterialInput,
): Promise<void> {
  const patch: Database['public']['Tables']['job_costs']['Update'] = {};

  if (input.description !== undefined) {
    assertDescriptionNotBlank(input.description);
    patch.description = input.description.trim();
  }
  if (input.unit !== undefined) {
    patch.unit = input.unit.trim();
  }
  if (input.quantity !== undefined) {
    assertQuantityPositive(input.quantity);
    patch.quantity = input.quantity;
  }
  if (input.unitCostCents !== undefined) {
    assertUnitCostNonNegative(input.unitCostCents);
    patch.unit_cost_cents = input.unitCostCents;
  }
  if (input.quantityExplicit !== undefined) {
    patch.quantity_explicit = input.quantityExplicit;
    if (!input.quantityExplicit) patch.quantity = null;
  }
  if (input.unitCostExplicit !== undefined) {
    patch.unit_cost_explicit = input.unitCostExplicit;
    if (!input.unitCostExplicit) patch.unit_cost_cents = null;
  }

  const hasIncompleteBreakdown =
    input.quantityExplicit === false || input.unitCostExplicit === false;
  if (hasIncompleteBreakdown && input.totalCostCents === undefined) {
    throw new Error('Material total cost is required when its breakdown is incomplete.');
  }
  if (input.totalCostCents !== undefined) {
    assertTotalCostNonNegative(input.totalCostCents);
    patch.total_cost_cents = input.totalCostCents;
  }

  // If either side of the cost changed, recompute total_cost_cents. When
  // only one side is provided we read the current row so the total stays
  // accurate against the persisted value on the other side.
  const willTouchCost =
    input.totalCostCents === undefined &&
    !hasIncompleteBreakdown &&
    (input.quantity !== undefined || input.unitCostCents !== undefined);

  if (willTouchCost) {
    let effectiveQty = input.quantity;
    let effectiveUnitCost = input.unitCostCents;

    if (effectiveQty === undefined || effectiveUnitCost === undefined) {
      const { data: current, error: readErr } = await client
        .from('job_costs')
        .select('quantity, unit_cost_cents')
        .eq('id', materialId)
        .eq('cost_type', 'material')
        .is('deleted_at', null)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!current) {
        throw new Error(
          'Material not found (check RLS: material must be owned by you).',
        );
      }
      const row = current as {
        quantity: string | number | null;
        unit_cost_cents: number | null;
      };
      if (effectiveQty === undefined) {
        const q = row.quantity;
        effectiveQty = typeof q === 'string' ? Number(q) : (q ?? 0);
      }
      if (effectiveUnitCost === undefined) {
        effectiveUnitCost = row.unit_cost_cents ?? 0;
      }
    }

    patch.total_cost_cents = computeTotalCostCents(
      effectiveUnitCost,
      effectiveQty,
    );
  }

  if (input.sessionId !== undefined) {
    if (input.sessionId === null) {
      if (input.jobId !== undefined && input.jobId !== null) {
        patch.job_id = input.jobId;
        patch.session_id = null;
      } else {
        // Reassign back to the job bucket. Fetch the parent job id from
        // whichever side is currently set, so the row ends up with at
        // least one parent.
        const { data: current, error: readErr } = await client
          .from('job_costs')
          .select('job_id, session_id')
          .eq('id', materialId)
          .eq('cost_type', 'material')
          .is('deleted_at', null)
          .maybeSingle();
        if (readErr) throw readErr;
        if (!current) {
          throw new Error(
            'Material not found (check RLS: material must be owned by you).',
          );
        }
        const row = current as {
          job_id: string | null;
          session_id: string | null;
        };
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
          throw new Error('Could not resolve parent job for material reassignment.');
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
    .eq('id', materialId)
    .eq('cost_type', 'material')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Update affected no rows (check RLS: material must be owned by you).',
    );
  }
}

/** Soft-deletes a material by stamping `deleted_at`. */
export async function deleteMaterial(
  client: FieldSoloSupabaseClient,
  materialId: MaterialId,
): Promise<void> {
  const { data, error } = await client
    .from('job_costs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', materialId)
    .eq('cost_type', 'material')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Delete affected no rows (check RLS: material must be owned by you).',
    );
  }
}
