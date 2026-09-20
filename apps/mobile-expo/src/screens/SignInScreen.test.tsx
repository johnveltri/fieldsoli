import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Keyboard, KeyboardAvoidingView, Linking, Platform } from 'react-native';

import { SignInScreen } from './SignInScreen';

const mockSignIn = jest.fn<
  (...args: unknown[]) => Promise<{ error: Error | null; session: null }>
>(async () => ({ error: null, session: null }));
const mockSignUp = jest.fn(async () => ({ error: null, session: { user: { id: 'user-1' } } }));
const mockRequestPasswordReset = jest.fn(async () => ({ error: null }));
const mockSetSignupLegalPending = jest.fn();

jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    requestPasswordReset: mockRequestPasswordReset,
    setSignupLegalPending: mockSetSignupLegalPending,
  }),
}));

jest.mock('../components/CanvasTiledBackground', () => ({
  CanvasTiledBackground: () => null,
}));

jest.mock('../lib/analytics', () => ({
  analytics: {
    capture: jest.fn(),
  },
  emailProperties: () => ({}),
  errorProperties: () => ({}),
}));

const mockRecordSignupLegalAcceptances = jest.fn(async () => undefined);
const mockCacheLegalAcceptance = jest.fn(async () => undefined);
const mockResend = jest.fn(async () => ({ error: null }));

jest.mock('@fieldsolo/api-client', () => ({
  recordSignupLegalAcceptances: (...args: unknown[]) =>
    mockRecordSignupLegalAcceptances(...(args as [])),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resend: (...args: unknown[]) => mockResend(...(args as [])),
    },
  },
}));

jest.mock('../lib/legalAcceptanceStorage', () => ({
  cacheLegalAcceptance: (...args: unknown[]) =>
    mockCacheLegalAcceptance(...(args as [])),
}));

