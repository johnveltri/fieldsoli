import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlOnly = process.argv.includes('--html-only');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function valuesForAttribute(html, attribute) {
  return [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((match) => match[1]);
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

const htmlPath = 'docs/product/current-product.html';
const html = await readFile(path.join(root, htmlPath), 'utf8');
check(/^<!doctype html>/i.test(html), 'current-product.html must begin with an HTML doctype');
check(!/<script\b/i.test(html), 'current-product.html must not contain JavaScript');
check(!/<link\b[^>]*rel=["']?stylesheet/i.test(html), 'current-product.html must not use external stylesheets');
check(!/@import\s/i.test(html), 'current-product.html must not import remote CSS');
check(!/<(?:img|source)\b[^>]*\bsrc=["']https?:/i.test(html), 'current-product.html must not load remote images');
check(!/\`\`\`/.test(html), 'current-product.html must not contain Markdown code fences');

const requiredMeta = {
  'fieldsolo-source-commit': '50822e52f3c1b1e3ba758e02a875d624d2983024',
  'fieldsolo-reviewed-at': '2026-07-21',
  'fieldsolo-product-version': '2026.07.21',
};
for (const [name, value] of Object.entries(requiredMeta)) {
  check(
    new RegExp(`<meta\\s+name="${name}"\\s+content="${value}"`).test(html),
    `missing or incorrect meta ${name}`,
  );
}

for (const status of ['shipped', 'approved-not-shipped', 'exploring']) {
  check(html.includes(`data-status="${status}"`), `missing explicit ${status} container`);
}

const indexMatch = html.match(/<pre id="fieldsolo-product-index">([\s\S]*?)<\/pre>/);
check(Boolean(indexMatch), 'missing visible fieldsolo-product-index');
let productIndex = null;
if (indexMatch) {
  try {
    productIndex = JSON.parse(indexMatch[1]);
  } catch (error) {
    failures.push(`fieldsolo-product-index is not valid JSON: ${error.message}`);
  }
}

if (productIndex) {
  const visibleScreenIds = [
    ...valuesForAttribute(html, 'data-screen-id'),
    ...valuesForAttribute(html, 'data-state-id'),
  ];
  const indexedScreenIds = productIndex.screens.map((screen) => screen.id);
  const visibleCapabilityIds = valuesForAttribute(html, 'data-capability-id');
  const indexedCapabilityIds = productIndex.capabilities.map((capability) => capability.id);
  check(duplicates(visibleScreenIds).length === 0, `duplicate visible screen/state IDs: ${duplicates(visibleScreenIds).join(', ')}`);
  check(duplicates(indexedScreenIds).length === 0, `duplicate indexed screen IDs: ${duplicates(indexedScreenIds).join(', ')}`);
  check(duplicates(visibleCapabilityIds).length === 0, `duplicate visible capability IDs: ${duplicates(visibleCapabilityIds).join(', ')}`);
  check(duplicates(indexedCapabilityIds).length === 0, `duplicate indexed capability IDs: ${duplicates(indexedCapabilityIds).join(', ')}`);
  check(
    JSON.stringify([...visibleScreenIds].sort()) === JSON.stringify([...indexedScreenIds].sort()),
    'visible screen/state IDs must exactly match the JSON index',
  );
  check(
    JSON.stringify([...visibleCapabilityIds].sort()) === JSON.stringify([...indexedCapabilityIds].sort()),
    'visible capability IDs must exactly match the JSON index',
  );
  check(productIndex.screens.every((screen) => screen.status === 'shipped'), 'every indexed current screen must be shipped');
  check(productIndex.capabilities.every((capability) => capability.status === 'shipped'), 'every indexed current capability must be shipped');
}

if (!htmlOnly) {
  // Figma is a historical reference; routine validation uses local ChatGPT assets only.
  for (const pngPath of [
    'docs/product/chatgpt/fieldsolo-core-screens.png',
    'docs/product/chatgpt/fieldsolo-states-and-overlays.png',
  ]) {
    check(await exists(pngPath), `missing ChatGPT atlas: ${pngPath}`);
    if (await exists(pngPath)) {
      const bytes = await readFile(path.join(root, pngPath));
      check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${pngPath} is not a PNG`);
    }
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(htmlOnly ? 'Product HTML validation passed.' : 'Design and product-context validation passed.');
