import { useEffect, useState } from 'react';

import { INVOICING_FLAG } from './constants';
import { isInvoicingDevOverrideEnabled } from './devOverrides';
import { fetchPostHogBooleanFlag } from './posthogFlags';

export type InvoicingFlagState = {
  enabled: boolean;
  ready: boolean;
};

export function useInvoicingFlag(userId: string | null | undefined): InvoicingFlagState {
  const devOverride = isInvoicingDevOverrideEnabled();
  const [enabled, setEnabled] = useState(devOverride);
  const [ready, setReady] = useState(devOverride);

  useEffect(() => {
    if (devOverride) {
      setEnabled(true);
      setReady(true);
      return;
    }

    const distinctId = (userId ?? '').trim();
    if (!distinctId) {
      setEnabled(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    setEnabled(false);

    void fetchPostHogBooleanFlag(INVOICING_FLAG, { distinctId }).then((value) => {
      if (cancelled) return;
      setEnabled(value);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [devOverride, userId]);

  return { enabled, ready };
}
