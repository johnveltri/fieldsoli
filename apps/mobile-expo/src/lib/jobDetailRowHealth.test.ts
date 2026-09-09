import { formatSessionTimeLabel, JOB_DETAIL_EMPTY_LABELS } from '@fieldsolo/api-client';
import type { JobDetailSession } from '@fieldsolo/shared-types';

import {
  isSessionUsableForCompleteness,
  sessionViewTimeLabel,
  shouldShowSessionTimeRange,
} from './jobDetailRowHealth';

function session(partial: Partial<JobDetailSession>): JobDetailSession {
  return {
    id: 's1',
    startedAt: '2026-04-17T14:00:00.000Z',
    endedAt: '2026-04-17T15:00:00.000Z',
    clockTimesExplicit: false,
    clockStartExplicit: false,
    clockEndExplicit: false,
    calendarDateExplicit: true,
    dateLabel: 'Apr 17, 2026',
    timeRangeLabel: '',
    durationLabel: '1.0h',
    attachments: [],
    ...partial,
  };
}

describe('sessionViewTimeLabel', () => {
  it('shows start only when start is explicit and end is not', () => {
    const label = sessionViewTimeLabel(
      session({
        clockStartExplicit: true,
        clockEndExplicit: false,
        clockTimesExplicit: true,
        timeRangeLabel: '',
        durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
        endedAt: null,
      }),
    );
    expect(label).toBe(formatSessionTimeLabel('2026-04-17T14:00:00.000Z'));
    expect(shouldShowSessionTimeRange(session({
      clockStartExplicit: true,
      clockEndExplicit: false,
      clockTimesExplicit: true,
    }))).toBe(true);
  });

  it('shows a full range when both clocks are explicit and duration exists', () => {
    const start = '2026-04-17T14:00:00.000Z';
    const end = '2026-04-17T15:00:00.000Z';
    expect(
      sessionViewTimeLabel(
        session({
          startedAt: start,
          endedAt: end,
          clockStartExplicit: true,
          clockEndExplicit: true,
          clockTimesExplicit: true,
          durationLabel: '1.0h',
        }),
      ),
    ).toBe(`${formatSessionTimeLabel(start)} – ${formatSessionTimeLabel(end)}`);
  });

  it('drops the end when both clocks are set but duration is empty', () => {
    const start = '2026-04-17T14:00:00.000Z';
    expect(
      sessionViewTimeLabel(
        session({
          startedAt: start,
          endedAt: start,
          clockStartExplicit: true,
          clockEndExplicit: true,
          clockTimesExplicit: true,
          durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration,
        }),
      ),
    ).toBe(formatSessionTimeLabel(start));
  });

  it('hides clocks when neither side is explicit', () => {
    expect(
      sessionViewTimeLabel(
        session({
          clockStartExplicit: false,
          clockEndExplicit: false,
          clockTimesExplicit: false,
          timeRangeLabel: '9:00 AM – 10:00 AM',
        }),
      ),
    ).toBeNull();
  });
});

describe('session duration completeness', () => {
  it('treats zero as missing and a short positive duration as usable', () => {
    expect(
      isSessionUsableForCompleteness(
        session({ durationLabel: JOB_DETAIL_EMPTY_LABELS.sessionDuration }),
      ),
    ).toBe(false);
    expect(
      isSessionUsableForCompleteness(session({ durationLabel: '<0.1h' })),
    ).toBe(true);
  });
});
