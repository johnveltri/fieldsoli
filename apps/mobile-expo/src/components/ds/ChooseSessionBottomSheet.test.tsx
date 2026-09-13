import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { ChooseSessionBottomSheet } from './ChooseSessionBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

jest.mock('./BottomSheetShell', () => {
  const { View } = require('react-native');
  return {
    BottomSheetShell: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) => (visible ? <View>{children}</View> : null),
  };
});

jest.mock('../figma-icons/JobDetailScreenIcons', () => ({
  SessionSheetBackIcon: () => null,
}));

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

const sessions = [
  { id: 's1', dateLabel: 'Mar 1, 2026', durationLabel: '1.0h' },
  { id: 's2', dateLabel: 'Mar 2, 2026', durationLabel: '2.0h' },
];

describe('ChooseSessionBottomSheet', () => {
  it('hides attach-to-different header when only the current session exists', () => {
    render(
      <ChooseSessionBottomSheet
        typography={typography}
        visible
        mode="edit"
        sessions={sessions.slice(0, 1)}
        currentSessionId="s1"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.queryByText('ATTACH TO DIFFERENT SESSION')).toBeNull();
    expect(screen.getByText('Remove From Session')).toBeTruthy();
  });

  it('shows attach-to-different options when another session is available', () => {
    render(
      <ChooseSessionBottomSheet
        typography={typography}
        visible
        mode="edit"
        sessions={sessions}
        currentSessionId="s1"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('ATTACH TO DIFFERENT SESSION')).toBeTruthy();
    expect(screen.getByText('Mar 2, 2026')).toBeTruthy();
  });
});
