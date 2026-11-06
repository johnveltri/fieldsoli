import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { ChangePasswordBottomSheet } from './ChangePasswordBottomSheet';
import { createTextStyles } from '../../theme/nativeTokens';

jest.mock('./BottomSheetShell', () => ({
  BottomSheetShell: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));

jest.mock('../figma-icons/JobDetailScreenIcons', () => ({
  SessionSheetBackIcon: () => null,
}));

jest.mock('../figma-icons/ProfileScreenIcons', () => ({
  ProfileAccountIcon: () => null,
}));

const typography = createTextStyles({
  serifBold: 'System',
  sans: 'System',
  sansSemi: 'System',
  sansBold: 'System',
});

describe('ChangePasswordBottomSheet', () => {
  it('requires length, a capital letter, a symbol, and matching confirmation', () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ChangePasswordBottomSheet typography={typography} visible onSubmit={onSubmit} />,
    );
    const save = screen.getByLabelText('SAVE NEW PASSWORD');
    expect(screen.getByPlaceholderText('New Password').props.autoComplete).toBe('new-password');
    expect(screen.getByPlaceholderText('New Password').props.textContentType).toBe('newPassword');
    expect(screen.getByPlaceholderText('Repeat Password').props.autoComplete).toBe('new-password');

    fireEvent.changeText(screen.getByPlaceholderText('New Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Repeat Password'), 'password123');
    expect(save.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText('New Password'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Repeat Password'), 'Different123!');
    expect(screen.getByText('Password does not match')).toBeTruthy();
    expect(screen.getByLabelText('SAVE NEW PASSWORD').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText('Repeat Password'), 'Password123!');
    fireEvent.press(screen.getByLabelText('SAVE NEW PASSWORD'));
    expect(onSubmit).toHaveBeenCalledWith('Password123!');
  });
});
