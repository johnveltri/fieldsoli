import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestJobExport, JobExportRequestError } from '@fieldsolo/api-client';
import { color } from '@fieldsolo/design-system/lib/tokens';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { DropdownBottomSheet, type DropdownBottomSheetOption } from '../components/ds';
import { PlatformHeaderAction } from '../components/platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../components/figma-icons/TopHeaderIcons';
import { JobDetailIconViewSessionChevron } from '../components/figma-icons/JobDetailScreenIcons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  buildJobExportYears,
  resolveReportingTimeZone,
} from '../lib/jobExportYears';
import {
  bg,
  border,
  cardShadowRn,
  createTextStyles,
  fg,
  radius,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

const BACK_ICON_SIZE = 28;

export type JobExportScreenProps = {
  onBack: () => void;
  onBackToHome: () => void;
};

type RequestState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'confirmed'; email: string }
  | { kind: 'no_eligible_jobs' }
  | { kind: 'rate_limited'; retryAt: string }
  | { kind: 'error' };

function formatRetryAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function JobExportScreen({ onBack, onBackToHome }: JobExportScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const { session } = useAuth();
  const [scrollY] = useState(() => new Animated.Value(0));
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>({ kind: 'idle' });

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);
  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );
  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);

  const user = session?.user ?? null;
  const reportingTimeZone = resolveReportingTimeZone();
  const yearsResult = useMemo(() => {
    if (!user?.created_at || !reportingTimeZone) return { years: [], error: true };
    try {
      return {
        years: buildJobExportYears(user.created_at, reportingTimeZone),
        error: false,
      };
    } catch {
      return { years: [], error: true };
    }
  }, [reportingTimeZone, user?.created_at]);
  const years = yearsResult.years;
  const selectedYear = years[0] ?? new Date().getFullYear();
  const [year, setYear] = useState(selectedYear);
  const activeYear = years.includes(year) ? year : selectedYear;
  const options = useMemo<DropdownBottomSheetOption[]>(
    () => years.map((value) => ({ id: String(value), label: String(value), value: String(value) })),
    [years],
  );
  const verifiedEmail = user?.email ?? '—';
  const emailVerified = !!user?.email && !!user.email_confirmed_at;
  const terminalResult =
    requestState.kind === 'confirmed' || requestState.kind === 'no_eligible_jobs';

  const submit = useCallback(async () => {
    if (requestState.kind === 'submitting') return;
    if (!reportingTimeZone || years.length === 0) {
      setRequestState({ kind: 'error' });
      return;
    }
    setRequestState({ kind: 'submitting' });
    try {
      const result = await requestJobExport(supabase, {
        year: activeYear,
        timeZone: reportingTimeZone,
      });
      if (result.status === 'confirmed') {
        setRequestState({ kind: 'confirmed', email: result.recipientEmail });
      } else if (result.status === 'no_eligible_jobs') {
        setRequestState({ kind: 'no_eligible_jobs' });
      } else {
        setRequestState({ kind: 'rate_limited', retryAt: result.retryAt });
      }
    } catch (error) {
      // Keep the client copy intentionally generic; the server status/code is
      // useful to callers and logs, but should not expose account details here.
      if (
        typeof JobExportRequestError === 'function' &&
        error instanceof JobExportRequestError &&
        error.status === 429 &&
        error.retryAt
      ) {
        setRequestState({ kind: 'rate_limited', retryAt: error.retryAt });
      } else {
        setRequestState({ kind: 'error' });
      }
    }
  }, [activeYear, requestState.kind, reportingTimeZone, years.length]);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      </View>
    );
  }

  const resultCopy =
    requestState.kind === 'confirmed'
      ? `Your ${activeYear} job export has been requested. It will be delivered to ${requestState.email} within a few minutes. The download link expires within 24 hours from receipt.`
      : requestState.kind === 'no_eligible_jobs'
        ? `No completed jobs found for ${activeYear}.`
        : null;
  const requestErrorCopy =
    requestState.kind === 'rate_limited'
      ? `You’ve reached the export limit. Try again after ${formatRetryAt(requestState.retryAt)}.`
      : requestState.kind === 'error'
        ? 'Couldn’t request your export. Try again later.'
        : null;

  return (
    <View style={styles.root}>
      <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      <Animated.ScrollView
        style={[styles.scroll, { paddingTop: headerTopPad }]}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onContentSizeChange={(_width, height) => setScrollContentHeight(height)}
      >
        <View style={columnStyle}>
          <View style={styles.topHeaderRow}>
            <PlatformHeaderAction accessibilityLabel="Back" onPress={onBack}>
              <TopHeaderBackIcon size={BACK_ICON_SIZE} color={fg.primary} />
            </PlatformHeaderAction>
            <Text {...screenHeaderA11y()} selectable style={[typography.displayH1, styles.title]}>
              EXPORT JOBS
            </Text>
          </View>

          <View style={styles.body}>
            {terminalResult ? (
              <View accessibilityLiveRegion="polite" testID="job-export-result-card" style={styles.resultCard}>
                {requestState.kind === 'confirmed' ? (
                  <Text selectable style={[typography.titleH3, styles.resultTitle]}>Export requested</Text>
                ) : null}
                <Text selectable style={[typography.body, styles.resultText]}>{resultCopy}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Home"
                  onPress={onBackToHome}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text selectable style={[typography.bodyBold, styles.secondaryButtonText]}>Back to Home</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text selectable style={[typography.labelCaps, styles.label]}>YEAR</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Export year ${activeYear}`}
                  onPress={() => setYearPickerOpen(true)}
                  disabled={years.length === 0}
                  style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
                >
                  <View style={styles.selectorLeading}>
                    <Text selectable style={[typography.body, styles.selectorText]}>{activeYear}</Text>
                  </View>
                  <View style={styles.selectorTrailing}>
                    <JobDetailIconViewSessionChevron color={fg.secondary} />
                  </View>
                </Pressable>
                {yearsResult.error ? (
                  <Text selectable style={[typography.bodySmall, styles.errorText]}>
                    We couldn’t determine the available years. Try again later.
                  </Text>
                ) : null}

                <Text selectable style={[typography.labelCaps, styles.label]}>DELIVERY</Text>
                <View style={styles.infoCard}>
                  <Text selectable style={[typography.bodySmall, styles.infoLabel]}>Email</Text>
                  <Text selectable style={typography.body}>{verifiedEmail}</Text>
                  {!emailVerified ? (
                    <Text selectable style={[typography.bodySmall, styles.errorText]}>
                      Verify your email before requesting an export.
                    </Text>
                  ) : null}
                </View>

                <Text selectable style={[typography.labelCaps, styles.label]}>INCLUDED DATA</Text>
                <View style={styles.infoCard}>
                  <Text selectable style={[typography.body, styles.infoBody]}>
                    Completed jobs, customer names, phone numbers, emails, service addresses, dates, revenue, costs, and net earnings.
                  </Text>
                </View>

                {requestErrorCopy ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    selectable
                    testID="job-export-request-error"
                    style={[typography.bodySmall, styles.errorText]}
                  >
                    {requestErrorCopy}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Request Export"
                  onPress={() => void submit()}
                  disabled={!emailVerified || requestState.kind === 'submitting'}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                    (!emailVerified || requestState.kind === 'submitting') && styles.disabled,
                  ]}
                >
                  {requestState.kind === 'submitting' ? <ActivityIndicator color={bg.canvasWarm} /> : null}
                  <Text selectable style={[typography.bodyBold, styles.primaryButtonText]}>Request Export</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      <DropdownBottomSheet
        typography={typography}
        visible={yearPickerOpen}
        title="Export year"
        options={options}
        currentValue={String(activeYear)}
        onClose={() => setYearPickerOpen(false)}
        onClosed={() => undefined}
        onBack={() => setYearPickerOpen(false)}
        onSelect={(value) => {
          setYear(Number(value));
          if (requestState.kind === 'rate_limited' || requestState.kind === 'error') {
            setRequestState({ kind: 'idle' });
          }
          setYearPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: { paddingBottom: space('Spacing/32'), flexGrow: 1, alignItems: 'stretch' },
  topHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
    gap: space('Spacing/8'),
  },
  title: { flex: 1, color: fg.primary },
  body: { width: '100%', gap: space('Spacing/12'), paddingBottom: space('Spacing/24') },
  label: { color: color('Brand/Accent'), paddingTop: space('Spacing/12') },
  selector: {
    width: '100%',
    minHeight: space('Spacing/80'),
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/16'),
    backgroundColor: bg.surfaceWhite,
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLeading: {
    flex: 1,
    minWidth: 0,
    paddingVertical: space('Spacing/4'),
  },
  selectorTrailing: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: { color: fg.primary },
  infoCard: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/12'),
    padding: space('Spacing/16'),
    gap: space('Spacing/8'),
    ...cardShadowRn,
  },
  infoLabel: { color: fg.secondary },
  infoBody: { color: fg.primary },
  errorText: { color: color('Semantic/Status/Error/Text') },
  resultTitle: { color: fg.primary },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius('Radius/12'),
    backgroundColor: color('Brand/Primary'),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space('Spacing/8'),
    marginTop: space('Spacing/8'),
  },
  primaryButtonText: { color: bg.canvasWarm },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radius('Radius/12'),
    borderWidth: 1,
    borderColor: color('Foundation/Border/Default'),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space('Spacing/12'),
  },
  secondaryButtonText: { color: fg.primary },
  resultCard: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/12'),
    padding: space('Spacing/16'),
    marginTop: space('Spacing/8'),
    gap: space('Spacing/8'),
    ...cardShadowRn,
  },
  resultText: { color: fg.primary },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.75 },
});
