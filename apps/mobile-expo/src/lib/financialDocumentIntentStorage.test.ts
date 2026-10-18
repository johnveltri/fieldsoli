import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  clearFinancialDocumentIntent,
  readFinancialDocumentIntent,
  writeFinancialDocumentIntent,
} from './financialDocumentIntentStorage';

describe('financial document intent storage', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
  });

  it('retains the exact create request under its owner and Job scope', async () => {
    const intent = {
      kind: 'create' as const,
      requestKey: 'request-1',
      jobId: 'job-1',
      type: 'invoice' as const,
      fingerprint: 'source-1',
      timezone: 'America/Chicago',
      confirmedPaidTotalCents: 12000,
    };
    await writeFinancialDocumentIntent('owner-1', 'job-1', intent);

    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toEqual(intent);
    await expect(readFinancialDocumentIntent('owner-2', 'job-1')).resolves.toBeNull();
    await expect(readFinancialDocumentIntent('owner-1', 'job-2')).resolves.toBeNull();
  });

  it('retains finalization inputs and removes the intent after resolution', async () => {
    const intent = {
      kind: 'finalize' as const,
      requestKey: 'request-2',
      jobId: 'job-1',
      status: 'paid' as const,
      documentId: 'document-1',
      fingerprint: null,
      timezone: 'America/Chicago',
      confirmedPaidTotalCents: 12000,
    };
    await writeFinancialDocumentIntent('owner-1', 'job-1', intent);
    await clearFinancialDocumentIntent('owner-1', 'job-1', intent.requestKey);

    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toBeNull();
  });

  it('does not clear a newer intent when an older mounted control resolves', async () => {
    const newer = {
      kind: 'create' as const,
      requestKey: 'newer-request',
      jobId: 'job-1',
      type: 'estimate' as const,
      fingerprint: 'newer-source',
      timezone: 'America/Chicago',
      confirmedPaidTotalCents: null,
    };
    await writeFinancialDocumentIntent('owner-1', 'job-1', newer);
    await clearFinancialDocumentIntent('owner-1', 'job-1', 'older-request');

    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toEqual(newer);
  });

  it('serializes a write that races with an in-flight compare-and-clear', async () => {
    const originalMultiGet = AsyncStorage.multiGet.bind(AsyncStorage);
    let releaseRead!: () => void;
    let reportRead!: () => void;
    const readStarted = new Promise<void>((resolve) => { reportRead = resolve; });
    const pauseRead = new Promise<void>((resolve) => { releaseRead = resolve; });
    const oldIntent = {
      kind: 'create' as const,
      requestKey: 'old-request',
      jobId: 'job-1',
      type: 'estimate' as const,
      fingerprint: 'old-source',
      timezone: 'America/Chicago',
      confirmedPaidTotalCents: null,
    };
    const newIntent = { ...oldIntent, requestKey: 'new-request', fingerprint: 'new-source' };
    await writeFinancialDocumentIntent('owner-1', 'job-1', oldIntent);
    let delayNextRead = true;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      const [[, value]] = await originalMultiGet([key]);
      if (delayNextRead && key.includes('owner-1:job-1')) {
        delayNextRead = false;
        reportRead();
        await pauseRead;
      }
      return value;
    });

    const clearing = clearFinancialDocumentIntent('owner-1', 'job-1', oldIntent.requestKey);
    await readStarted;
    const writing = writeFinancialDocumentIntent('owner-1', 'job-1', newIntent);
    releaseRead();
    await Promise.all([clearing, writing]);

    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toEqual(newIntent);
  });

  it('refuses to replace a different unresolved request', async () => {
    const first = {
      kind: 'create' as const,
      requestKey: 'first-request',
      jobId: 'job-1',
      type: 'estimate' as const,
      fingerprint: 'first-source',
      timezone: 'America/Chicago',
      confirmedPaidTotalCents: null,
    };
    const second = { ...first, requestKey: 'second-request', fingerprint: 'second-source' };
    await writeFinancialDocumentIntent('owner-1', 'job-1', first);

    await expect(writeFinancialDocumentIntent('owner-1', 'job-1', second)).rejects.toThrow('financial_document_intent_pending');
    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toEqual(first);
  });

  it('drops malformed persisted data safely', async () => {
    await AsyncStorage.setItem('fieldsolo.financial-document-intent.v1:owner-1:job-1', '{bad json');
    await expect(readFinancialDocumentIntent('owner-1', 'job-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('fieldsolo.financial-document-intent.v1:owner-1:job-1')).resolves.toBeNull();
  });
});
