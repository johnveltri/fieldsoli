import { useCallback, useMemo, useRef, useState } from 'react';
import {
  JOB_SHORT_DESCRIPTION_MAX_LENGTH,
  type JobDetailViewModel,
} from '@fieldsolo/shared-types';
import type {
  ApplyJobDetailEditPayload,
  SessionDurationDraft,
} from '@fieldsolo/api-client';
import {
  createDefaultSessionDraft,
  deviceIanaTimeZone,
  durationHoursBetween,
  inferSessionClockExplicitFlags,
  JOB_DETAIL_EMPTY_LABELS,
  normalizeSessionStartedTz,
  resolveSessionDraftTimes,
  todayLocalDateString,
} from '@fieldsolo/api-client';
import type { OtherCostTypeDb } from '@fieldsolo/api-client';

export { JOB_SHORT_DESCRIPTION_MAX_LENGTH };

function clampShortDescription(value: string): string {
  return value.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH);
}

export type DraftRowBase = {
  id: string;
  isNew: boolean;
  removed: boolean;
};

export type DraftSessionRow = DraftRowBase &
  SessionDurationDraft & {
    /** User picked start clock; empty shows Start placeholder. */
    explicitStartClock: boolean;
    /** User picked end clock; empty shows End placeholder. */
    explicitEndClock: boolean;
  };

export type DraftNoteRow = DraftRowBase & {
  body: string;
  sessionId: string | null;
};

export type DraftMaterialRow = DraftRowBase & {
  description: string;
  totalCostCents: number;
  showBreakdown: boolean;
  quantity: number;
  quantityExplicit: boolean;
  unit: string;
  unitCostCents: number;
  unitCostExplicit: boolean;
  sessionId: string | null;
};

export type DraftOtherCostRow = DraftRowBase & {
  costType: OtherCostTypeDb | '';
  costTypeExplicit: boolean;
  description: string;
  costCents: number;
  sessionId: string | null;
};

export type JobEditDraft = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  serviceAddress: string;
  revenueCents: number | null;
  /** Job-level “no revenue” confirmation (persisted with revenue_cents = 0). */
  noRevenueConfirmed: boolean;
  /** Job-level “no materials used” confirmation (persisted as materials_reviewed_at). */
  noMaterialsConfirmed: boolean;
  /** Job-level “no other costs” confirmation (persisted as other_costs_reviewed_at). */
  noOtherCostsConfirmed: boolean;
  sessions: DraftSessionRow[];
  notes: DraftNoteRow[];
  materials: DraftMaterialRow[];
  otherCosts: DraftOtherCostRow[];
};

export type JobEditSnapshot = JobEditDraft;

