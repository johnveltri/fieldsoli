import { act, renderHook } from '@testing-library/react-native';
import type { JobDetailViewModel } from '@fieldsolo/shared-types';
import { describe, expect, it, jest } from '@jest/globals';

import {
  buildMaterialUnitPriceBlurPatch,
  buildApplyJobDetailEditPayload,
  createJobEditDraft,
  removeJobEditDraftRow,
  useJobEditDraft,
  validateJobEditDraft,
  type JobEditDraft,
} from './useJobEditDraft';

function minimalJob(overrides: Partial<JobDetailViewModel> = {}): JobDetailViewModel {
  return {
    id: 'job-1',
    shortDescription: 'Test job',
    longDescription: '',
    customerName: '',
    serviceAddress: '',
    displaySessions: [],
    noteBuckets: [],
    materialBuckets: [],
    otherCostBuckets: [],
    earnings: { revenueCents: null },
    noRevenueConfirmed: false,
    noMaterialsConfirmed: false,
    noOtherCostsConfirmed: false,
    ...overrides,
  } as JobDetailViewModel;
}

describe('validateJobEditDraft capture-now', () => {
  it('only blocks Done when the job title is blank', () => {
    const partialDraft: JobEditDraft = {
      shortDescription: 'Titled job',
      longDescription: '',
      customerName: '',
      serviceAddress: '',
      revenueCents: null,
      noRevenueConfirmed: false,
      noMaterialsConfirmed: false,
      noOtherCostsConfirmed: false,
      sessions: [
        {
          id: 'sess-1',
          isNew: true,
          removed: false,
          date: '',
          durationHours: 0,
          clockTimesExplicit: false,
          explicitStartClock: false,
          explicitEndClock: false,
          startedAt: '2026-09-01T13:00:00.000Z',
          endedAt: '2026-09-01T13:00:00.000Z',
          startedTz: 'UTC',
        },
      ],
      materials: [
        {
          id: 'mat-1',
          isNew: true,
          removed: false,
          description: '',
          totalCostCents: 0,
          showBreakdown: true,
          quantity: 0,
          quantityExplicit: false,
          unit: '',
          unitCostCents: 0,
          unitCostExplicit: false,
          sessionId: null,
        },
      ],
      notes: [],
      otherCosts: [
        {
          id: 'oc-1',
          isNew: true,
          removed: false,
          costType: '',
          costTypeExplicit: false,
          description: '',
          costCents: 0,
          sessionId: null,
        },
      ],
    };

    expect(validateJobEditDraft(partialDraft).canDone).toBe(true);
    expect(validateJobEditDraft({ ...partialDraft, shortDescription: '' }).canDone).toBe(false);
    expect(
      validateJobEditDraft({ ...partialDraft, shortDescription: 'Untitled Job' }).canDone,
    ).toBe(true);
  });

  it('includes a referenced date-only session in the payload', () => {
    const job = minimalJob();
    const snapshot = createJobEditDraft(job);
    const draft: JobEditDraft = {
      ...snapshot,
      sessions: [
        {
          id: 'sess-new',
          isNew: true,
          removed: false,
          date: '2026-09-01',
          durationHours: 0,
          clockTimesExplicit: false,
          explicitStartClock: false,
          explicitEndClock: false,
          startedAt: '2026-09-01T13:00:00.000Z',
          endedAt: '2026-09-01T13:00:00.000Z',
          startedTz: 'UTC',
        },
      ],
      materials: [
        {
          id: 'mat-1',
          isNew: true,
          removed: false,
          description: 'Kit',
          totalCostCents: 3000,
          showBreakdown: false,
          quantity: 0,
          quantityExplicit: false,
          unit: '',
          unitCostCents: 0,
          unitCostExplicit: false,
          sessionId: 'sess-new',
        },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.sessions.create[0]?.calendarDateExplicit).toBe(true);
    expect(payload.materials.create[0]?.sessionId).toBe('sess-new');
  });

  it('persists sessions without a calendar date', () => {
    const job = minimalJob();
    const snapshot = createJobEditDraft(job);
    const draft: JobEditDraft = {
      ...snapshot,
      sessions: [
        {
          id: 'sess-undated',
          isNew: true,
          removed: false,
          date: '',
          durationHours: 1,
          clockTimesExplicit: false,
          explicitStartClock: false,
          explicitEndClock: false,
          startedAt: '2026-09-01T13:00:00.000Z',
          endedAt: '2026-09-01T14:00:00.000Z',
          startedTz: 'UTC',
        },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.sessions.create[0]?.calendarDateExplicit).toBe(false);
  });

  it('can build and reopen an undated session without synthesizing from an empty date', () => {
    const job = minimalJob({
      displaySessions: [
        {
          id: 'sess-undated',
          startedAt: '2026-09-01T13:00:00.000Z',
          endedAt: '2026-09-01T14:00:00.000Z',
          dateLabel: 'Date missing',
          timeRangeLabel: '',
          durationLabel: '',
          clockTimesExplicit: false,
          clockStartExplicit: false,
          clockEndExplicit: false,
          calendarDateExplicit: false,
          attachments: [],
        },
      ],
    });

    expect(() => createJobEditDraft(job)).not.toThrow();
    const reopened = createJobEditDraft(job);
    expect(reopened.sessions[0]).toMatchObject({
      date: '',
      explicitStartClock: false,
      explicitEndClock: false,
    });
    const payload = buildApplyJobDetailEditPayload(reopened, reopened);
    expect(payload.sessions.create).toHaveLength(0);
    expect(payload.sessions.update).toHaveLength(0);
  });

  it('drops notes with empty bodies and deletes existing cleared notes', () => {
    const job = minimalJob();
    const snapshot = createJobEditDraft(job);
    const draft: JobEditDraft = {
      ...snapshot,
      notes: [
        { id: 'note-new', isNew: true, removed: false, body: '', sessionId: null },
        { id: 'note-old', isNew: false, removed: false, body: '', sessionId: null },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.notes.create).toHaveLength(0);
    expect(payload.notes.deleteIds).toEqual(['note-old']);
  });

  it('keeps unknown revenue null when only a child changes', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      notes: [
        { id: 'note-new', isNew: true, removed: false, body: 'Captured detail', sessionId: null },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.job.revenueCents).toBeNull();
    expect(payload.notes.create).toHaveLength(1);
  });

  it('detaches visible children when a session is removed', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      sessions: [{
        id: 'sess-1',
        isNew: false,
        removed: false,
        date: '2026-09-01',
        durationHours: 1,
        clockTimesExplicit: false,
        explicitStartClock: false,
        explicitEndClock: false,
        startedAt: '2026-09-01T13:00:00.000Z',
        endedAt: '2026-09-01T14:00:00.000Z',
        startedTz: 'UTC',
      }],
      notes: [
        { id: 'note-visible', isNew: false, removed: false, body: 'Keep', sessionId: 'sess-1' },
        { id: 'note-removed', isNew: false, removed: true, body: 'Delete', sessionId: 'sess-1' },
      ],
      materials: [{
        id: 'mat-visible', isNew: false, removed: false, description: 'Paint',
        totalCostCents: 1000, showBreakdown: false, quantity: 0, quantityExplicit: false,
        unit: '', unitCostCents: 0, unitCostExplicit: false, sessionId: 'sess-1',
      }],
      otherCosts: [{
        id: 'cost-visible', isNew: false, removed: false, costType: 'other',
        costTypeExplicit: true, description: 'Permit', costCents: 500, sessionId: 'sess-1',
      }],
    };

    const next = removeJobEditDraftRow(draft, 'sessions', 'sess-1');
    expect(next.sessions[0]?.removed).toBe(true);
    expect(next.notes.map((row) => row.sessionId)).toEqual([null, 'sess-1']);
    expect(next.materials[0]?.sessionId).toBeNull();
    expect(next.otherCosts[0]?.sessionId).toBeNull();
  });

  it('persists partial materials and other costs', () => {
    const job = minimalJob();
    const snapshot = createJobEditDraft(job);
    const draft: JobEditDraft = {
      ...snapshot,
      materials: [
        {
          id: 'mat-1',
          isNew: true,
          removed: false,
          description: '',
          totalCostCents: 0,
          showBreakdown: true,
          quantity: 2,
          quantityExplicit: true,
          unit: '',
          unitCostCents: 0,
          unitCostExplicit: false,
          sessionId: null,
        },
      ],
      otherCosts: [
        {
          id: 'oc-1',
          isNew: true,
          removed: false,
          costType: '',
          costTypeExplicit: false,
          description: 'Permit pending',
          costCents: 0,
          sessionId: null,
        },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.materials.create[0]).toMatchObject({
      description: '',
      quantity: 2,
      unitCostCents: 0,
    });
    expect(payload.otherCosts.create[0]).toMatchObject({
      costType: 'other',
      costTypeExplicit: false,
      costCents: 0,
    });
  });

  it('recomputes the total when a complete breakdown is present', () => {
    const job = minimalJob();
    const snapshot = createJobEditDraft(job);
    const draft: JobEditDraft = {
      ...snapshot,
      materials: [
        {
          id: 'mat-1',
          isNew: true,
          removed: false,
          description: '',
          totalCostCents: 0,
          showBreakdown: true,
          quantity: 2,
          quantityExplicit: true,
          unit: 'ea',
          unitCostCents: 3000,
          unitCostExplicit: true,
          sessionId: null,
        },
      ],
    };

    const payload = buildApplyJobDetailEditPayload(snapshot, draft);
    expect(payload.materials.create[0]).toMatchObject({
      description: '',
      totalCostCents: 6000,
      quantity: 2,
      quantityExplicit: true,
      unitCostCents: 3000,
      unitCostExplicit: true,
    });
  });

  it('preserves a total when only one breakdown value is explicit', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      materials: [{
        id: 'mat-partial',
        isNew: true,
        removed: false,
        description: 'Paint',
        totalCostCents: 10000,
        showBreakdown: true,
        quantity: 2,
        quantityExplicit: true,
        unit: 'gal',
        unitCostCents: 0,
        unitCostExplicit: false,
        sessionId: null,
      }],
    };

    expect(buildApplyJobDetailEditPayload(snapshot, draft).materials.create[0]).toMatchObject({
      totalCostCents: 10000,
      quantity: 2,
      quantityExplicit: true,
      unitCostCents: 0,
      unitCostExplicit: false,
    });
  });

  it('preserves the captured total when a unit price is cleared on blur', () => {
    const patch = buildMaterialUnitPriceBlurPatch(
      { quantityExplicit: true, unit: 'gal' },
      0,
      false,
    );

    expect(patch).toEqual({
      unitCostCents: 0,
      unitCostExplicit: false,
      showBreakdown: true,
    });
    expect(patch.totalCostCents).toBeUndefined();
  });

  it('does not recompute the total when a unit price is committed on blur', () => {
    const patch = buildMaterialUnitPriceBlurPatch(
      { quantityExplicit: true, unit: 'gal' },
      349,
      true,
    );

    expect(patch).toMatchObject({
      unitCostCents: 349,
      unitCostExplicit: true,
    });
    expect(patch.totalCostCents).toBeUndefined();
  });
});

