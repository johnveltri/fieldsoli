import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const template = readFileSync(new URL('../confirmation.html', import.meta.url), 'utf8');
// Exercise this template's metadata conditional, not the hosted Go renderer.
// Provider rendering and token consumption remain integration release checks.
function renderBranch(hasSignupMetadata) {
  return template.replace(/{{ if \.Data\.signup_legal_v1 }}([\s\S]*?){{ else }}([\s\S]*?){{ end }}/g,
    (_, current, legacy) => hasSignupMetadata ? current : legacy);
}
for (const hasSignupMetadata of [false, true]) {
  test(`confirmation link remains available with signup metadata=${hasSignupMetadata}`, () => {
    const output = renderBranch(hasSignupMetadata);
    assert.doesNotMatch(output, /{{\s*(?:if|else|end)\b/);
    assert.match(output, /href="{{ \.ConfirmationURL }}"/);
    assert.match(output, /Confirm email/);
    if (hasSignupMetadata) assert.match(output, /{{ \.Token }}/);
    else assert.doesNotMatch(output, /{{ \.Token }}/);
  });
}