function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Builds an in-memory edit draft from a loaded job (excludes in-progress session). */
export function createJobEditDraft(job: JobDetailViewModel): JobEditDraft {
  const sessions: DraftSessionRow[] = job.displaySessions.map((s) => {
    const calendarDateExplicit = s.calendarDateExplicit !== false;
    const date = calendarDateExplicit ? isoToLocalDate(s.startedAt) : '';
    const durationHours = durationHoursBetween(s.startedAt, s.endedAt ?? s.startedAt);
    let explicitStartClock = s.clockStartExplicit;
    let explicitEndClock = s.clockEndExplicit;
    if (!explicitStartClock && !explicitEndClock && calendarDateExplicit) {
      if (s.clockTimesExplicit) {
        explicitStartClock = true;
        explicitEndClock = true;
      } else {
        const inferred = inferSessionClockExplicitFlags({
          date,
          durationHours,
          startedAt: s.startedAt,
          endedAt: s.endedAt ?? s.startedAt,
        });
        explicitStartClock = inferred.explicitStartClock;
        explicitEndClock = inferred.explicitEndClock;
      }
    }
    return {
      id: s.id,
      isNew: false,
      removed: false,
      date,
      durationHours,
      clockTimesExplicit: explicitStartClock || explicitEndClock,
      explicitStartClock,
      explicitEndClock,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? s.startedAt,
      startedTz: deviceIanaTimeZone(),
    };
  });

  const notes: DraftNoteRow[] = job.noteBuckets.flatMap((b) =>
    b.notes.map((n) => ({
      id: n.id,
      isNew: false,
      removed: false,
      body: n.body,
      sessionId: n.sessionId,
    })),
  );

  const materials: DraftMaterialRow[] = job.materialBuckets.flatMap((b) =>
    b.items.map((m) => {
      // Older rows did not persist explicitness. Preserve their existing
      // total-only representation while treating a real breakdown as
      // explicit when the new fields are absent.
      const material = m as typeof m & {
        quantityExplicit?: boolean;
        unitCostExplicit?: boolean;
      };
      const quantityValue = material.quantity ?? 0;
      const unitCostValue = material.unitCostCents ?? 0;
      const fastPath = isMaterialFastPath(m.quantity, m.unit);
      const quantityExplicit = material.quantityExplicit ?? !fastPath;
      const unitCostExplicit = material.unitCostExplicit ?? !fastPath;
      return {
        id: m.id,
        isNew: false,
        removed: false,
        description:
          m.name === JOB_DETAIL_EMPTY_LABELS.materialDescription ? '' : m.name,
        totalCostCents:
          material.totalCostCents ?? Math.round(unitCostValue * quantityValue),
        showBreakdown: quantityExplicit || unitCostExplicit,
        quantity: quantityExplicit ? quantityValue : 0,
        quantityExplicit,
        unit: quantityExplicit || unitCostExplicit ? m.unit || '' : '',
        unitCostCents: unitCostExplicit ? unitCostValue : 0,
        unitCostExplicit,
        sessionId: m.sessionId,
      };
    }),
  );

  const otherCosts: DraftOtherCostRow[] = job.otherCostBuckets.flatMap((b) =>
    b.items.map((c) => ({
      id: c.id,
      isNew: false,
      removed: false,
      costType: c.costTypeExplicit === false ? '' : (c.costType as OtherCostTypeDb),
      costTypeExplicit: c.costTypeExplicit !== false,
      description: c.description,
      costCents: c.costCents,
      sessionId: c.sessionId,
    })),
  );

  return {
    shortDescription: clampShortDescription(job.shortDescription),
    longDescription: job.longDescription ?? '',
    customerName: job.customerName,
    serviceAddress: job.serviceAddress,
    revenueCents: job.earnings.revenueCents,
    noRevenueConfirmed: job.noRevenueConfirmed ?? false,
    noMaterialsConfirmed: job.noMaterialsConfirmed,
    noOtherCostsConfirmed: job.noOtherCostsConfirmed,
    sessions,
    notes,
    materials,
    otherCosts,
  };
}

function rowsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isJobEditDraftDirty(snapshot: JobEditSnapshot, draft: JobEditDraft): boolean {
  return !rowsEqual(snapshot, draft);
}

/** Marks a row removed and detaches visible children when its session is removed. */
export function removeJobEditDraftRow(
  draft: JobEditDraft,
  kind: 'sessions' | 'notes' | 'materials' | 'otherCosts',
  id: string,
): JobEditDraft {
  if (kind === 'sessions') {
    return {
      ...draft,
      sessions: draft.sessions.map((row) =>
        row.id === id ? { ...row, removed: true } : row,
      ),
      notes: draft.notes.map((row) =>
        !row.removed && row.sessionId === id ? { ...row, sessionId: null } : row,
      ),
      materials: draft.materials.map((row) =>
        !row.removed && row.sessionId === id ? { ...row, sessionId: null } : row,
      ),
      otherCosts: draft.otherCosts.map((row) =>
        !row.removed && row.sessionId === id ? { ...row, sessionId: null } : row,
      ),
    };
  }
  return {
    ...draft,
    [kind]: draft[kind].map((row) => (row.id === id ? { ...row, removed: true } : row)),
  };
}

function isBlankNewSession(row: DraftSessionRow, draft: JobEditDraft): boolean {
  if (!row.isNew || row.removed) return false;
  if (sessionReferencedInDraft(draft, row.id)) return false;
  const noDate = !row.date.trim();
  const noTimeData =
    row.durationHours <= 0 && !row.explicitStartClock && !row.explicitEndClock;
  return noDate && noTimeData;
}

function sessionReferencedInDraft(draft: JobEditDraft, sessionId: string): boolean {
  for (const row of draft.notes) {
    if (!row.removed && row.sessionId === sessionId && !isBlankNewNote(row)) return true;
  }
  for (const row of draft.materials) {
    if (!row.removed && row.sessionId === sessionId && !isBlankNewMaterial(row)) return true;
  }
  for (const row of draft.otherCosts) {
    if (!row.removed && row.sessionId === sessionId && !isBlankNewOtherCost(row)) return true;
  }
  return false;
}

function isBlankNewNote(row: DraftNoteRow): boolean {
  return row.isNew && !row.removed && row.body.trim() === '';
}

