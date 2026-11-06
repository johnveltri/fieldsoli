const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  addCredentialAssociationToManifest,
  addCredentialAssociationToStrings,
} = require('./with-android-credential-association');

test('adds a single resource reference to the main Android application', () => {
  const manifest = { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } };

  addCredentialAssociationToManifest(manifest);
  addCredentialAssociationToManifest(manifest);

  assert.deepEqual(manifest.manifest.application[0]['meta-data'], [{
    $: {
      'android:name': 'asset_statements',
      'android:resource': '@string/asset_statements',
    },
  }]);
});

test('points Android credential providers at the production asset links file', () => {
  const strings = addCredentialAssociationToStrings({ resources: {} });
  const statement = strings.resources.string.find((item) => item.$.name === 'asset_statements');

  assert.equal(statement.$.translatable, 'false');
  assert.equal(statement._.replace(/\\"/g, '"'),
    '[{"include":"https://fieldsoli.com/.well-known/assetlinks.json"}]');
});
