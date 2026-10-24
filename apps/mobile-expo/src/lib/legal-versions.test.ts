import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import {
  REQUIRED_PRIVACY_VERSION,
  REQUIRED_TERMS_VERSION,
} from './legal-versions';
import { needsLegalReacceptance } from '@fieldsolo/api-client';

const privacyMarkdown = readFileSync(
  path.resolve(__dirname, '../../../../docs/legal/privacy-policy.md'),
  'utf8',
);
const termsMarkdown = readFileSync(
  path.resolve(__dirname, '../../../../docs/legal/terms.md'),
  'utf8',
);

describe('legal document versions', () => {
  it('requires the normal gate for the prior privacy version and accepts the current one', () => {
    const required = { privacyVersion: REQUIRED_PRIVACY_VERSION, termsVersion: REQUIRED_TERMS_VERSION };
    expect(needsLegalReacceptance({ privacyPolicyVersion: '2026-09-20', termsVersion: REQUIRED_TERMS_VERSION }, required)).toBe(true);
    expect(needsLegalReacceptance({ privacyPolicyVersion: REQUIRED_PRIVACY_VERSION, termsVersion: REQUIRED_TERMS_VERSION }, required)).toBe(false);
  });
  it('matches the canonical privacy policy version', () => {
    const markdownVersion = privacyMarkdown.match(/\*\*Policy version:\*\* ([\d-]+)/)?.[1];
    expect(REQUIRED_PRIVACY_VERSION).toBe(markdownVersion);
  });

  it('matches the canonical terms version', () => {
    const markdownVersion = termsMarkdown.match(/\*\*Terms version:\*\* ([\d-]+)/)?.[1];
    expect(REQUIRED_TERMS_VERSION).toBe(markdownVersion);
  });
});
