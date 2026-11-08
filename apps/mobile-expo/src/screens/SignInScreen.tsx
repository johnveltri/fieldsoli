import { color } from '@fieldsolo/design-system/lib/tokens';
import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
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

import { clearPendingSignup, readPendingSignup, savePendingSignup } from '../lib/pendingSignup';

import { AuthWelcome } from './AuthWelcome';
import { useAuth } from '../context/AuthContext';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { analytics, emailProperties, errorProperties } from '../lib/analytics';
import { analyticsConfig } from '../lib/analytics/config';
import {
  LEGAL_URLS,
  REQUIRED_PRIVACY_VERSION,
  REQUIRED_TERMS_VERSION,
} from '../lib/legal-versions';
import { cacheLegalAcceptance } from '../lib/legalAcceptanceStorage';
import { commitPasswordAutofill } from '../lib/passwordAutofill';
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

export function SignInScreen({ initialMode = 'welcome' }: { initialMode?: 'welcome' | 'signIn' | 'signUp' } = {}) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const { signIn, signUp, requestPasswordReset, setSignupLegalPending } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoreAllowed = useRef(true);
  const [restoringEntry, setRestoringEntry] = useState(initialMode === 'welcome');
  const [mode, setModeState] = useState<
    'welcome' | 'signIn' | 'signUp' | 'checkEmail' | 'forgotPassword' | 'resetEmailSent'
  >(initialMode);
  const setMode = useCallback<typeof setModeState>((next) => {
    restoreAllowed.current = false;
    setModeState(next);
  }, []);
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
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const scrollInputIntoView = useCallback((nativeTarget?: number) => {
    if (nativeTarget == null) return;
    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
      nativeTarget,
      AUTH_KEYBOARD_FOCUS_OFFSET,
      true,
    );
  }, []);

  useEffect(() => {
    if (mode !== 'welcome') analytics.capture('auth_screen_viewed', { mode });
  }, [mode]);

  useEffect(() => {
    announceAccessibilityMessage(error);
  }, [error]);

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    if (mode !== 'welcome' && previousModeRef.current !== 'welcome') analytics.capture('auth_mode_changed', {
      from_mode: previousModeRef.current,
      to_mode: mode,
    });
    previousModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let active = true;
    const openSignInFromDeepLink = (url: string | null) => {
      if (!url || !isAppSignInDeepLink(url)) return;
      setMode('signIn');
      setError(null);
      setResendNotice(null);
    };
    void Promise.all([Linking.getInitialURL(), readPendingSignup()]).then(([url, pendingEmail]) => {
      if (!active) return;
      if (url) { openSignInFromDeepLink(url); return; }
      if (restoreAllowed.current && pendingEmail) {
        setEmail(pendingEmail);
        setPendingConfirmEmail(pendingEmail);
        setMode('checkEmail');
      }
    }).catch(() => undefined).finally(() => { if (active && initialMode === 'welcome') setRestoringEntry(false); });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      openSignInFromDeepLink(url);
    });
    return () => { active = false; subscription.remove(); };
  }, [setMode, initialMode]);

  const onAuthBack = useCallback(() => {
    if (busy || resendBusy) return;
    Keyboard.dismiss();
    if (mode === 'checkEmail') {
      void clearPendingSignup();
      setEmail(pendingConfirmEmail);
      setVerificationCode('');
      setMode('signIn');
    } else {
      setMode('welcome');
    }
    setError(null);
    setResendNotice(null);
  }, [busy, resendBusy, mode, pendingConfirmEmail, setMode]);

  useEffect(() => {
    if (mode !== 'signIn' && mode !== 'signUp' && mode !== 'checkEmail') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onAuthBack(); return true; });
    return () => subscription.remove();
  }, [mode, onAuthBack]);

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
  const canCreateAccount = passwordMeetsPolicy && legalAccepted && !busy;
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

  const continueVerification = useCallback(async (targetEmail: string) => {
    restoreAllowed.current = false;
    setEmail(targetEmail);
    setPendingConfirmEmail(targetEmail);
    setPassword('');
    setVerificationCode('');
    setError(null);
    setResendNotice(null);
    setMode('checkEmail');
    await savePendingSignup(targetEmail);
  }, [setMode]);

  const onResendConfirmation = useCallback(async () => {
    const targetEmail = pendingConfirmEmail || email.trim().toLowerCase();
    if (!targetEmail || busy || resendBusy) return;
    setResendNotice(null);
    setResendBusy(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: { emailRedirectTo: AUTH_CONFIRM_URL },
      });
      if (resendErr) {
        setResendNotice(resendErr.status === 429
          ? 'Please wait before requesting another email.'
          : 'Could not request a confirmation email. Try again or sign in.');
        return;
      }
      setResendNotice('If this email needs confirmation, check your inbox for a code or confirmation link.');
    } catch {
      setResendNotice('Could not request a confirmation email. Check your connection and try again.');
    } finally {
      setResendBusy(false);
    }
  }, [email, pendingConfirmEmail, busy, resendBusy]);

  const onVerifyCode = useCallback(async () => {
    if (busy || resendBusy || !verificationCode.trim() || !pendingConfirmEmail) return;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingConfirmEmail,
        token: verificationCode.trim(),
        type: 'email',
      });
      if (verifyError || !data.session) setError('That code is invalid or has expired. Check the code or request a new one.');
      else { setVerificationCode(''); await clearPendingSignup(); }
    } catch {
      setError('Could not verify your email. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, resendBusy, pendingConfirmEmail, verificationCode]);

  const onSubmit = useCallback(async () => {
    restoreAllowed.current = false;
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
          if (err.code === 'email_not_confirmed' || err.message.toLowerCase().includes('email not confirmed')) {
            await continueVerification(trimmed);
          } else setError(authErrorMessage(err));
        } else {
          await clearPendingSignup();
          analytics.capture('sign_in_succeeded', {
            ...emailProperties(trimmed),
          });
        }
      } else {
        analytics.capture('sign_up_submitted', {
          ...emailProperties(trimmed),
        });
        // First/last name go into raw_user_meta_data so the
        // public.handle_new_user trigger can seed the profiles row.
        const { error: signUpErr, session: signUpSession } = await signUp(trimmed, password, {
          firstName: '',
          lastName: '',
          legalAcceptance: {
            accepted: true,
            termsVersion: REQUIRED_TERMS_VERSION,
            privacyVersion: REQUIRED_PRIVACY_VERSION,
            appVersion: analyticsConfig.appVersion,
            platform: analyticsConfig.platform,
          },
        });
        if (signUpErr) {
          analytics.capture('sign_up_failed', {
            stage: 'sign_up',
            ...emailProperties(trimmed),
            ...errorProperties(signUpErr),
          });
          if (('code' in signUpErr && signUpErr.code === 'user_already_exists') || signUpErr.message.toLowerCase().includes('user already registered')) {
            await continueVerification(trimmed);
          } else setError(authErrorMessage(signUpErr));
          return;
        }
        analytics.capture('sign_up_succeeded', {
          ...emailProperties(trimmed),
        });
        // Do not set signupLegalPending until we have a session. That flag
        // replaces SignInScreen with a spinner in App.tsx; flipping it early
        // unmounts this screen and drops the check-email state.
        const acceptedUserId = signUpSession?.user.id ?? null;
        if (!signUpSession) {
          await commitPasswordAutofill();
          await continueVerification(trimmed);
          announceAccessibilityMessage('Check your email, or sign in if you already have an account.');
          return;
        }

        await clearPendingSignup();
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
  }, [email, password, legalAccepted, mode, setSignupLegalPending, signIn, signUp, requestPasswordReset, continueVerification]);

  if (!fontsLoaded || restoringEntry) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <CanvasTiledBackground scrollY={scrollY} />
        <ActivityIndicator />
      </View>
    );
  }

  if (mode === 'welcome') {
    return <AuthWelcome onSignIn={() => setMode('signIn')} onCreateAccount={() => setMode('signUp')} />;
  }

  const gap = space('Spacing/20');

  return (
    <View style={styles.root}>
      <CanvasTiledBackground scrollY={scrollY} />
      {mode === 'checkEmail' || mode === 'signIn' || mode === 'signUp' ? (
        <View style={{ paddingTop: insets.top + space('Spacing/8'), paddingHorizontal: space('Spacing/24') }}>
          <PlatformHeaderAction accessibilityLabel="Back" disabled={busy || resendBusy} onPress={onAuthBack}>
            <TopHeaderBackIcon size={28} color={fg.primary} />
          </PlatformHeaderAction>
        </View>
      ) : null}
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
              paddingTop: mode === 'checkEmail' || mode === 'signIn' || mode === 'signUp' ? gap : insets.top + gap,
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
                  Enter the verification code for{' '}<Text style={[text.bodySemi, { color: fg.primary }]}>{pendingConfirmEmail}</Text>.
                </Text>
                <DsTextInput
                  accessibilityLabel="Verification code"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  keyboardType="number-pad"
                  editable={!busy}
                  placeholder="Verification code"
                  style={[styles.input, text.body, { color: fg.primary, marginBottom: gap }]}
                />
                {error ? <Text style={[text.caption, { color: '#b00020', marginBottom: gap }]}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || resendBusy || !verificationCode.trim(), busy }}
                  disabled={busy || resendBusy || !verificationCode.trim()}
                  onPress={() => void onVerifyCode()}
                  style={({ pressed }) => [styles.primaryButton, (busy || resendBusy || !verificationCode.trim()) && styles.primaryButtonDisabled, pressed && styles.primaryButtonPressed, { marginBottom: gap }]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={[text.bodySemi, { color: '#fff' }]}>Verify email</Text>}
                </Pressable>
                {resendNotice ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[
                      text.caption,
                      {
                        color: resendNotice.startsWith('If this email') ? fg.secondary : '#b00020',
                        marginBottom: gap,
                      },
                    ]}
                  >
                    {resendNotice}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || resendBusy, busy: resendBusy }}
                  onPress={() => void onResendConfirmation()}
                  disabled={busy || resendBusy}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    (busy || resendBusy) && styles.primaryButtonDisabled,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  {resendBusy ? (
                    <ActivityIndicator color={fg.primary} />
                  ) : (
                    <Text style={[text.bodySemi, { color: fg.primary }]}>Resend email</Text>
                  )}
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

            <Text style={[text.caption, { color: fg.secondary, marginBottom: space('Spacing/8') }]}>
              Email
            </Text>
            <DsTextInput
              ref={emailInputRef}
              value={email}
              onChangeText={(value) => {
                  restoreAllowed.current = false;
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
              autoComplete={mode === 'forgotPassword' ? 'email' : 'username'}
              autoCorrect={false}
              keyboardType="email-address"
              textContentType={mode === 'forgotPassword' ? 'emailAddress' : 'username'}
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
                  restoreAllowed.current = false;
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
                returnKeyType="done"
                onSubmitEditing={() => { if (mode === 'signIn' || canCreateAccount) void onSubmit(); }}
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

            {mode === 'signIn' && pendingConfirmEmail && email.trim().toLowerCase() === pendingConfirmEmail ? (
              <Pressable accessibilityRole="button" disabled={busy} style={{ alignSelf: 'flex-start', marginTop: space('Spacing/16'), minHeight: 44, justifyContent: 'center' }}
                onPress={() => void continueVerification(email.trim().toLowerCase())}>
                <Text style={[text.caption, styles.consentLink]}>Continue email verification</Text>
              </Pressable>
            ) : null}

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
    backgroundColor: color('Brand/Primary'),
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(43,52,65,0.18)',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
