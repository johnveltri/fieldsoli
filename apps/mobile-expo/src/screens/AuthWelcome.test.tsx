import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Dimensions, FlatList, Image } from 'react-native';
import { AuthWelcome } from './AuthWelcome';

describe('signed-out carousel', () => {
  it('lets the user reach both account destinations without paging', () => {
    const onSignIn = jest.fn();
    const onCreateAccount = jest.fn();
    const screen = render(<AuthWelcome onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
  it('uses only dots for visible paging and keeps account actions available', () => {
    const screen = render(<AuthWelcome onSignIn={() => {}} onCreateAccount={() => {}} />);
    expect(screen.queryByText('1 of 5')).toBeNull();
    expect(screen.queryByText('Illustrative example')).toBeNull();
    expect(screen.queryByText('Create estimates and invoices for your jobs.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Previous card' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next card' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Show card 5: See your job earnings.' }));
    expect(screen.getByRole('button', { name: 'Show card 5: See your job earnings.' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });
  it('keeps text and account actions usable when artwork fails', () => {
    const screen = render(<AuthWelcome onSignIn={() => {}} onCreateAccount={() => {}} />);
    const artwork = screen.UNSAFE_getAllByType(Image).find(image => image.props.onError);
    fireEvent(artwork!, 'error');
    expect(screen.getByRole('header', { name: 'Unlimited invoices & estimates' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
  it('updates the selected dot while dragging, before momentum ends', () => {
    const screen = render(<AuthWelcome onSignIn={() => {}} onCreateAccount={() => {}} />);
    const width = Math.min(Dimensions.get('window').width, 600);
    fireEvent.scroll(screen.UNSAFE_getByType(FlatList), { nativeEvent: { contentOffset: { x: width * 0.75, y: 0 } } });
    expect(screen.getByRole('button', { name: 'Show card 2: Track time & expenses' }).props.accessibilityState.selected).toBe(true);
    fireEvent.scroll(screen.UNSAFE_getByType(FlatList), { nativeEvent: { contentOffset: { x: width * 0.2, y: 0 } } });
    expect(screen.getByRole('button', { name: 'Show card 1: Unlimited invoices & estimates' }).props.accessibilityState.selected).toBe(true);
  });

});
