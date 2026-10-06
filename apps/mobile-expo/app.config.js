const { validateReleaseEnvironment } = require('./release-env');

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  // Expo/EAS loads environment variables before evaluating dynamic config.
  // Refuse accidental local-to-production connections and mismatched store
  // build configuration before native build or Metro bundling begins.
  validateReleaseEnvironment(process.env);

  const app = require('./app.json').expo;
  return {
    ...app,
    ...config,
    plugins: [
      ...(app.plugins ?? []),
      'expo-mail-composer',
      ['expo-sharing', { ios: { enabled: false }, android: { enabled: false } }],
    ],
  };
};
