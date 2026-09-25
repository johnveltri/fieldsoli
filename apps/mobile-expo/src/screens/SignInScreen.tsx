import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { recordSignupLegalAcceptances } from '@fieldsolo/api-client';

import { useAuth } from '../context/AuthContext';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { analytics, emailProperties, errorProperties } from '../lib/analytics';
import { analyticsConfig } from '../lib/analytics/config';
import {
  LEGAL_URLS,
  REQUIRED_PRIVACY_VERSION,
  REQUIRED_TERMS_VERSION,
} from '../lib/legal-versions';
import { cacheLegalAcceptance } from '../lib/legalAcceptanceStorage';
import { supabase } from '../lib/supabase';
import { DsTextInput } from '../components/ds/DsTextInput';
import { cardShadowRn, createTextStyles, fg, space } from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { announceAccessibilityMessage } from '../lib/accessibility';
import {
  NEW_PASSWORD_REQUIREMENT,
  newPasswordMeetsPolicy,
  newPasswordPolicyError,
} from '../lib/passwordPolicy';
import { AUTH_CONFIRM_URL, isAppSignInDeepLink } from '../lib/authUrls';

const BRAND_DISPLAY_FONT_SIZE = 32;
const BRAND_DISPLAY_LINE_HEIGHT = Math.round(BRAND_DISPLAY_FONT_SIZE * 1.4);
const BRAND_TM_FONT_SIZE = Math.round(BRAND_DISPLAY_FONT_SIZE * 0.32);
// Leave enough room below the focused field to expose the next form control
// above taller Android keyboards (including Samsung's keyboard toolbar).
const AUTH_KEYBOARD_FOCUS_OFFSET = 160;
/** Cap-band offset so TM reads as superscript, not baseline-aligned (subscript). */
const BRAND_TM_SUPERSCRIPT_MARGIN_TOP = Math.round(
  (BRAND_DISPLAY_LINE_HEIGHT - BRAND_DISPLAY_FONT_SIZE) / 2,
);

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (normalized.includes('email not confirmed')) return 'Confirm your email before signing in.';
  if (normalized.includes('user already registered')) return 'An account already exists for this email. Sign in instead.';
  if (normalized.includes('fetch failed') || normalized.includes('network request failed')) {
    return "Couldn't connect. Check your connection and try again.";
  }
  return message || 'Something went wrong. Try again.';
}

function isInvalidLoginCredentials(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return message.toLowerCase().includes('invalid login credentials');
}