describe('useJobEditDraft confirm-none and refs', () => {
  function setupHook(job: JobDetailViewModel) {
    const { result } = renderHook(() => useJobEditDraft(job));
    act(() => {
      result.current.resetFromJob(job);
    });
    return result;
  }

  it('does not clear noMaterialsConfirmed when adding a blank material stub', () => {
    const result = setupHook(minimalJob({ noMaterialsConfirmed: true }));
    act(() => {
      result.current.addMaterial();
    });
    expect(result.current.draft?.noMaterialsConfirmed).toBe(true);
    expect(result.current.draft?.materials).toHaveLength(1);
  });

  it('clears noMaterialsConfirmed when a material becomes usable', () => {
    const result = setupHook(minimalJob({ noMaterialsConfirmed: true }));
    act(() => {
      result.current.addMaterial();
    });
    const id = result.current.draft?.materials[0]?.id;
    expect(id).toBeTruthy();
    act(() => {
      result.current.updateMaterial(id!, { description: 'Paint', totalCostCents: 1500 });
    });
    expect(result.current.draft?.noMaterialsConfirmed).toBe(false);
  });

  it('does not clear noOtherCostsConfirmed when adding a blank other-cost stub', () => {
    const result = setupHook(minimalJob({ noOtherCostsConfirmed: true }));
    act(() => {
      result.current.addOtherCost();
    });
    expect(result.current.draft?.noOtherCostsConfirmed).toBe(true);
    expect(result.current.draft?.otherCosts).toHaveLength(1);
  });

  it('clears noOtherCostsConfirmed when an other cost becomes usable', () => {
    const result = setupHook(minimalJob({ noOtherCostsConfirmed: true }));
    act(() => {
      result.current.addOtherCost();
    });
    const id = result.current.draft?.otherCosts[0]?.id;
    expect(id).toBeTruthy();
    act(() => {
      result.current.updateOtherCost(id!, { costType: 'other', costCents: 500 });
    });
    expect(result.current.draft?.noOtherCostsConfirmed).toBe(false);
  });

  it('returns the latest ref state from getDraftSnapshot after updateDraft', () => {
    const result = setupHook(minimalJob());
    act(() => {
      result.current.updateDraft({ customerName: 'Ada', noRevenueConfirmed: true, revenueCents: 0 });
    });
    const snap = result.current.getDraftSnapshot();
    expect(snap.draft?.customerName).toBe('Ada');
    expect(snap.draft?.noRevenueConfirmed).toBe(true);
    expect(snap.draft?.revenueCents).toBe(0);
    expect(snap.snapshot?.customerName).toBe('');
  });

  it('includes long description on the apply payload', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      longDescription: '  Replace the valve.  ',
    };
    expect(buildApplyJobDetailEditPayload(snapshot, draft).job.longDescription).toBe(
      'Replace the valve.',
    );
  });

  it('includes all confirm-none values in the atomic apply payload', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      revenueCents: 0,
      noRevenueConfirmed: true,
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    };

    expect(buildApplyJobDetailEditPayload(snapshot, draft).job).toMatchObject({
      revenueCents: 0,
      noRevenueConfirmed: true,
      noMaterialsConfirmed: true,
      noOtherCostsConfirmed: true,
    });
  });

  it('delegates shared Back through the registered field-flushing handler', () => {
    const result = setupHook(minimalJob());
    const handler = jest.fn();
    const fallback = jest.fn();

    act(() => result.current.setBackHandler(handler));
    act(() => result.current.requestBack(fallback));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('clamps short description to 60 characters on the apply payload', () => {
    const snapshot = createJobEditDraft(minimalJob());
    const draft: JobEditDraft = {
      ...snapshot,
      shortDescription: `${'A'.repeat(60)}EXTRA`,
    };
    expect(buildApplyJobDetailEditPayload(snapshot, draft).job.shortDescription).toBe(
      'A'.repeat(60),
    );
  });
});
