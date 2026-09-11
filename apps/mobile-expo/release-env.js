const LOCAL_BACKEND_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '10.0.2.2']);
const PRODUCTION_SUPABASE_PROJECT_REF = 'gfvqmxsiuhhujnckghpa';
const STAGING_SUPABASE_PROJECT_REF = 'anypejjoovlatmrkrxvx';
const APP_ENVIRONMENTS = new Set(['development', 'staging', 'production']);

function hostedSupabaseProjectRef(url) {
  const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * Local development must not silently target production, and store builds must
 * use the exact production backend plus privacy-safe analytics flags.
 */
function validateReleaseEnvironment(env = process.env) {
  const isProductionBuild =
    env.EAS_BUILD === 'true'
    || env.FIELDSOLO_RELEASE_EXPORT === 'true';
  const appEnvironment = (env.EXPO_PUBLIC_APP_ENV || 'development').trim();

  if (!APP_ENVIRONMENTS.has(appEnvironment)) {
    throw new Error(
      'EXPO_PUBLIC_APP_ENV must be development, staging, or production.',
    );
  }

  if (isProductionBuild && appEnvironment !== 'production') {
    throw new Error(
      'Production builds require EXPO_PUBLIC_APP_ENV=production.',
    );
  }

  const rawUrl = (env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  if (!rawUrl) {
    if (isProductionBuild || appEnvironment !== 'development') {
      throw new Error(
        `${appEnvironment} requires EXPO_PUBLIC_SUPABASE_URL.`,
      );
    }
    return;
  }

  let backendUrl;
  try {
    backendUrl = new URL(rawUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a valid URL.');
  }

  const hostedProjectRef = hostedSupabaseProjectRef(backendUrl);
  if (
    appEnvironment !== 'production'
    && hostedProjectRef === PRODUCTION_SUPABASE_PROJECT_REF
  ) {
    throw new Error(
      'Non-production development cannot use the production Supabase project. '
        + 'Run `npm run local:setup` to restore local Supabase.',
    );
  }

  if (
    appEnvironment === 'staging'
    && hostedProjectRef !== STAGING_SUPABASE_PROJECT_REF
  ) {
    throw new Error(
      `Staging must use Supabase project ${STAGING_SUPABASE_PROJECT_REF}.`,
    );
  }

  if (!isProductionBuild && appEnvironment !== 'production') return;

  if (
    backendUrl.protocol !== 'https:'
    || LOCAL_BACKEND_HOSTS.has(backendUrl.hostname)
  ) {
    throw new Error(
      'Production builds must use an HTTPS hosted Supabase URL, not a local backend.',
    );
  }

  if (hostedProjectRef !== PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(
      `Production builds must use Supabase project ${PRODUCTION_SUPABASE_PROJECT_REF}.`,
    );
  }

  if (!(env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim()) {
    throw new Error(
      'Production builds require EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  if (env.EXPO_PUBLIC_ANALYTICS_DEBUG_RICH !== 'false') {
    throw new Error(
      'Production builds require EXPO_PUBLIC_ANALYTICS_DEBUG_RICH=false.',
    );
  }

  if (env.EXPO_PUBLIC_ANALYTICS_PROVIDER !== 'posthog') {
    throw new Error('Production builds require EXPO_PUBLIC_ANALYTICS_PROVIDER=posthog.');
  }

  if (!(env.EXPO_PUBLIC_POSTHOG_KEY || '').trim()) {
    throw new Error('Production builds require EXPO_PUBLIC_POSTHOG_KEY.');
  }
}

module.exports = {
  PRODUCTION_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
  validateReleaseEnvironment,
};
