import { render, screen } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';

import { SheetChromeContext } from './sheetChromeContext';
import { FullWidthFab } from './FullWidthFab';
import { createTextStyles } from '../../theme/nativeTokens';

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

describe('FullWidthFab', () => {
  it('uses the home-indicator inset when the keyboard is down', () => {
    render(<FullWidthFab typography={typography} label="END SESSION" includeSafeArea />);
    expect(StyleSheet.flatten(screen.getByTestId('full-width-fab').props.style).paddingBottom).toBe(34);
  });

  it('drops the home-indicator inset while the keyboard covers the safe area', () => {
    render(
      <SheetChromeContext.Provider
        value={{
          keyboardCoversSafeArea: true,
          keyboardReservedHeight: 336,
          stickyFooterHeight: 120,
        }}
      >
        <FullWidthFab typography={typography} label="END SESSION" includeSafeArea />
      </SheetChromeContext.Provider>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('full-width-fab').props.style).paddingBottom).toBe(0);
  });
});