describe('SignInScreen', () => {
  let linkingSubscription: { remove: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null, session: null });
    mockSignUp.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } });
    mockResend.mockResolvedValue({ error: null });
    linkingSubscription = { remove: jest.fn() };
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.spyOn(Linking, 'addEventListener').mockReturnValue(linkingSubscription);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows sign-in instructions in sign-in mode', () => {
    const { getByText } = render(<SignInScreen />);

    expect(getByText('Welcome back')).toBeTruthy();
    expect(getByText('Sign in to keep track of your jobs, time & earnings.')).toBeTruthy();
  });

  it('shrinks the auth viewport above the Android keyboard', () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    try {
      const screen = render(<SignInScreen />);

      expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('height');
      expect(screen.UNSAFE_getByProps({ keyboardDismissMode: 'on-drag' })).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatformOS,
      });
    }
  });

  it('shows sign-up instructions in sign-up mode', () => {
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));

    expect(screen.getByText('Create your account')).toBeTruthy();
  });

  it('marks the brand title as an accessibility header', () => {
    const { getByLabelText } = render(<SignInScreen />);

    expect(getByLabelText('FieldSoli').props.accessibilityRole).toBe('header');
  });

  it('renders a superscript TM on the brand wordmark', () => {
    const { getByLabelText, getByText } = render(<SignInScreen />);

    expect(getByLabelText('FieldSoli')).toBeTruthy();
    expect(getByText('TM')).toBeTruthy();
  });

  it('rejects an invalid email before calling sign in', async () => {
    const screen = render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('normalizes the email and submits from the password keyboard', async () => {
    const screen = render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), '  Tech@Example.COM  ');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

    await act(async () => {
      fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    });

    expect(mockSignIn).toHaveBeenCalledWith('tech@example.com', 'password123');
  });

  it('hides email and password placeholders while those fields are focused', () => {
    const screen = render(<SignInScreen />);
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');

    expect(email.props.placeholder).toBe('you@example.com');
    expect(password.props.placeholder).toBe('••••••••');

    fireEvent(email, 'focus');
    expect(screen.getByLabelText('Email').props.placeholder).toBeUndefined();
    expect(screen.getByLabelText('Password').props.placeholder).toBe('••••••••');

    fireEvent(email, 'blur');
    fireEvent(password, 'focus');
    expect(screen.getByLabelText('Email').props.placeholder).toBe('you@example.com');
    expect(screen.getByLabelText('Password').props.placeholder).toBeUndefined();

    fireEvent(password, 'blur');
    expect(screen.getByLabelText('Password').props.placeholder).toBe('••••••••');
  });

  it('dismisses the keyboard before starting sign-in', async () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss');
    const screen = render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(dismissKeyboard.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignIn.mock.invocationCallOrder[0],
    );
    dismissKeyboard.mockRestore();
  });

  it('turns invalid-credential errors into clear sign-in copy', async () => {
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
      session: null,
    });
    const screen = render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(screen.getByText('Incorrect email or password.')).toBeTruthy();
  });

  it('lets the user show and hide the password', () => {
    const screen = render(<SignInScreen />);
    const password = screen.getByLabelText('Password');

    expect(password.props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('provides platform autofill hints for sign in and sign up', () => {
    const screen = render(<SignInScreen />);

    expect(screen.getByLabelText('Email').props.autoComplete).toBe('email');
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('current-password');

    fireEvent.press(screen.getByText('Create an account'));
    expect(screen.getByLabelText('First name').props.autoComplete).toBe('name-given');
    expect(screen.getByLabelText('Last name').props.autoComplete).toBe('name-family');
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('new-password');
    expect(screen.getByLabelText('Confirm password').props.autoComplete).toBe('new-password');
  });

  it('disables create account until passwords match', () => {
    const screen = render(<SignInScreen />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('First name'), 'Alex');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Builder');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Different123!');
    fireEvent.press(screen.getByRole('checkbox'));

    const createAccount = screen.getByRole('button', { name: 'Create account' });
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(createAccount.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(createAccount);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('disables create account until the password meets policy', () => {
    const screen = render(<SignInScreen />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('First name'), 'Alex');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Builder');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'password123');
    fireEvent.press(screen.getByRole('checkbox'));

    const createAccount = screen.getByRole('button', { name: 'Create account' });
    expect(
      screen.getByText('At least 8 characters, 1 capital letter, and 1 symbol'),
    ).toBeTruthy();
    expect(createAccount.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(createAccount);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('hides the password requirement hint once the password meets policy', () => {
    const screen = render(<SignInScreen />);
    fireEvent.press(screen.getByText('Create an account'));

    expect(
      screen.getByText('At least 8 characters, 1 capital letter, and 1 symbol'),
    ).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');

    expect(
      screen.queryByText('At least 8 characters, 1 capital letter, and 1 symbol'),
    ).toBeNull();
  });

  it('shows privacy policy and terms links on sign in', () => {
    const { getAllByText } = render(<SignInScreen />);

    expect(getAllByText('Privacy Policy').length).toBeGreaterThan(0);
    expect(getAllByText('Terms').length).toBeGreaterThan(0);
  });

  it('shows privacy and terms only in the agreement line during sign up', () => {
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));

    expect(screen.getAllByText('Privacy Policy')).toHaveLength(1);
    expect(screen.getAllByText('Terms')).toHaveLength(1);
    expect(screen.getByText('Back to sign in')).toBeTruthy();
  });

  it('disables create account until the legal checkbox is checked', () => {
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Alex'), 'Alex');
    fireEvent.changeText(screen.getByPlaceholderText('Builder'), 'Builder');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Re-enter password'), 'Password123!');

    const createAccount = screen.getByRole('button', { name: 'Create account' });
    expect(createAccount.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(createAccount);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submits sign up after the legal checkbox is checked', async () => {
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Alex'), 'Alex');
    fireEvent.changeText(screen.getByPlaceholderText('Builder'), 'Builder');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Re-enter password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));

    const createAccount = screen.getByRole('button', { name: 'Create account' });
    expect(createAccount.props.accessibilityState).toMatchObject({ disabled: false });

    await act(async () => {
      fireEvent.press(createAccount);
    });

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockRecordSignupLegalAcceptances).toHaveBeenCalledTimes(1);
      expect(mockCacheLegalAcceptance).toHaveBeenCalledWith({
        userId: 'user-1',
        privacyVersion: '2026-09-20',
        termsVersion: '2026-08-30',
      });
    });
  });

  it('shows check your email after signup when confirmation is required', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Email not confirmed'),
      session: null,
    });
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Alex'), 'Alex');
    fireEvent.changeText(screen.getByPlaceholderText('Builder'), 'Builder');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Re-enter password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });

    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(screen.getByText('tech@example.com')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(mockRecordSignupLegalAcceptances).not.toHaveBeenCalled();
    expect(mockSetSignupLegalPending).not.toHaveBeenCalled();
  });

  it('resends the confirmation email from the check your email screen', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Email not confirmed'),
      session: null,
    });
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Alex'), 'Alex');
    fireEvent.changeText(screen.getByPlaceholderText('Builder'), 'Builder');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Re-enter password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Resend email' }));
    });

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'signup',
          email: 'tech@example.com',
        }),
      );
      expect(screen.getByText('Confirmation email sent. Check your inbox.')).toBeTruthy();
    });
  });

  it('opens sign in when the app receives the sign-in deep link', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('fieldsoli://sign-in');
    const screen = render(<SignInScreen />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeTruthy();
    });
  });

  it('requests a password reset from forgot password mode', async () => {
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Forgot password?'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    });

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('tech@example.com');
      expect(screen.getByText('Check your email')).toBeTruthy();
      expect(screen.getByText('tech@example.com')).toBeTruthy();
    });
  });

  it('shows an existing-account error instead of check email when signup sign-in fails with invalid credentials', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
      session: null,
    });
    const screen = render(<SignInScreen />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Alex'), 'Alex');
    fireEvent.changeText(screen.getByPlaceholderText('Builder'), 'Builder');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.changeText(screen.getByPlaceholderText('Re-enter password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });

    expect(
      screen.getByText(
        'An account already exists for this email. Sign in or reset your password.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Check your email')).toBeNull();
  });
});
