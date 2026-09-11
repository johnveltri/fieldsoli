import { describe, expect, it, vi } from 'vitest';

import {
  createLiveSession,
  endLiveSession,
  fetchActiveLiveSessionForCurrentUser,
  updateLiveSessionStart,
} from './liveSessions';
import { makeBuilder, makeClient } from './testUtils';

describe('live sessions api client', () => {
  describe('createLiveSession', () => {
    it('inserts an in_progress live session and returns hydrated payload', async () => {
      let inserted: unknown;
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({
              onInsert: (payload) => {
                inserted = payload;
              },
              singleResult: {
                data: { id: 'sess-live-1' },
                error: null,
              },
            }),
          ],
          jobs: [makeBuilder({ awaitResult: { data: null, error: null } })],
        },
      });

      const result = await createLiveSession(client as never, {
        jobId: 'job-9',
        jobShortDescription: 'Bathroom remodel phase 1',
        startedAt: '2026-04-25T15:00:00.000Z',
        startedTz: 'America/Chicago',
      });

      expect(inserted).toEqual({
        job_id: 'job-9',
        user_id: 'user-1',
        entry_mode: 'live',
        session_status: 'in_progress',
        started_at: '2026-04-25T15:00:00.000Z',
        started_tz: 'America/Chicago',
        clock_start_explicit: true,
        clock_times_explicit: true,
        calendar_date_explicit: true,
      });
      expect(result).toEqual({
        id: 'sess-live-1',
        jobId: 'job-9',
        startedAt: '2026-04-25T15:00:00.000Z',
        startedTz: 'America/Chicago',
        jobShortDescription: 'Bathroom remodel phase 1',
      });
    });

    it('falls back to device timezone when startedTz omitted', async () => {
      let inserted: { started_tz?: string } | undefined;
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({
              onInsert: (payload) => {
                inserted = payload as { started_tz?: string };
              },
              singleResult: {
                data: { id: 'sess-live-1' },
                error: null,
              },
            }),
          ],
          jobs: [makeBuilder({ awaitResult: { data: null, error: null } })],
        },
      });

      const result = await createLiveSession(client as never, {
        jobId: 'job-9',
        jobShortDescription: 'Bathroom remodel phase 1',
        startedAt: '2026-04-25T15:00:00.000Z',
      });

      expect(typeof inserted?.started_tz).toBe('string');
      expect((inserted?.started_tz ?? '').length).toBeGreaterThan(0);
      expect(result.jobShortDescription).toBe('Bathroom remodel phase 1');
      expect(result.startedTz.length).toBeGreaterThan(0);
    });

    it('retries without started_tz when the column does not yet exist', async () => {
      const inserts: unknown[] = [];
      // First builder => undefined_column on started_tz; second => success.
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({
              onInsert: (payload) => {
                inserts.push(payload);
              },
              singleResult: {
                data: null,
                error: {
                  code: '42703',
                  message:
                    'Could not find the \'started_tz\' column of \'sessions\' in the schema cache',
                },
              },
            }),
            makeBuilder({
              onInsert: (payload) => {
                inserts.push(payload);
              },
              singleResult: {
                data: { id: 'sess-live-fallback' },
                error: null,
              },
            }),
          ],
          jobs: [makeBuilder({ awaitResult: { data: null, error: null } })],
        },
      });

      const result = await createLiveSession(client as never, {
        jobId: 'job-9',
        jobShortDescription: 'Repipe master bath',
        startedAt: '2026-04-25T15:00:00.000Z',
        startedTz: 'America/Chicago',
      });

      expect(inserts).toHaveLength(2);
      expect(inserts[0]).toMatchObject({ started_tz: 'America/Chicago' });
      expect(inserts[1]).not.toHaveProperty('started_tz');
      expect(result.id).toBe('sess-live-fallback');
      // We still return the requested timezone in the local payload so the
      // bar / counter render correctly even though the column is absent.
      expect(result.startedTz).toBe('America/Chicago');
    });

    it('returns the created live session when the status bump fails', async () => {
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({
              singleResult: {
                data: { id: 'sess-live-1' },
                error: null,
              },
            }),
          ],
          jobs: [
            makeBuilder({
              awaitResult: { data: null, error: new Error('status bump failed') },
            }),
          ],
        },
      });

      await expect(
        createLiveSession(client as never, {
          jobId: 'job-9',
          jobShortDescription: 'Bathroom remodel phase 1',
          startedAt: '2026-04-25T15:00:00.000Z',
          startedTz: 'America/Chicago',
        }),
      ).resolves.toEqual({
        id: 'sess-live-1',
        jobId: 'job-9',
        startedAt: '2026-04-25T15:00:00.000Z',
        startedTz: 'America/Chicago',
        jobShortDescription: 'Bathroom remodel phase 1',
      });
    });

    it('throws when no authenticated user exists', async () => {
      const client = makeClient({
        authUserId: null,
        buildersByTable: { sessions: [] },
      });

      await expect(
        createLiveSession(client as never, {
          jobId: 'job-9',
          jobShortDescription: 'Bathroom remodel phase 1',
        }),
      ).rejects.toThrow('No authenticated user available to start a live session.');
    });
  });

  describe('fetchActiveLiveSessionForCurrentUser', () => {
    it('returns hydrated payload when an in_progress row exists', async () => {
      const builder = makeBuilder({
        maybeSingleResult: {
          data: {
            id: 'sess-live-2',
            job_id: 'job-7',
            started_at: '2026-04-25T13:00:00.000Z',
            started_tz: 'America/Los_Angeles',
            jobs: { short_description: 'Repipe master bath' },
          },
          error: null,
        },
      });
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: { sessions: [builder] },
      });

      const result = await fetchActiveLiveSessionForCurrentUser(client as never);

      expect(result).toEqual({
        id: 'sess-live-2',
        jobId: 'job-7',
        startedAt: '2026-04-25T13:00:00.000Z',
        startedTz: 'America/Los_Angeles',
        jobShortDescription: 'Repipe master bath',
      });
      expect((builder.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'session_status',
        'in_progress',
      );
      expect((builder.select as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'id, job_id, started_at, started_tz, jobs!sessions_job_owner_fkey(short_description)',
      );
      expect((builder.is as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'deleted_at',
        null,
      );
    });

    it('retries without started_tz when the column does not yet exist', async () => {
      const builderFail = makeBuilder({
        maybeSingleResult: {
          data: null,
          error: {
            code: '42703',
            message: 'column sessions.started_tz does not exist',
          },
        },
      });
      const builderOk = makeBuilder({
        maybeSingleResult: {
          data: {
            id: 'sess-live-fallback',
            job_id: 'job-7',
            started_at: '2026-04-25T13:00:00.000Z',
            jobs: { short_description: 'Repipe master bath' },
          },
          error: null,
        },
      });
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: { sessions: [builderFail, builderOk] },
      });

      const result = await fetchActiveLiveSessionForCurrentUser(client as never);

      expect(result?.id).toBe('sess-live-fallback');
      expect((builderOk.select as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'id, job_id, started_at, jobs!sessions_job_owner_fkey(short_description)',
      );
      // Falls back to a non-empty device timezone string.
      expect(result?.startedTz?.length ?? 0).toBeGreaterThan(0);
    });

    it('returns null when no row matches', async () => {
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({ maybeSingleResult: { data: null, error: null } }),
          ],
        },
      });

      const result = await fetchActiveLiveSessionForCurrentUser(client as never);
      expect(result).toBeNull();
    });

    it('returns null when no user is signed in', async () => {
      const client = makeClient({
        authUserId: null,
        buildersByTable: { sessions: [] },
      });

      const result = await fetchActiveLiveSessionForCurrentUser(client as never);
      expect(result).toBeNull();
    });
  });

  describe('endLiveSession', () => {
    it('sets session_status to ended and stamps ended_at', async () => {
      let patch: { session_status?: string; ended_at?: string } | undefined;
      const builder = makeBuilder({
        onUpdate: (value) => {
          patch = value as typeof patch;
        },
        maybeSingleResult: { data: { id: 'sess-live-3' }, error: null },
      });
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: { sessions: [builder] },
      });

      await endLiveSession(client as never, 'sess-live-3', {
        endedAt: '2026-04-25T16:00:00.000Z',
      });

      expect(patch).toEqual({
        session_status: 'ended',
        ended_at: '2026-04-25T16:00:00.000Z',
        clock_end_explicit: true,
        clock_times_explicit: true,
      });
      expect((builder.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'session_status',
        'in_progress',
      );
    });

    it('does not throw when the session has already been ended (no row updated)', async () => {
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({ maybeSingleResult: { data: null, error: null } }),
          ],
        },
      });

      await expect(
        endLiveSession(client as never, 'sess-live-3'),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateLiveSessionStart', () => {
    it('updates started_at and validates ISO input', async () => {
      let patch: { started_at?: string } | undefined;
      const builder = makeBuilder({
        onUpdate: (value) => {
          patch = value as typeof patch;
        },
        maybeSingleResult: { data: { id: 'sess-live-4' }, error: null },
      });
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: { sessions: [builder] },
      });

      await updateLiveSessionStart(client as never, 'sess-live-4', {
        startedAt: '2026-04-25T12:30:00.000Z',
      });

      expect(patch).toEqual({
        started_at: '2026-04-25T12:30:00.000Z',
        clock_start_explicit: true,
        clock_times_explicit: true,
        calendar_date_explicit: true,
      });
    });

    it('rejects invalid timestamps', async () => {
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({ maybeSingleResult: { data: null, error: null } }),
          ],
        },
      });

      await expect(
        updateLiveSessionStart(client as never, 'sess-live-4', {
          startedAt: 'not-a-date',
        }),
      ).rejects.toThrow('startedAt must be a valid ISO timestamp.');
    });

    it('throws when no in-progress row matches', async () => {
      const client = makeClient({
        authUserId: 'user-1',
        buildersByTable: {
          sessions: [
            makeBuilder({ maybeSingleResult: { data: null, error: null } }),
          ],
        },
      });

      await expect(
        updateLiveSessionStart(client as never, 'sess-live-4', {
          startedAt: '2026-04-25T12:30:00.000Z',
        }),
      ).rejects.toThrow(
        'Update affected no in-progress rows (session may have ended already).',
      );
    });
  });
});
