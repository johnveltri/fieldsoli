import AsyncStorage from '@react-native-async-storage/async-storage';

type CreateIntent = {
  kind: 'create';
  requestKey: string;
  jobId: string;
  type: 'estimate' | 'invoice';
  fingerprint: string;
  timezone: string;
  confirmedPaidTotalCents: number | null;
};

type FinalizeIntent = {
  kind: 'finalize';
  requestKey: string;
  jobId: string;
  status: 'completed' | 'paid';
  documentId: string | null;
  fingerprint: string | null;
  timezone: string;
  confirmedPaidTotalCents: number | null;
};

export type FinancialDocumentIntent = CreateIntent | FinalizeIntent;

const storageKey = (ownerId: string, jobId: string) =>
  `fieldsolo.financial-document-intent.v1:${ownerId}:${jobId}`;

let storageQueue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(() => undefined, () => undefined);
  return result;
}

function parseIntent(value: unknown, ownerJobId: string): FinancialDocumentIntent | null {
  if (!value || typeof value !== 'object') return null;
  const intent = value as Partial<FinancialDocumentIntent>;
  if (intent.jobId !== ownerJobId || typeof intent.requestKey !== 'string') return null;
  if (intent.kind === 'create') {
    if (
      (intent.type !== 'estimate' && intent.type !== 'invoice') ||
      typeof intent.fingerprint !== 'string' ||
      typeof intent.timezone !== 'string' ||
      (intent.confirmedPaidTotalCents !== null &&
        (typeof intent.confirmedPaidTotalCents !== 'number' || !Number.isFinite(intent.confirmedPaidTotalCents)))
    ) return null;
    return intent as CreateIntent;
  }
  if (intent.kind === 'finalize') {
    if (
      (intent.status !== 'completed' && intent.status !== 'paid') ||
      typeof intent.timezone !== 'string' ||
      (intent.documentId !== null && typeof intent.documentId !== 'string') ||
      (intent.fingerprint !== null && typeof intent.fingerprint !== 'string') ||
      (intent.confirmedPaidTotalCents !== null &&
        (typeof intent.confirmedPaidTotalCents !== 'number' || !Number.isFinite(intent.confirmedPaidTotalCents)))
    ) return null;
    return intent as FinalizeIntent;
  }
  return null;
}

export async function readFinancialDocumentIntent(
  ownerId: string,
  jobId: string,
): Promise<FinancialDocumentIntent | null> {
  return serialize(async () => {
    const key = storageKey(ownerId, jobId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = parseIntent(JSON.parse(raw), jobId);
      if (!parsed) await AsyncStorage.removeItem(key);
      return parsed;
    } catch {
      await AsyncStorage.removeItem(key);
      return null;
    }
  });
}

export async function writeFinancialDocumentIntent(
  ownerId: string,
  jobId: string,
  intent: FinancialDocumentIntent,
): Promise<void> {
  if (intent.jobId !== jobId) throw new Error('financial_document_intent_job_mismatch');
  await serialize(async () => {
    const key = storageKey(ownerId, jobId);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      let current: FinancialDocumentIntent | null = null;
      try { current = parseIntent(JSON.parse(raw), jobId); } catch { /* replace corrupt state */ }
      if (current && current.requestKey !== intent.requestKey) {
        throw new Error('financial_document_intent_pending');
      }
      if (current && JSON.stringify(current) !== JSON.stringify(intent)) {
        throw new Error('financial_document_intent_key_reused');
      }
    }
    await AsyncStorage.setItem(key, JSON.stringify(intent));
  });
}

export async function clearFinancialDocumentIntent(
  ownerId: string,
  jobId: string,
  expectedRequestKey: string,
): Promise<boolean> {
  return serialize(async () => {
    const key = storageKey(ownerId, jobId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return true;
    try {
      const current = JSON.parse(raw) as { requestKey?: unknown };
      if (current.requestKey !== expectedRequestKey) return false;
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      // Leave malformed data for readFinancialDocumentIntent to clear safely.
      return false;
    }
  });
}
