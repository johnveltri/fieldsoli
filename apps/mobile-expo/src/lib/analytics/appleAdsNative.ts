import { requireOptionalNativeModule } from 'expo';

export async function getAppleAdsToken(): Promise<string | null> {
  const native = requireOptionalNativeModule<{
    getAttributionToken(): Promise<string | null>;
  }>('FieldSoliAppleAds');
  return native ? native.getAttributionToken() : null;
}