function isBlankNewMaterial(row: DraftMaterialRow): boolean {
  if (!row.isNew || row.removed) return false;
  return (
    row.description.trim() === '' &&
    row.totalCostCents <= 0 &&
    !row.showBreakdown &&
    !row.quantityExplicit &&
    !row.unitCostExplicit &&
    row.quantity <= 0 &&
    row.unitCostCents <= 0 &&
    !row.unit.trim() &&
    !row.sessionId
  );
}

function shouldDropNote(row: DraftNoteRow): boolean {
  return !row.removed && row.body.trim() === '';
}

/** Stored as description + total only (qty 1, unit ea). Edit UI shows empty breakdown fields. */
function isMaterialFastPath(quantity: number | null | undefined, unit: string | null | undefined): boolean {
  const u = (unit ?? '').trim();
  return quantity === 1 && (u === '' || u === 'ea');
}

function isBlankNewOtherCost(row: DraftOtherCostRow): boolean {
  if (!row.isNew || row.removed) return false;
  return (
    !row.costType &&
    row.costCents <= 0 &&
    row.description.trim() === '' &&
    !row.sessionId
  );
}

export type JobEditValidation = {
  canDone: boolean;
  titleBlank: boolean;
  partialInvalidRows: string[];
};

export function validateJobEditDraft(draft: JobEditDraft): JobEditValidation {
  const titleBlank = draft.shortDescription.trim() === '';
  return {
    canDone: !titleBlank,
    titleBlank,
    partialInvalidRows: [],
  };
}

function resolveEditSessionTimes(row: DraftSessionRow): { startedAt: string; endedAt: string } {
  const date = row.date.trim() || todayLocalDateString();
  const normalized = { ...row, date };
  if (normalized.explicitStartClock && normalized.explicitEndClock) {
    return { startedAt: normalized.startedAt, endedAt: normalized.endedAt };
  }
  const hours = Math.max(0, normalized.durationHours);
  if (normalized.explicitStartClock) {
    const startedAt = normalized.startedAt;
    return {
      startedAt,
      endedAt: new Date(new Date(startedAt).getTime() + hours * 3_600_000).toISOString(),
    };
  }
  if (normalized.explicitEndClock) {
    const endedAt = normalized.endedAt;
    return {
      startedAt: new Date(new Date(endedAt).getTime() - hours * 3_600_000).toISOString(),
      endedAt,
    };
  }
  return resolveSessionDraftTimes({ ...normalized, clockTimesExplicit: false });
}

export function materialHasBreakdown(row: DraftMaterialRow): boolean {
  return (
    row.showBreakdown ||
    row.quantityExplicit ||
    row.unitCostExplicit ||
    row.quantity > 0 ||
    row.unitCostCents > 0 ||
    !!row.unit.trim()
  );
}

export function materialBreakdownTotalCents(row: DraftMaterialRow): number {
  if (row.quantity > 0 && row.unitCostCents > 0) {
    return Math.round(row.unitCostCents * row.quantity);
  }
  return 0;
}

/**
 * Commits a unit-price edit after its field loses focus. Totals are deliberately
 * left alone here and are resolved from the final draft only when Done is pressed.
 */
export function buildMaterialUnitPriceBlurPatch(
  row: Pick<DraftMaterialRow, 'quantityExplicit' | 'unit'>,
  unitCostCents: number,
  unitCostExplicit: boolean,
): Partial<DraftMaterialRow> {
  return {
    unitCostCents,
    unitCostExplicit,
    showBreakdown: unitCostExplicit || row.quantityExplicit || !!row.unit.trim(),
  };
}

function materialPersistFields(row: DraftMaterialRow): {
  quantity: number;
  unit: string;
  unitCostCents: number;
  quantityExplicit: boolean;
  unitCostExplicit: boolean;
  totalCostCents: number;
} {
  const quantity = Math.max(0, row.quantity);
  const unitCostCents = Math.max(0, row.unitCostCents);
  return {
    // Total remains authoritative until the breakdown is complete. Once both
    // values are explicit, their product is the canonical total.
    quantity,
    unit: row.unit.trim() || 'ea',
    unitCostCents,
    quantityExplicit: row.quantityExplicit,
    unitCostExplicit: row.unitCostExplicit,
    totalCostCents:
      row.quantityExplicit && row.unitCostExplicit
        ? Math.round(quantity * unitCostCents)
        : Math.max(0, row.totalCostCents),
  };
}

/** Draft material counts as usable when it is kept, named, and has a persist total > 0. */
export function isDraftMaterialUsable(row: DraftMaterialRow): boolean {
  if (row.removed) return false;
  if (row.description.trim() === '') return false;
  return materialPersistFields(row).totalCostCents > 0;
}

