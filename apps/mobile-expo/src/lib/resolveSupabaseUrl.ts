/** Hosts that mean “this machine” on iOS Simulator / Metro, but the emulator itself on Android. */
const LOCAL_BACKEND_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Android emulator alias for the host loopback interface. */
const ANDROID_EMULATOR_HOST_LOOPBACK = '10.0.2.2';

/**
 * Android emulators cannot reach the host via 127.0.0.1. Rewrite local
 * Supabase URLs to 10.0.2.2 so Expo Go on an AVD can talk to `supabase start`.
 * iOS Simulator shares the host network, so those URLs stay unchanged.
 */
export function resolveSupabaseUrlForPlatform(
  rawUrl: string,
  platform: string,
): string {
  if (platform !== 'android' || rawUrl.length === 0) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    if (!LOCAL_BACKEND_HOSTS.has(host)) return rawUrl;
    parsed.hostname = ANDROID_EMULATOR_HOST_LOOPBACK;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}
