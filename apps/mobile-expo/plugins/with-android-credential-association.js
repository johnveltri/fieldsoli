const { AndroidConfig, withAndroidManifest, withStringsXml } = require('@expo/config-plugins');

const ASSET_STATEMENTS_NAME = 'asset_statements';
const ASSET_STATEMENTS_RESOURCE = '@string/asset_statements';
const ASSET_LINKS_URL = 'https://fieldsoli.com/.well-known/assetlinks.json';

function addCredentialAssociationToManifest(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const metadata = application['meta-data'] ?? [];
  const statement = metadata.find((item) => item.$?.['android:name'] === ASSET_STATEMENTS_NAME);
  if (statement) {
    statement.$['android:resource'] = ASSET_STATEMENTS_RESOURCE;
    delete statement.$['android:value'];
  } else {
    metadata.push({
      $: {
        'android:name': ASSET_STATEMENTS_NAME,
        'android:resource': ASSET_STATEMENTS_RESOURCE,
      },
    });
  }
  application['meta-data'] = metadata;
  return manifest;
}

function addCredentialAssociationToStrings(strings) {
  // Android string resources require escaped quotes around JSON keys and values.
  const value = JSON.stringify([{ include: ASSET_LINKS_URL }]).replace(/"/g, '\\"');
  return AndroidConfig.Strings.setStringItem(
    [{ $: { name: ASSET_STATEMENTS_NAME, translatable: 'false' }, _: value }],
    strings,
  );
}

module.exports = function withAndroidCredentialAssociation(config) {
  config = withAndroidManifest(config, (config) => {
    config.modResults = addCredentialAssociationToManifest(config.modResults);
    return config;
  });
  return withStringsXml(config, (config) => {
    config.modResults = addCredentialAssociationToStrings(config.modResults);
    return config;
  });
};

module.exports.addCredentialAssociationToManifest = addCredentialAssociationToManifest;
module.exports.addCredentialAssociationToStrings = addCredentialAssociationToStrings;
