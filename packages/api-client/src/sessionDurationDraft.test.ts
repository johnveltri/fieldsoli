import { describe, expect, it } from 'vitest';

import {
  createDefaultSessionDraft,
  durationHoursBetween,
  inferSessionClockExplicitFlags,
  synthesizeSessionTimes,
} from './sessionDurationDraft';

describe('sessionDurationDraft', () => {
  it('synthesizes 09:00 local start plus duration', () => {
    const { startedAt, endedAt } = synthesizeSessionTimes('2026-04-01', 1, 'UTC');
    expect(startedAt).toBe('2026-04-01T09:00:00.000Z');
    expect(durationHoursBetween(startedAt, endedAt)).toBeCloseTo(1, 5);
  });

  it('defaults new session draft to today and 1 hour', () => {
    const draft = createDefaultSessionDraft(new Date('2026-04-01T12:00:00.000Z'));
    expect(draft.durationHours).toBe(1);
    expect(draft.clockTimesExplicit).toBe(false);
    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats view-consistent session labels', async () => {
    const { formatLocalDateLabel, formatSessionDurationLabel, formatSessionTimeLabel } =
      await import('./sessionDurationDraft');
    expect(formatLocalDateLabel('2026-03-25')).toBe('Mar 25, 2026');
    expect(formatSessionDurationLabel(1.4)).toBe('1.4h');
    expect(formatSessionTimeLabel('2026-03-25T14:02:00.000Z')).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
  });

  it('keeps every positive duration visibly distinct from zero at the old 0.01-hour cutoff', async () => {
    const { formatSessionDurationLabel } = await import('./sessionDurationDraft');
    expect(formatSessionDurationLabel(0)).toBe('0.0h');
    expect(formatSessionDurationLabel(1 / 3_600)).toBe('<0.1h');
    expect(formatSessionDurationLabel(36 / 3_600)).toBe('<0.1h');
    expect(formatSessionDurationLabel(37 / 3_600)).toBe('<0.1h');
  });

  it('resolves draft times when startedTz was incorrectly set to a date', async () => {
    const { resolveSessionDraftTimes } = await import('./sessionDurationDraft');
    const resolved = resolveSessionDraftTimes({
      date: '2026-09-01',
      durationHours: 1,
      clockTimesExplicit: false,
      startedAt: '',
      endedAt: '',
      startedTz: '2026-09-01',
    });
    expect(resolved.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(resolved.endedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(durationHoursBetween(resolved.startedAt, resolved.endedAt)).toBeCloseTo(1, 5);
  });

  it('clears duration to zero without throwing', async () => {
    const { resolveSessionDraftTimes } = await import('./sessionDurationDraft');
    const resolved = resolveSessionDraftTimes({
      date: '2026-09-01',
      durationHours: 0,
      clockTimesExplicit: false,
      startedAt: '',
      endedAt: '',
      startedTz: '2026-09-01',
    });
    expect(resolved.startedAt).toBe(resolved.endedAt);
  });

  it('infers start-only explicit clock from stored times', () => {
    const { startedAt, endedAt } = synthesizeSessionTimes('2026-09-01', 1, 'UTC');
    const startOnly = new Date(new Date(startedAt).getTime() - 3_600_000).toISOString();
    const inferred = inferSessionClockExplicitFlags({
      date: '2026-09-01',
      durationHours: 1,
      startedAt: startOnly,
      endedAt: startedAt,
      startedTz: 'UTC',
    });
    expect(inferred.explicitStartClock).toBe(true);
    expect(inferred.explicitEndClock).toBe(false);
  });
});