/** Draft other cost counts as usable when it is kept, typed, and has an amount > 0. */
export function isDraftOtherCostUsable(row: DraftOtherCostRow): boolean {
  if (row.removed) return false;
  if (!row.costType) return false;
  return row.costCents > 0;
}

/** Builds the apply RPC diff from snapshot + current draft. */
export function buildApplyJobDetailEditPayload(
  snapshot: JobEditSnapshot,
  draft: JobEditDraft,
): ApplyJobDetailEditPayload {
  const payload: ApplyJobDetailEditPayload = {
    job: {
      shortDescription: clampShortDescription(draft.shortDescription.trim()),
      longDescription: draft.longDescription.trim(),
      customerName: draft.customerName.trim(),
      serviceAddress: draft.serviceAddress.trim(),
      revenueCents: draft.revenueCents,
    },
    sessions: { create: [], update: [], deleteIds: [] },
    notes: { create: [], update: [], deleteIds: [] },
    materials: { create: [], update: [], deleteIds: [] },
    otherCosts: { create: [], update: [], deleteIds: [] },
  };

  for (const row of draft.sessions) {
    if (row.removed && !row.isNew) {
      payload.sessions.deleteIds.push(row.id);
      continue;
    }
    if (isBlankNewSession(row, draft)) continue;

    const { startedAt, endedAt } = resolveEditSessionTimes(row);
    const apiRow = {
      id: row.id,
      startedAt,
      endedAt,
      clockTimesExplicit: row.explicitStartClock || row.explicitEndClock,
      clockStartExplicit: row.explicitStartClock,
      clockEndExplicit: row.explicitEndClock,
      calendarDateExplicit: !!row.date.trim(),
      startedTz: normalizeSessionStartedTz(row.startedTz),
    };

    const snap = snapshot.sessions.find((s) => s.id === row.id);
    if (row.isNew) {
      payload.sessions.create.push(apiRow);
    } else if (!snap || !rowsEqual({ ...snap, isNew: false, removed: false }, { ...row, isNew: false, removed: false })) {
      payload.sessions.update.push(apiRow);
    }
  }

  for (const row of draft.notes) {
    if (row.removed && !row.isNew) {
      payload.notes.deleteIds.push(row.id);
      continue;
    }
    if (shouldDropNote(row)) {
      if (!row.isNew) payload.notes.deleteIds.push(row.id);
      continue;
    }
    const apiRow = { id: row.id, body: row.body.trim(), sessionId: row.sessionId };
    const snap = snapshot.notes.find((n) => n.id === row.id);
    if (row.isNew) payload.notes.create.push(apiRow);
    else if (!snap || !rowsEqual(snap, row)) payload.notes.update.push(apiRow);
  }

  for (const row of draft.materials) {
    if (row.removed && !row.isNew) {
      payload.materials.deleteIds.push(row.id);
      continue;
    }
    if (isBlankNewMaterial(row)) continue;
    const {
      quantity,
      unit,
      unitCostCents,
      quantityExplicit,
      unitCostExplicit,
      totalCostCents,
    } = materialPersistFields(row);
    const apiRow = {
      id: row.id,
      description: row.description.trim(),
      totalCostCents,
      quantity,
      quantityExplicit,
      unit,
      unitCostCents,
      unitCostExplicit,
      sessionId: row.sessionId,
    };
    const snap = snapshot.materials.find((m) => m.id === row.id);
    if (row.isNew) payload.materials.create.push(apiRow);
    else if (!snap || !rowsEqual(snap, row)) payload.materials.update.push(apiRow);
  }

  for (const row of draft.otherCosts) {
    if (row.removed && !row.isNew) {
      payload.otherCosts.deleteIds.push(row.id);
      continue;
    }
    if (isBlankNewOtherCost(row)) continue;
    const apiRow = {
      id: row.id,
      costType: (row.costType || 'other') as OtherCostTypeDb,
      costTypeExplicit: !!row.costType,
      description: row.description,
      costCents: row.costCents,
      sessionId: row.sessionId,
    };
    const snap = snapshot.otherCosts.find((c) => c.id === row.id);
    if (row.isNew) payload.otherCosts.create.push(apiRow);
    else if (!snap || !rowsEqual(snap, row)) payload.otherCosts.update.push(apiRow);
  }

  return payload;
}

