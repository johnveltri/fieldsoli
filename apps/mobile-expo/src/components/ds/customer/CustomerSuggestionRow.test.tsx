import React from 'react';
import { render } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';

import { CustomerSuggestionRow } from './CustomerSuggestionRow';
import { createTextStyles } from '../../../theme/nativeTokens';

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

const suggestion = {
  customerId: 'customer-1',
  displayName: 'John Appleseed',
  phone: '8885555512',
  email: 'John-Appleseed@mac.com',
  serviceAddress: '1234 Laurel Street, Atlanta, GA, 30303',
};

function flattenStyle(style: unknown) {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map((entry) => flattenStyle(entry)));
  }
  return style as Record<string, unknown>;
}

describe('CustomerSuggestionRow', () => {
  it('renders the contact name with body typography', () => {
    const screen = render(
      <CustomerSuggestionRow
        typography={typography}
        suggestion={suggestion}
        onPress={() => undefined}
      />,
    );

    const name = screen.getByText('John Appleseed');
    const style = flattenStyle(name.props.style);

    expect(style.fontSize).toBe(typography.body.fontSize);
    expect(style.fontFamily).toBe(typography.body.fontFamily);
  });
});
