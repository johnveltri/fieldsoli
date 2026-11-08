import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_SIGNUP_KEY, readPendingSignup, savePendingSignup } from '../lib/pendingSignup';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Keyboard, KeyboardAvoidingView, Linking, Platform } from 'react-native';

import { SignInScreen } from './SignInScreen';
import { REQUIRED_PRIVACY_VERSION, REQUIRED_TERMS_VERSION } from '../lib/legal-versions';

const mockSignIn = jest.fn<
  (...args: unknown[]) => Promise<{ error: Error | null; session: null }>
>(async () => ({ error: null, session: null }));
const mockSignUp = jest.fn(async () => ({ error: null, session: { user: { id: 'user-1' } } }));
const mockRequestPasswordReset = jest.fn(async () => ({ error: null }));
const mockSetSignupLegalPending = jest.fn();
const mockCommitPasswordAutofill = jest.fn(async () => undefined);

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

jest.mock('../lib/passwordAutofill', () => ({
  commitPasswordAutofill: () => mockCommitPasswordAutofill(),
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
const mockVerifyOtp = jest.fn(async (_input: unknown) => ({ data: { session: { user: { id: 'user-1' } } }, error: null }));

jest.mock('@fieldsolo/api-client', () => ({
  recordSignupLegalAcceptances: (...args: unknown[]) =>
    mockRecordSignupLegalAcceptances(...(args as [])),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resend: (...args: unknown[]) => mockResend(...(args as [])),
      verifyOtp: (input: unknown) => mockVerifyOtp(input),
    },
  },
}));

jest.mock('../lib/legalAcceptanceStorage', () => ({
  cacheLegalAcceptance: (...args: unknown[]) =>
    mockCacheLegalAcceptance(...(args as [])),
}));

describe('SignInScreen', () => {
  let linkingSubscription: { remove: jest.Mock };

  beforeEach(async () => {
    await AsyncStorage.clear();
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
    const { getByText } = render(<SignInScreen initialMode="signIn" />);

    expect(getByText('Welcome back')).toBeTruthy();
    expect(getByText('Sign in to keep track of your jobs, time & earnings.')).toBeTruthy();
  });

  it('shrinks the auth viewport above the Android keyboard', () => {
    const originalPlatformOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    try {
      const screen = render(<SignInScreen initialMode="signIn" />);

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
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));

    expect(screen.getByText('Create your account')).toBeTruthy();
  });

  it('marks the brand title as an accessibility header', () => {
    const { getByLabelText } = render(<SignInScreen initialMode="signIn" />);

    expect(getByLabelText('FieldSoli').props.accessibilityRole).toBe('header');
  });

  it('renders a superscript TM on the brand wordmark', () => {
    const { getByLabelText, getByText } = render(<SignInScreen initialMode="signIn" />);

    expect(getByLabelText('FieldSoli')).toBeTruthy();
    expect(getByText('TM')).toBeTruthy();
  });

  it('rejects an invalid email before calling sign in', async () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('normalizes the email and submits from the password keyboard', async () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), '  Tech@Example.COM  ');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');

    await act(async () => {
      fireEvent(screen.getByLabelText('Password'), 'submitEditing');
    });

    expect(mockSignIn).toHaveBeenCalledWith('tech@example.com', 'password123');
  });

  it('hides email and password placeholders while those fields are focused', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
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
    const screen = render(<SignInScreen initialMode="signIn" />);
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
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-password');

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(screen.getByText('Incorrect email or password.')).toBeTruthy();
  });

  it('lets the user show and hide the password', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
    const password = screen.getByLabelText('Password');

    expect(password.props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByLabelText('Hide password'));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('provides platform autofill hints for sign in and sign up', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);

    expect(screen.getByLabelText('Email').props.autoComplete).toBe('username');
    expect(screen.getByLabelText('Email').props.textContentType).toBe('username');
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('current-password');

    fireEvent.press(screen.getByText('Create an account'));
    expect(screen.getByLabelText('Email').props.autoComplete).toBe('username');
    expect(screen.queryByLabelText('First name')).toBeNull();
    expect(screen.queryByLabelText('Last name')).toBeNull();
    expect(screen.getByLabelText('Password').props.autoComplete).toBe('new-password');
    expect(screen.queryByLabelText('Confirm password')).toBeNull();

    fireEvent.press(screen.getByText('Back to sign in'));
    fireEvent.press(screen.getByText('Forgot password?'));
    expect(screen.getByLabelText('Email').props.autoComplete).toBe('email');
    expect(screen.getByLabelText('Email').props.textContentType).toBe('emailAddress');
  });

  it('disables create account until the password meets policy', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
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
    const screen = render(<SignInScreen initialMode="signIn" />);
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
    const { getAllByText } = render(<SignInScreen initialMode="signIn" />);

    expect(getAllByText('Privacy Policy').length).toBeGreaterThan(0);
    expect(getAllByText('Terms').length).toBeGreaterThan(0);
  });

  it('shows privacy and terms only in the agreement line during sign up', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));

    expect(screen.getAllByText('Privacy Policy')).toHaveLength(1);
    expect(screen.getAllByText('Terms')).toHaveLength(1);
    expect(screen.getByText('Back to sign in')).toBeTruthy();
  });

  it('disables create account until the legal checkbox is checked', () => {
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');

    const createAccount = screen.getByRole('button', { name: 'Create account' });
    expect(createAccount.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(createAccount);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submits sign up after the legal checkbox is checked', async () => {
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
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
        privacyVersion: REQUIRED_PRIVACY_VERSION,
        termsVersion: REQUIRED_TERMS_VERSION,
      });
    });
  });

  it('shows check your email after signup when confirmation is required', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Email not confirmed'),
      session: null,
    });
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });

    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(mockCommitPasswordAutofill).toHaveBeenCalledTimes(1);
    expect(screen.getByText('tech@example.com')).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(mockRecordSignupLegalAcceptances).not.toHaveBeenCalled();
    expect(mockSetSignupLegalPending).not.toHaveBeenCalled();
  });

  it('shows the server resend wait and enables retry when it expires', async () => {
    await savePendingSignup('tech@example.com');
    const screen = render(<SignInScreen initialMode="signIn" />);
    await screen.findByLabelText('Verification code');
    jest.useFakeTimers();
    try {
      mockResend.mockResolvedValueOnce({ error: { status: 429, message: 'For security purposes, you can only request this after 42 seconds.' } });
      await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Resend email' })); });
      expect(screen.getByRole('button', { name: 'Resend email in 42s' }).props.accessibilityState.disabled).toBe(true);
      await act(async () => { jest.advanceTimersByTime(41000); });
      expect(screen.getByText('Resend email in 1s')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(screen.getByRole('button', { name: 'Resend email' }).props.accessibilityState.disabled).toBe(false);
    } finally {
      screen.unmount();
      jest.useRealTimers();
    }
  });

  it('resends the confirmation email from the check your email screen', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    mockSignIn.mockResolvedValueOnce({
      error: new Error('Email not confirmed'),
      session: null,
    });
    const screen = render(<SignInScreen initialMode="signIn" />);

    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'tech@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123!');
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
      expect(screen.getByText('If this email needs confirmation, check your inbox for a code or confirmation link.')).toBeTruthy();
    });
  });

  it('opens sign in when the app receives the sign-in deep link', async () => {
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('fieldsoli://sign-in');
    const screen = render(<SignInScreen initialMode="signIn" />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back')).toBeTruthy();
    });
  });

  it('requests a password reset from forgot password mode', async () => {
    const screen = render(<SignInScreen initialMode="signIn" />);

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

  it('verifies the email code without reentering the password', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create account' })); });
    fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Verify email' })); });
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'tech@example.com', token: '123456', type: 'email' });
    expect(mockSignIn).not.toHaveBeenCalled();
  });
  it('restores code entry after a real unmount/remount without persisting credentials', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'Tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create account' })); });
    fireEvent.changeText(screen.getByLabelText('Verification code'), '12345678');
    const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
    expect(JSON.parse(raw!)).toEqual({ email: 'tech@example.com', createdAt: expect.any(Number) });
    screen.unmount();
    const restarted = render(<SignInScreen initialMode="signIn" />);
    expect(await restarted.findByLabelText('Verification code')).toBeTruthy();
    expect(restarted.getByText('tech@example.com')).toBeTruthy();
    expect(restarted.getByLabelText('Verification code').props.value).toBe('');
    fireEvent.changeText(restarted.getByLabelText('Verification code'), '12345678');
    await act(async () => { fireEvent.press(restarted.getByRole('button', { name: 'Verify email' })); });
    await expect(readPendingSignup()).resolves.toBeNull();
  });

  it('opens verification from an unconfirmed sign-in after stored state has expired', async () => {
    mockSignIn.mockResolvedValueOnce({ error: new Error('Email not confirmed'), session: null });
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Sign in' })); });
    expect(screen.getByLabelText('Verification code')).toBeTruthy();
    await expect(readPendingSignup()).resolves.toBe('tech@example.com');
  });

  it('offers a small verification link only for the known pending email', async () => {
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    expect(screen.queryByText('Continue email verification')).toBeNull();
    screen.unmount();
    await savePendingSignup('tech@example.com');
    const resumed = render(<SignInScreen initialMode="signIn" />);
    await resumed.findByLabelText('Verification code');
    fireEvent.press(resumed.getByRole('button', { name: 'Back' }));
    fireEvent.changeText(resumed.getByLabelText('Email'), 'different@example.com');
    expect(resumed.queryByText('Continue email verification')).toBeNull();
    fireEvent.changeText(resumed.getByLabelText('Email'), 'tech@example.com');
    await act(async () => { fireEvent.press(resumed.getByRole('button', { name: 'Continue email verification' })); });
    expect(resumed.getByLabelText('Verification code')).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('uses conditional delivery language for an obfuscated no-session signup and offers password recovery', async () => {
    mockSignUp.mockResolvedValueOnce({ error: null, session: null });
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'existing@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create account' })); });
    expect(screen.getByText(/Enter the verification code for/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    fireEvent.press(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByLabelText('Email').props.value).toBe('existing@example.com');
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeTruthy();
    await expect(readPendingSignup()).resolves.toBeNull();
  });

  it('gives initial legacy sign-in links precedence over pending verification', async () => {
    await savePendingSignup('pending@example.com');
    jest.mocked(Linking.getInitialURL).mockResolvedValue('fieldsoli://sign-in');
    const screen = render(<SignInScreen initialMode="signIn" />);
    await act(async () => {});
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('does not let delayed restoration overwrite active user input', async () => {
    await savePendingSignup('pending@example.com');
    let resolveUrl!: (url: string | null) => void;
    jest.mocked(Linking.getInitialURL).mockReturnValue(new Promise(resolve => { resolveUrl = resolve; }));
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'other@example.com');
    await act(async () => { resolveUrl(null); });
    expect(screen.getByLabelText('Email').props.value).toBe('other@example.com');
    expect(screen.queryByLabelText('Verification code')).toBeNull();
  });

  it('returns to an editable email and clears pending verification on Back', async () => {
    await savePendingSignup('pending@example.com');
    const screen = render(<SignInScreen initialMode="signIn" />);
    await screen.findByLabelText('Verification code');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await expect(readPendingSignup()).resolves.toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('also offers neutral recovery when signup returns an explicit registered-user error', async () => {
    mockSignUp.mockResolvedValueOnce({ error: new Error('User already registered'), session: null });
    const screen = render(<SignInScreen initialMode="signIn" />);
    fireEvent.press(screen.getByText('Create an account'));
    fireEvent.changeText(screen.getByLabelText('Email'), 'existing@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    fireEvent.press(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Create account' })); });
    expect(screen.getByText(/Enter the verification code for/)).toBeTruthy();
    expect(screen.queryByText(/An account already exists/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Email').props.value).toBe('existing@example.com');
    await expect(readPendingSignup()).resolves.toBeNull();
  });

  it('recovers unconfirmed sign-in even if pending-state storage is unavailable', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    const screen = render(<SignInScreen initialMode="signIn" />);
    await act(async () => {});
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('unavailable'));
    fireEvent.changeText(screen.getByLabelText('Password'), 'Password123!');
    mockSignIn.mockResolvedValueOnce({ error: new Error('Email not confirmed'), session: null });
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Sign in' })); });
    expect(screen.getByLabelText('Verification code')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Verification code'), '12345678');
    await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Verify email' })); });
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'tech@example.com', token: '12345678', type: 'email' });
  });

  it('keeps verification to two actions and the standard upper-left Back control', async () => {
    await savePendingSignup('pending@example.com');
    const screen = render(<SignInScreen initialMode="signIn" />);
    await screen.findByLabelText('Verification code');
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Verify email' }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByText('Change email')).toBeNull();
    expect(screen.queryByText('Reset password')).toBeNull();
    expect(screen.queryByText('Back to sign in')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Verification code'), '12345678');
    expect(screen.getByRole('button', { name: 'Verify email' }).props.accessibilityState.disabled).toBe(false);
  });

  it('opens on the carousel and requires an explicit account action to show inputs', async () => {
    const screen = render(<SignInScreen />);
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Create account' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.changeText(screen.getByLabelText('Email'), 'tech@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByLabelText('Email')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email').props.value).toBe('tech@example.com');
  });

  it('opens the signup form directly from the carousel', async () => {
    const screen = render(<SignInScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.queryByLabelText('First name')).toBeNull();
  });

  it('bypasses the default carousel for pending verification', async () => {
    await savePendingSignup('pending@example.com');
    const screen = render(<SignInScreen />);
    expect(await screen.findByLabelText('Verification code')).toBeTruthy();
  });

});
