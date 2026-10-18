import React from 'react';
import { render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrimaryActionOverlay } from './PrimaryActionOverlay';

let mockProfileOpen = false;
jest.mock('../../shell/ShellOverlayContext', () => ({
  useShellOverlays: () => ({ profileOpen: mockProfileOpen }),
}));
jest.mock('../../shell/ShellChromeContext', () => ({
  useShellChromeOptional: () => ({ hideBottomChrome: false }),
}));
jest.mock('../../shell/QuickActionsFlowContext', () => ({
  useQuickActionsFlow: () => ({
    creatingJob: false,
    handlePrimaryAction: jest.fn(),
  }),
}));
jest.mock('../../context/LiveSessionContext', () => ({
  useHasLiveSession: () => false,
}));
jest.mock('../platform/PlatformPrimaryAction', () => ({
  PlatformPrimaryAction: () => null,
}));

describe('PrimaryActionOverlay', () => {
  beforeEach(() => {
    mockProfileOpen = false;
  });
  it('removes the global FAB while Profile is open and restores it afterward', () => {
    const screen = render(<PrimaryActionOverlay />);
    expect(screen.getByTestId('primary-action-overlay')).toBeTruthy();
    mockProfileOpen = true;
    screen.rerender(<PrimaryActionOverlay />);
    expect(screen.queryByTestId('primary-action-overlay')).toBeNull();
    mockProfileOpen = false;
    screen.rerender(<PrimaryActionOverlay />);
    expect(screen.getByTestId('primary-action-overlay')).toBeTruthy();
  });
});
