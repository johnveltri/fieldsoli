const assert = require('node:assert/strict');
const { test } = require('node:test');
const { enableOptimizedProguardDefaults } = require('./with-android-r8-optimization');

test('replaces legacy defaults while preserving app rules and release switches', () => {
  for (const quote of ['"', "'"]) {
    const input = `minifyEnabled enableMinifyInReleaseBuilds
shrinkResources enableShrinkResources.toBoolean()
proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"`;
    assert.equal(
      enableOptimizedProguardDefaults(input),
      input.replace(`getDefaultProguardFile(${quote}proguard-android.txt${quote})`,
        'getDefaultProguardFile("proguard-android-optimize.txt")'),
    );
  }
});

test('repeated prebuilds retain optimized defaults', () => {
  const input = 'proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"';
  assert.equal(enableOptimizedProguardDefaults(enableOptimizedProguardDefaults(input)), input);
});

test('fails visibly when an upgraded template no longer matches', () => {
  assert.throws(() => enableOptimizedProguardDefaults('proguardFiles "custom.pro"'),
    /no recognized ProGuard defaults/);
});
