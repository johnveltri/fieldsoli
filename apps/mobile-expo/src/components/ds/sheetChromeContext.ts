import { createContext, useContext } from 'react';

export type SheetChromeContextValue = {
  /** True when an on-screen IME covers the home-indicator inset. */
  keyboardCoversSafeArea: boolean;
  /** Keyboard frame height from show/change-frame events (includes QuickType). */
  keyboardReservedHeight: number;
  /** Measured sticky footer height, or 0 when the sheet has none. */
  stickyFooterHeight: number;
};

const DEFAULT_SHEET_CHROME: SheetChromeContextValue = {
  keyboardCoversSafeArea: false,
  keyboardReservedHeight: 0,
  stickyFooterHeight: 0,
};

export const SheetChromeContext = createContext<SheetChromeContextValue>(DEFAULT_SHEET_CHROME);

export function useSheetChrome(): SheetChromeContextValue {
  return useContext(SheetChromeContext);
}
