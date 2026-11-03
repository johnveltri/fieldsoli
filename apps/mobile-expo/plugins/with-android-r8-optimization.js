const { withAppBuildGradle } = require('@expo/config-plugins');

function enableOptimizedProguardDefaults(contents) {
  // Expo SDK 57's template uses the legacy defaults, which disable optimization.
  // Change only the default rule file; retain dependency and app keep rules.
  const defaults = /getDefaultProguardFile\((['"])proguard-android(?:-optimize)?\.txt\1\)/g;
  if (!defaults.test(contents)) {
    throw new Error('Cannot enable R8 optimization: Android template has no recognized ProGuard defaults.');
  }
  return contents.replace(defaults, 'getDefaultProguardFile("proguard-android-optimize.txt")');
}

module.exports = function withAndroidR8Optimization(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('R8 optimization plugin requires a Groovy app/build.gradle.');
    }
    config.modResults.contents = enableOptimizedProguardDefaults(config.modResults.contents);
    return config;
  });
};

module.exports.enableOptimizedProguardDefaults = enableOptimizedProguardDefaults;
