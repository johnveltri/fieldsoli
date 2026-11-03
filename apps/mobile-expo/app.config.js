const { validateReleaseEnvironment } = require('./release-env');

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  // Expo/EAS loads environment variables before evaluating dynamic config.
  // Refuse accidental local-to-production connections and mismatched store
  // build configuration before native build or Metro bundling begins.
  validateReleaseEnvironment(process.env);

  const app = require('./app.json').expo;
  // Expo Go cannot execute the native Android landscape config plugin. Opt
  // this local tablet preview into rotation without changing release defaults.
  const tabletPreview =
    process.env.FIELDSOLI_ANDROID_TABLET_PREVIEW === 'true'
    && process.env.EXPO_PUBLIC_APP_ENV === 'development'
    && process.env.EAS_BUILD !== 'true'
    && process.env.FIELDSOLO_RELEASE_EXPORT !== 'true';
  return {
    ...app,
    ...config,
    orientation: tabletPreview ? 'default' : app.orientation,
    plugins: [
      ...(app.plugins ?? []),
      'expo-mail-composer',
      ['expo-sharing', { ios: { enabled: false }, android: { enabled: false } }],
    ],
  };
};