function isEmailNotConfirmed(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return message.toLowerCase().includes('email not confirmed');
}

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const { signIn, signUp, requestPasswordReset, setSignupLegalPending } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<
    'signIn' | 'signUp' | 'checkEmail' | 'forgotPassword' | 'resetEmailSent'
  >('signIn');
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const [pendingResetEmail, setPendingResetEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const previousModeRef = useRef(mode);
  const scrollViewRef = useRef<ScrollView>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const scrollInputIntoView = useCallback((nativeTarget?: number) => {
    if (nativeTarget == null) return;
    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
      nativeTarget,
      AUTH_KEYBOARD_FOCUS_OFFSET,
      true,
    );
  }, []);

  useEffect(() => {
    analytics.capture('auth_screen_viewed', { mode });
  }, [mode]);

  useEffect(() => {
    announceAccessibilityMessage(error);
  }, [error]);

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    analytics.capture('auth_mode_changed', {
      from_mode: previousModeRef.current,
      to_mode: mode,
    });
    previousModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const openSignInFromDeepLink = (url: string | null) => {
      if (!url || !isAppSignInDeepLink(url)) return;
      setMode('signIn');
      setError(null);
      setResendNotice(null);
    };
    void Linking.getInitialURL().then(openSignInFromDeepLink);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      openSignInFromDeepLink(url);
    });
    return () => subscription.remove();
  }, []);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const text = useMemo(
    () => ({
      title: typography.titleH3,
      body: typography.body,
      caption: typography.bodySmall,
      bodySemi: typography.bodyBold,
    }),
    [typography],
  );

  const passwordMeetsPolicy = newPasswordMeetsPolicy(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showPasswordMismatch =
    mode === 'signUp' && confirmPassword.length > 0 && password !== confirmPassword;
  const canCreateAccount =
    passwordMeetsPolicy && passwordsMatch && legalAccepted && !busy;
  const primaryDisabled =
    mode === 'signUp' ? !canCreateAccount : mode === 'forgotPassword' ? busy : busy;

  const onForgotPasswordSubmit = useCallback(async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      analytics.capture('password_reset_requested', {
        ...emailProperties(trimmed),
      });
      const { error: resetErr } = await requestPasswordReset(trimmed);
      if (resetErr) {
        analytics.capture('password_reset_request_failed', {
          ...emailProperties(trimmed),
          ...errorProperties(resetErr),
        });
        setError(authErrorMessage(resetErr));
        return;
      }
      setPendingResetEmail(trimmed);
      setMode('resetEmailSent');
      announceAccessibilityMessage(
        `If an account exists for ${trimmed}, we sent a password reset link.`,
      );
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, requestPasswordReset]);

  const onResendConfirmation = useCallback(async () => {
    const targetEmail = pendingConfirmEmail || email.trim().toLowerCase();
    if (!targetEmail) return;
    setResendNotice(null);
    setResendBusy(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: AUTH_CONFIRM_URL },
      });
      if (resendErr) {
        setResendNotice(authErrorMessage(resendErr));
        return;
      }
      setResendNotice('Confirmation email sent. Check your inbox.');
    } catch (e) {
      setResendNotice(authErrorMessage(e));
    } finally {
      setResendBusy(false);
    }
  }, [email, pendingConfirmEmail]);

  const onSubmit = useCallback(async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError('Enter email and password.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'signUp') {
      const policyError = newPasswordPolicyError(password);
      if (policyError) {
        setError(policyError);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setError('Enter your first and last name.');
        return;
      }
      if (!legalAccepted) {
        setError('Agree to the Privacy Policy and Terms to create an account.');
        return;
      }
    }

    // Supabase emits the signed-in state while `signInWithPassword` resolves.
    // Dismiss the focused native TextInput first so the auth-driven shell swap
    // cannot unmount the form while it still owns the keyboard responder.
    Keyboard.dismiss();
    setBusy(true);
    try {
      if (mode === 'signIn') {
        analytics.capture('sign_in_submitted', {
          ...emailProperties(trimmed),
          has_password: password.length > 0,
        });
        const { error: err } = await signIn(trimmed, password);
        if (err) {
          analytics.capture('sign_in_failed', {
            ...emailProperties(trimmed),
            ...errorProperties(err),
          });
          setError(authErrorMessage(err));
        } else {
          analytics.capture('sign_in_succeeded', {
            ...emailProperties(trimmed),
          });
        }
      } else {
        analytics.capture('sign_up_submitted', {
          ...emailProperties(trimmed),
          first_name_present: firstName.trim().length > 0,
          last_name_present: lastName.trim().length > 0,
        });
        // First/last name go into raw_user_meta_data so the
        // public.handle_new_user trigger can seed the profiles row.
        const { error: signUpErr, session: signUpSession } = await signUp(trimmed, password, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        if (signUpErr) {
          analytics.capture('sign_up_failed', {
            stage: 'sign_up',
            ...emailProperties(trimmed),
            ...errorProperties(signUpErr),
          });
          setError(authErrorMessage(signUpErr));
          return;
        }
        analytics.capture('sign_up_succeeded', {
          ...emailProperties(trimmed),
        });
        // Do not set signupLegalPending until we have a session. That flag
        // replaces SignInScreen with a spinner in App.tsx; flipping it early
        // unmounts this screen and drops the check-email state.
        let acceptedUserId = signUpSession?.user.id ?? null;
        if (!signUpSession) {
          const { error: signInErr, session: immediateSession } = await signIn(
            trimmed,
            password,
          );
            if (signInErr) {
              if (isInvalidLoginCredentials(signInErr)) {
                setError(
                  'An account already exists for this email. Sign in or reset your password.',
                );
                return;
              }
              if (isEmailNotConfirmed(signInErr)) {
                setPassword('');
                setConfirmPassword('');
                setPendingConfirmEmail(trimmed);
                setResendNotice(null);
                setMode('checkEmail');
                announceAccessibilityMessage(
                  `Check your email. We sent a confirmation link to ${trimmed}.`,
                );
                return;
              }
              setError(authErrorMessage(signInErr));
              return;
            }
          acceptedUserId = immediateSession?.user.id ?? null;
        }

        setSignupLegalPending(true);
        try {
          await recordSignupLegalAcceptances(supabase, {
            privacyVersion: REQUIRED_PRIVACY_VERSION,
            termsVersion: REQUIRED_TERMS_VERSION,
            appVersion: analyticsConfig.appVersion,
            platform: analyticsConfig.platform,
          });
          if (acceptedUserId) {
            try {
              await cacheLegalAcceptance({
                userId: acceptedUserId,
                privacyVersion: REQUIRED_PRIVACY_VERSION,
                termsVersion: REQUIRED_TERMS_VERSION,
              });
            } catch {
              // The durable server record succeeded; local caching is best-effort.
            }
          }
        } catch (consentErr) {
          analytics.capture('sign_up_failed', {
            stage: 'legal_acceptance',
            ...emailProperties(trimmed),
            ...errorProperties(consentErr),
          });
          setError(
            consentErr instanceof Error
              ? consentErr.message
              : 'Could not save your legal acceptance. Try signing in again.',
          );
        } finally {
          setSignupLegalPending(false);
        }
      }
    } catch (e) {
      analytics.capture(mode === 'signIn' ? 'sign_in_failed' : 'sign_up_failed', {
        stage: mode === 'signIn' ? 'sign_in' : 'unexpected',
        ...emailProperties(trimmed),
        ...errorProperties(e),
      });
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, password, confirmPassword, firstName, lastName, legalAccepted, mode, setSignupLegalPending, signIn, signUp, requestPasswordReset]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <CanvasTiledBackground scrollY={scrollY} />
        <ActivityIndicator />
      </View>
    );
  }

  const gap = space('Spacing/20');

  return (
    <View style={styles.root}>
      <CanvasTiledBackground scrollY={scrollY} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            mode === 'signIn' || mode === 'checkEmail' || mode === 'resetEmailSent'
              ? styles.scrollContentCentered
              : styles.scrollContentTop,
            {
              paddingTop: insets.top + gap,
              paddingBottom: insets.bottom + gap,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={columnStyle}>
          <View style={styles.brandBlock}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../assets/brand/fieldsoli-solo-notch-light.png')}
              style={styles.logo}
            />
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel="FieldSoli"
              style={styles.brandNameRow}
            >
              <Text style={[typography.displayH1, styles.brandName]}>FieldSoli</Text>
              <Text style={styles.brandTm}>TM</Text>
            </View>
          </View>
          <View style={styles.card}>
            {mode === 'checkEmail' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={[text.title, { color: fg.primary, marginBottom: space('Spacing/8') }]}
                >
                  Check your email
                </Text>
                <Text style={[text.body, { color: fg.secondary, marginBottom: space('Spacing/24') }]}>
                  We sent a confirmation link to{' '}
                  <Text style={[text.bodySemi, { color: fg.primary }]}>{pendingConfirmEmail}</Text>.
                  Open the email and tap Confirm email to activate your account.
                </Text>
                {resendNotice ? (
                  <Text
                    style={[
                      text.caption,
                      {
                        color: resendNotice.includes('sent') ? fg.secondary : '#b00020',
                        marginBottom: gap,
                      },
                    ]}
                  >
                    {resendNotice}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: resendBusy, busy: resendBusy }}
                  onPress={() => void onResendConfirmation()}
                  disabled={resendBusy}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    resendBusy && styles.primaryButtonDisabled,
                    !resendBusy && pressed && styles.primaryButtonPressed,
                  ]}
                >
                  {resendBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[text.bodySemi, { color: '#fff' }]}>Resend email</Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMode('signIn');
                    setResendNotice(null);
                    setError(null);
                  }}
                  disabled={resendBusy}
                  style={styles.modeSwitch}
                >
                  <Text style={[text.bodySemi, { color: fg.primary }]}>Back to sign in</Text>
                </Pressable>
              </>
            ) : mode === 'resetEmailSent' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={[text.title, { color: fg.primary, marginBottom: space('Spacing/8') }]}
                >
                  Check your email
                </Text>
                <Text style={[text.body, { color: fg.secondary, marginBottom: space('Spacing/24') }]}>
                  If an account exists for{' '}
                  <Text style={[text.bodySemi, { color: fg.primary }]}>{pendingResetEmail}</Text>,
                  we sent a password reset link. Open the email and choose a new password.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMode('signIn');
                    setError(null);
                  }}
                  style={styles.modeSwitch}
                >
                  <Text style={[text.bodySemi, { color: fg.primary }]}>Back to sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
            <Text accessibilityRole="header" style={[text.title, { color: fg.primary, marginBottom: space('Spacing/8') }]}>
              {mode === 'signUp'
                ? 'Create your account'
                : mode === 'forgotPassword'
                  ? 'Reset password'
                  : 'Welcome back'}
            </Text>
            <Text style={[text.body, { color: fg.secondary, marginBottom: space('Spacing/24') }]}>
              {mode === 'signUp'
                ? 'Start with one real job. You can add the rest as you go.'
                : mode === 'forgotPassword'
                  ? 'Enter the email for your account and we will send a reset link.'
                  : 'Sign in to keep track of your jobs, time & earnings.'}
            </Text>

            {mode === 'signUp' ? (
              <>
                <Text
                  style={[
                    text.caption,
                    { color: fg.secondary, marginBottom: space('Spacing/8') },
                  ]}
                >
                  First name
                </Text>
                <DsTextInput
                  value={firstName}
                  onChangeText={(value) => {
                    setFirstName(value);
                    if (error) setError(null);
                  }}
                  accessibilityLabel="First name"
                  autoCapitalize="words"
                  autoComplete="name-given"
                  autoCorrect={false}
                  textContentType="givenName"
                  returnKeyType="next"
                  onFocus={(event) => scrollInputIntoView(event?.nativeEvent.target)}
                  onSubmitEditing={() => lastNameInputRef.current?.focus()}
                  placeholder="Alex"
                  placeholderTextColor={fg.secondary}
                  style={[styles.input, text.body, { color: fg.primary }]}
                  editable={!busy}
                />
                <Text
                  style={[
                    text.caption,
                    {
                      color: fg.secondary,
                      marginBottom: space('Spacing/8'),
                      marginTop: gap,
                    },
                  ]}
                >
                  Last name
                </Text>
                <DsTextInput
                  ref={lastNameInputRef}
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    if (error) setError(null);
                  }}
                  accessibilityLabel="Last name"
                  autoCapitalize="words"
                  autoComplete="name-family"
                  autoCorrect={false}
                  textContentType="familyName"
                  returnKeyType="next"
                  onFocus={(event) => scrollInputIntoView(event?.nativeEvent.target)}
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  placeholder="Builder"
                  placeholderTextColor={fg.secondary}
                  style={[styles.input, text.body, { color: fg.primary }]}
                  editable={!busy}
                />
                <View style={{ height: gap }} />
              </>
            ) : null}

            <Text style={[text.caption, { color: fg.secondary, marginBottom: space('Spacing/8') }]}>
              Email
            </Text>
            <DsTextInput
              ref={emailInputRef}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError(null);
              }}
              onFocus={(event) => {
                setEmailFocused(true);
                scrollInputIntoView(event?.nativeEvent.target);
              }}
              onBlur={() => setEmailFocused(false)}
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType={mode === 'forgotPassword' ? 'done' : 'next'}
              onSubmitEditing={() => {
                if (mode === 'forgotPassword') void onForgotPasswordSubmit();
                else passwordInputRef.current?.focus();
              }}
              placeholder={emailFocused ? undefined : 'you@example.com'}
              placeholderTextColor={fg.secondary}
              style={[styles.input, text.body, { color: fg.primary }]}
              editable={!busy}
            />

            {mode !== 'forgotPassword' ? (
              <>
            <Text
              style={[
                text.caption,
                { color: fg.secondary, marginBottom: space('Spacing/8'), marginTop: gap },
              ]}
            >
              Password
            </Text>
            <View style={styles.passwordInputShell}>
              <DsTextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError(null);
                }}
                onFocus={(event) => {
                  setPasswordFocused(true);
                  scrollInputIntoView(event?.nativeEvent.target);
                }}
                onBlur={() => setPasswordFocused(false)}
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                autoCorrect={false}
                secureTextEntry={!passwordVisible}
                textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                returnKeyType={mode === 'signUp' ? 'next' : 'done'}
                onSubmitEditing={() => {
                  if (mode === 'signUp') confirmPasswordInputRef.current?.focus();
                  else void onSubmit();
                }}
                placeholder={passwordFocused ? undefined : '••••••••'}
                placeholderTextColor={fg.secondary}
                style={[styles.passwordInput, text.body, { color: fg.primary }]}
                editable={!busy}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                disabled={busy}
                hitSlop={8}
                onPress={() => setPasswordVisible((visible) => !visible)}
                style={({ pressed }) => [styles.passwordVisibilityButton, pressed && styles.pressed]}
              >
                <Text style={[text.caption, styles.passwordVisibilityLabel, { color: fg.primary }]}>
                  {passwordVisible ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            {mode === 'signIn' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMode('forgotPassword');
                  setPassword('');
                  setError(null);
                }}
                disabled={busy}
                style={{ marginTop: space('Spacing/12'), alignSelf: 'flex-start' }}
              >
                <Text style={[text.caption, styles.consentLink, { color: fg.secondary }]}>
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}

            {mode === 'signUp' ? (
              <>
                {!passwordMeetsPolicy ? (
                  <Text
                    style={[
                      text.caption,
                      styles.passwordRequirement,
                      {
                        color: password.length > 0 ? '#b00020' : fg.secondary,
                      },
                    ]}
                  >
                    {NEW_PASSWORD_REQUIREMENT}
                  </Text>
                ) : null}
                <Text
                  style={[
                    text.caption,
                    { color: fg.secondary, marginBottom: space('Spacing/8'), marginTop: gap },
                  ]}
                >
                  Confirm password
                </Text>
                <DsTextInput
                  ref={confirmPasswordInputRef}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    if (error) setError(null);
                  }}
                  accessibilityLabel="Confirm password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  autoCorrect={false}
                  secureTextEntry={!passwordVisible}
                  textContentType="newPassword"
                  returnKeyType="done"
                  onFocus={(event) => scrollInputIntoView(event?.nativeEvent.target)}
                  onSubmitEditing={() => {
                    if (canCreateAccount) void onSubmit();
                  }}
                  placeholder="Re-enter password"
                  placeholderTextColor={fg.secondary}
                  style={[styles.input, text.body, { color: fg.primary }]}
                  editable={!busy}
                />
                {showPasswordMismatch ? (
                  <Text style={[text.caption, { color: '#b00020', marginTop: space('Spacing/8') }]}>
                    Passwords do not match.
                  </Text>
                ) : null}
              </>
            ) : null}
              </>
            ) : null}

            {error ? (
              <Text style={[text.caption, { color: '#b00020', marginTop: gap }]}>{error}</Text>
            ) : null}

            {mode === 'signUp' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="I agree to the Privacy Policy and Terms"
                accessibilityState={{ checked: legalAccepted }}
                onPress={() => setLegalAccepted((value) => !value)}
                disabled={busy}
                style={[styles.consentRow, { marginTop: gap }]}
              >
                <View style={[styles.consentBox, legalAccepted && styles.consentBoxChecked]}>
                  {legalAccepted ? (
                    <Text style={[text.caption, styles.consentMark]}>✓</Text>
                  ) : null}
                </View>
                <Text style={[text.caption, styles.consentLabel, { color: fg.secondary }]}>
                  I agree to the{' '}
                  <Text
                    style={styles.consentLink}
                    onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}
                  >
                    Privacy Policy
                  </Text>{' '}
                  and{' '}
                  <Text
                    style={styles.consentLink}
                    onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
                  >
                    Terms
                  </Text>
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: primaryDisabled, busy }}
              onPress={
                mode === 'forgotPassword'
                  ? () => void onForgotPasswordSubmit()
                  : mode === 'signUp' && !canCreateAccount
                    ? undefined
                    : () => void onSubmit()
              }
              disabled={primaryDisabled}
              style={({ pressed }) => [
                styles.primaryButton,
                { marginTop: gap * 1.5 },
                primaryDisabled && styles.primaryButtonDisabled,
                !primaryDisabled && pressed && styles.primaryButtonPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[text.bodySemi, { color: '#fff' }]}>
                  {mode === 'forgotPassword'
                    ? 'Send reset link'
                    : mode === 'signIn'
                      ? 'Sign in'
                      : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (mode === 'forgotPassword') {
                  setMode('signIn');
                  setError(null);
                  return;
                }
                setMode((m) => {
                  const next = m === 'signIn' ? 'signUp' : 'signIn';
                  if (next === 'signUp') {
                    setLegalAccepted(false);
                  }
                  return next;
                });
                setPassword('');
                setConfirmPassword('');
                setPasswordVisible(false);
                setError(null);
              }}
              disabled={busy}
              style={styles.modeSwitch}
            >
              <Text style={[text.bodySemi, { color: fg.primary }]}>
                {mode === 'forgotPassword'
                  ? 'Back to sign in'
                  : mode === 'signIn'
                    ? 'Create an account'
                    : 'Back to sign in'}
              </Text>
            </Pressable>

            {mode === 'signIn' ? (
              <Text style={[text.caption, styles.legalFooter, { color: fg.secondary, marginTop: gap }]}>
                <Text
                  style={styles.consentLink}
                  onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}
                >
                  Privacy Policy
                </Text>
                {' · '}
                <Text
                  style={styles.consentLink}
                  onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
                >
                  Terms
                </Text>
              </Text>
            ) : null}
              </>
            )}
          </View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, zIndex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollContentCentered: { justifyContent: 'center' },
  scrollContentTop: { justifyContent: 'flex-start' },
  brandBlock: { alignItems: 'center', marginBottom: space('Spacing/20') },
  logo: { height: 68, resizeMode: 'contain', width: 68 },
  brandNameRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: space('Spacing/8'),
  },
  brandName: {
    color: fg.primary,
    letterSpacing: -0.6,
    textTransform: 'none',
  },
  brandTm: {
    color: fg.primary,
    fontFamily: 'PTSerif_700Bold',
    fontSize: BRAND_TM_FONT_SIZE,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: BRAND_TM_FONT_SIZE,
    marginLeft: 4,
    marginTop: BRAND_TM_SUPERSCRIPT_MARGIN_TOP,
  },
  card: {
    width: '100%',
    padding: space('Spacing/24'),
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordInputShell: {
    alignItems: 'center',
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordVisibilityButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: space('Spacing/12'),
  },
  passwordVisibilityLabel: {
    textDecorationLine: 'underline',
  },
  passwordRequirement: {
    marginTop: space('Spacing/8'),
  },
  primaryButton: {
    ...cardShadowRn,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  modeSwitch: {
    alignItems: 'center',
    borderColor: 'rgba(43,52,65,0.18)',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: space('Spacing/12'),
    minHeight: 46,
    paddingHorizontal: space('Spacing/12'),
  },
  pressed: { opacity: 0.75 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentBox: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  consentBoxChecked: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  consentMark: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  consentLabel: {
    flex: 1,
    lineHeight: 20,
  },
  consentLink: {
    color: '#1a1a1a',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  legalFooter: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