export function useJobEditDraft(job: JobDetailViewModel | null) {
  const [snapshot, setSnapshot] = useState<JobEditSnapshot | null>(null);
  const [draft, setDraft] = useState<JobEditDraft | null>(null);
  const snapshotRef = useRef(snapshot);
  const draftRef = useRef(draft);
  snapshotRef.current = snapshot;
  draftRef.current = draft;

  const resetFromJob = useCallback((j: JobDetailViewModel) => {
    const next = createJobEditDraft(j);
    snapshotRef.current = next;
    draftRef.current = next;
    setSnapshot(next);
    setDraft(next);
  }, []);

  const dirty = useMemo(
    () => (snapshot && draft ? isJobEditDraftDirty(snapshot, draft) : false),
    [snapshot, draft],
  );

  const validation = useMemo(
    () => (draft ? validateJobEditDraft(draft) : { canDone: false, titleBlank: true, partialInvalidRows: [] }),
    [draft],
  );

  const updateDraft = useCallback((patch: Partial<JobEditDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if ((next.revenueCents ?? 0) > 0) {
        next.noRevenueConfirmed = false;
      }
      draftRef.current = next;
      return next;
    });
  }, []);

  const addSession = useCallback(() => {
    const base = createDefaultSessionDraft();
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            id: newId(),
            isNew: true,
            removed: false,
            ...base,
            date: '',
            durationHours: 0,
            explicitStartClock: false,
            explicitEndClock: false,
          },
        ],
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const addNote = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        notes: [
          ...prev.notes,
          { id: newId(), isNew: true, removed: false, body: '', sessionId: null },
        ],
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const addMaterial = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        materials: [
          ...prev.materials,
          {
            id: newId(),
            isNew: true,
            removed: false,
            description: '',
            totalCostCents: 0,
            showBreakdown: false,
            quantity: 0,
            quantityExplicit: false,
            unit: '',
            unitCostCents: 0,
            unitCostExplicit: false,
            sessionId: null,
          },
        ],
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const addOtherCost = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        otherCosts: [
          ...prev.otherCosts,
          {
            id: newId(),
            isNew: true,
            removed: false,
            costType: '' as const,
            costTypeExplicit: false,
            description: '',
            costCents: 0,
            sessionId: null,
          },
        ],
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const removeRow = useCallback(
    (kind: 'sessions' | 'notes' | 'materials' | 'otherCosts', id: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = removeJobEditDraftRow(prev, kind, id);
        draftRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateSession = useCallback((id: string, patch: Partial<DraftSessionRow>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        sessions: prev.sessions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<DraftNoteRow>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        notes: prev.notes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const updateMaterial = useCallback((id: string, patch: Partial<DraftMaterialRow>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const materials = prev.materials.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const next = {
        ...prev,
        materials,
        ...(materials.some(isDraftMaterialUsable) ? { noMaterialsConfirmed: false } : {}),
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const updateOtherCost = useCallback((id: string, patch: Partial<DraftOtherCostRow>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const otherCosts = prev.otherCosts.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const next = {
        ...prev,
        otherCosts,
        ...(otherCosts.some(isDraftOtherCostUsable) ? { noOtherCostsConfirmed: false } : {}),
      };
      draftRef.current = next;
      return next;
    });
  }, []);

  const getDraftSnapshot = useCallback(
    () => ({ snapshot: snapshotRef.current, draft: draftRef.current }),
    [],
  );

  const buildPayload = useCallback(() => {
    // Read refs so Done-after-flush never saves a stale pre-commit draft
    // (shared-header Done schedules save via setTimeout).
    if (!snapshotRef.current || !draftRef.current) return null;
    return buildApplyJobDetailEditPayload(snapshotRef.current, draftRef.current);
  }, []);

  const discardDraft = useCallback(() => {
    if (snapshotRef.current) {
      draftRef.current = snapshotRef.current;
      setDraft(snapshotRef.current);
    }
  }, []);

  /** Edit mode registers blur/flush-aware Done; shared header calls this. */
  const doneHandlerRef = useRef<(() => void) | null>(null);
  const setDoneHandler = useCallback((handler: (() => void) | null) => {
    doneHandlerRef.current = handler;
  }, []);
  const requestDone = useCallback((fallback?: () => void) => {
    if (doneHandlerRef.current) {
      doneHandlerRef.current();
      return;
    }
    fallback?.();
  }, []);

  return {
    snapshot,
    draft,
    dirty,
    validation,
    resetFromJob,
    updateDraft,
    addSession,
    addNote,
    addMaterial,
    addOtherCost,
    removeRow,
    updateSession,
    updateNote,
    updateMaterial,
    updateOtherCost,
    buildPayload,
    getDraftSnapshot,
    discardDraft,
    setDoneHandler,
    requestDone,
  };
}
