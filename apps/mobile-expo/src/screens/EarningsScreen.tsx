import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getEarningsSnapshotForCurrentUser,
  getOutstandingPaymentsForCurrentUser,
  type EarningsSnapshotJob,
} from '@fieldsolo/api-client';
import { color, radius } from '@fieldsolo/design-system/lib/tokens';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import {
  platformHeaderDisplayTitleStyle,
} from '../components/platform/platformHeaderMetrics';
import { shellBottomNavOuterHeight } from '../components/shell/ShellBottomNav';
import {
  EarningsSnapshotCard,
  JobsOpenSummaryCard,
  RankedJobRowCard,
  SectionHeader,
  type JobsOpenSectionKind,
} from '../components/ds';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { analytics, errorProperties, moneyBucket } from '../lib/analytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  bg,
  cardShadowRn,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

export type EarningsWindow = 'week' | 'month' | 'year';

type EarningsScreenProps = {
  /** When false, the earnings tab is hidden — skip refetch until the user returns. */
  isActive?: boolean;
  /** Selected time window (controlled by the shell so Home can land on `week`). */
  window: EarningsWindow;
  onWindowChange: (next: EarningsWindow) => void;
  onOpenJobDetail: (jobId?: string) => void;
  /** Navigate to the Jobs screen, Open tab (unpaid section). */
  onOpenJobsOpenTab: (section: JobsOpenSectionKind) => void;
};

type WindowConfig = {
  tabLabel: string;
  windowDays: number;
  snapshotTitle: string;
  snapshotSubtitle: string;
};

const WINDOW_CONFIG: Record<EarningsWindow, WindowConfig> = {
  week: {
    tabLabel: 'WEEK',
    windowDays: 7,
    snapshotTitle: 'Weekly Snapshot',
    snapshotSubtitle: 'Completed jobs worked in the past 7 days',
  },
  month: {
    tabLabel: 'MONTH',
    windowDays: 30,
    snapshotTitle: 'Monthly Snapshot',
    snapshotSubtitle: 'Completed jobs worked in the past 30 days',
  },
  year: {
    tabLabel: 'YEAR',
    windowDays: 365,
    snapshotTitle: 'Annual Snapshot',
    snapshotSubtitle: 'Completed jobs worked in the past 365 days',
  },
};

const WINDOW_ORDER: EarningsWindow[] = ['week', 'month', 'year'];

type Typography = ReturnType<typeof createTextStyles>;

type SnapshotState = {
  netEarningsCents: number;
  revenueCents: number;
  materialsCents: number;
  costsCents: number;
  totalHours: number;
  jobCount: number;
  netPerHrCents: number | null;
  jobs: EarningsSnapshotJob[];
};

const EMPTY_SNAPSHOT: SnapshotState = {
  netEarningsCents: 0,
  revenueCents: 0,
  materialsCents: 0,
  costsCents: 0,
  totalHours: 0,
  jobCount: 0,
  netPerHrCents: null,
  jobs: [],
};

function formatUsd(cents: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

function formatNetPerHr(cents: number | null): string {
  if (cents == null) return '—';
  const dollars = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(cents / 100),
  );
  return `${cents < 0 ? '-' : ''}$${dollars.replace('-', '')}/hr`;
}

type RankedSection = {
  key: string;
  title: string;
  rows: { job: EarningsSnapshotJob; value: string; valueCents: number | null }[];
};

export function EarningsScreen({
  isActive = true,
  window,
  onWindowChange,
  onOpenJobDetail,
  onOpenJobsOpenTab,
}: EarningsScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const { version } = useJobsListInvalidation();

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography: Typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const [snapshotsByWindow, setSnapshotsByWindow] = useState<
    Record<EarningsWindow, SnapshotState>
  >({
    week: EMPTY_SNAPSHOT,
    month: EMPTY_SNAPSHOT,
    year: EMPTY_SNAPSHOT,
  });
  const snapshotsRef = useRef(snapshotsByWindow);
  useEffect(() => {
    snapshotsRef.current = snapshotsByWindow;
  }, [snapshotsByWindow]);

  const snapshot = snapshotsByWindow[window];
  const [outstanding, setOutstanding] = useState<{ count: number; revenueCents: number }>({
    count: 0,
    revenueCents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedWindowsRef = useRef<Set<EarningsWindow>>(new Set());
  const lastEarningsFetchVersionRef = useRef(-1);

  const config = WINDOW_CONFIG[window];

  const onSelectWindow = useCallback(
    (next: EarningsWindow) => {
      if (next !== window) {
        analytics.capture('earnings_window_changed', {
          from_window: window,
          to_window: next,
        });
      }
      onWindowChange(next);
    },
    [onWindowChange, window],
  );

  useEffect(() => {
    if (!isActive) return;
    const versionChanged = lastEarningsFetchVersionRef.current !== version;
    const allLoaded = WINDOW_ORDER.every((w) => loadedWindowsRef.current.has(w));
    if (!versionChanged && allLoaded) return;
    lastEarningsFetchVersionRef.current = version;

    let alive = true;
    const startedAt = Date.now();
    const isFirstLoad = !allLoaded;
    if (isFirstLoad) {
      setLoading(true);
    }
    setLoadError(null);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setLoadError('Supabase is not configured.');
      setSnapshotsByWindow({
        week: EMPTY_SNAPSHOT,
        month: EMPTY_SNAPSHOT,
        year: EMPTY_SNAPSHOT,
      });
      setOutstanding({ count: 0, revenueCents: 0 });
      loadedWindowsRef.current = new Set();
      analytics.capture('supabase_not_configured_seen', {
        screen: 'earnings',
        operation: 'earnings_loaded',
      });
      return;
    }
    void (async () => {
      try {
        const [owed, ...snapResults] = await Promise.all([
          getOutstandingPaymentsForCurrentUser(supabase),
          ...WINDOW_ORDER.map((w) =>
            getEarningsSnapshotForCurrentUser(supabase, {
              windowDays: WINDOW_CONFIG[w].windowDays,
            }),
          ),
        ]);
        if (!alive) return;
        const nextSnapshots: Record<EarningsWindow, SnapshotState> = {
          week: EMPTY_SNAPSHOT,
          month: EMPTY_SNAPSHOT,
          year: EMPTY_SNAPSHOT,
        };
        WINDOW_ORDER.forEach((w, i) => {
          const snap = snapResults[i];
          nextSnapshots[w] = {
            netEarningsCents: snap.aggregate.netEarningsCents,
            revenueCents: snap.aggregate.revenueCents,
            materialsCents: snap.aggregate.materialsCents,
            costsCents: snap.aggregate.costsCents,
            totalHours: snap.aggregate.totalHours,
            jobCount: snap.aggregate.jobCount,
            netPerHrCents: snap.aggregate.netPerHrCents,
            jobs: snap.jobs,
          };
        });
        setSnapshotsByWindow(nextSnapshots);
        setOutstanding({ count: owed.count, revenueCents: owed.revenueCents });
        for (const w of WINDOW_ORDER) {
          loadedWindowsRef.current.add(w);
        }
        const activeSnap = nextSnapshots[window];
        analytics.capture('earnings_loaded', {
          window,
          window_days: config.windowDays,
          net_bucket: moneyBucket(activeSnap.netEarningsCents),
          revenue_bucket: moneyBucket(activeSnap.revenueCents),
          materials_bucket: moneyBucket(activeSnap.materialsCents),
          hours_bucket:
            activeSnap.totalHours === 0
              ? 'zero'
              : activeSnap.totalHours < 5
                ? 'under_5'
                : activeSnap.totalHours < 20
                  ? '5_19'
                  : '20_plus',
          job_count: activeSnap.jobCount,
          outstanding_count: owed.count,
          outstanding_value_bucket: moneyBucket(owed.revenueCents),
          load_duration_ms: Date.now() - startedAt,
          prefetched_windows: WINDOW_ORDER.length,
        });
      } catch (err) {
        if (!alive) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load earnings.');
        setSnapshotsByWindow({
          week: EMPTY_SNAPSHOT,
          month: EMPTY_SNAPSHOT,
          year: EMPTY_SNAPSHOT,
        });
        setOutstanding({ count: 0, revenueCents: 0 });
        loadedWindowsRef.current = new Set();
        analytics.capture('earnings_load_failed', {
          window,
          window_days: config.windowDays,
          load_duration_ms: Date.now() - startedAt,
          ...errorProperties(err),
        });
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [config.windowDays, isActive, version, window]);

  const rankedSections = useMemo<RankedSection[]>(() => {
    const jobs = snapshot.jobs;
    const byNetDesc = [...jobs].sort((a, b) => b.netEarningsCents - a.netEarningsCents).slice(0, 3);
    const byNetAsc = [...jobs].sort((a, b) => a.netEarningsCents - b.netEarningsCents).slice(0, 3);
    const hourly = jobs.filter((j) => j.netPerHrCents != null);
    const byHrDesc = [...hourly]
      .sort((a, b) => (b.netPerHrCents ?? 0) - (a.netPerHrCents ?? 0))
      .slice(0, 3);
    const byHrAsc = [...hourly]
      .sort((a, b) => (a.netPerHrCents ?? 0) - (b.netPerHrCents ?? 0))
      .slice(0, 3);

    const earningsRows = (list: EarningsSnapshotJob[]) =>
      list.map((job) => ({
        job,
        value: formatUsd(job.netEarningsCents, 0),
        valueCents: job.netEarningsCents,
      }));
    const profitRows = (list: EarningsSnapshotJob[]) =>
      list.map((job) => ({
        job,
        value: formatNetPerHr(job.netPerHrCents),
        valueCents: job.netPerHrCents,
      }));

    return [
      { key: 'highest', title: 'Highest Earnings (Net)', rows: earningsRows(byNetDesc) },
      { key: 'lowest', title: 'Lowest Earnings (Net)', rows: earningsRows(byNetAsc) },
      { key: 'most', title: 'Most Profitable (Net/Hr)', rows: profitRows(byHrDesc) },
      { key: 'least', title: 'Least Profitable (Net/Hr)', rows: profitRows(byHrAsc) },
    ];
  }, [snapshot.jobs]);

  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);
  const bottomNavReservedHeight = shellBottomNavOuterHeight(insets.bottom);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      </View>
    );
  }

  return (
    <View style={styles.root} collapsable={false}>
      <CanvasTiledBackground scrollY={scrollY} contentHeight={scrollContentHeight} />
      <View
        pointerEvents="none"
        style={[styles.safeAreaTopAccentWrap, { top: 0 }]}
      >
        <View style={styles.topAccent} />
      </View>
      <Animated.ScrollView
        style={[styles.scroll, { paddingTop: headerTopPad }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: bottomNavReservedHeight + space('Spacing/20'),
            flexGrow: 1,
          },
        ]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
      >
        <View style={columnStyle}>
          <View style={styles.titleOnlyRow}>
            <Text
              {...screenHeaderA11y()}
              style={[
                typography.displayH1,
                Platform.OS === 'android'
                  ? platformHeaderDisplayTitleStyle(typography.displayH1)
                  : null,
              ]}
            >
              EARNINGS
            </Text>
          </View>

          <View style={styles.tabsWrap}>
            {WINDOW_ORDER.map((w) => {
              const selected = w === window;
              return (
                <Pressable
                  key={w}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectWindow(w)}
                  style={({ pressed }) => [
                    selected ? styles.tabActive : styles.tabIdle,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      typography.statusPillLabel,
                      styles.tabLabel,
                      { color: selected ? fg.primary : fg.secondary },
                    ]}
                  >
                    {WINDOW_CONFIG[w].tabLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={color('Brand/Primary')} />
              <Text style={[typography.body, { color: fg.primary, marginTop: space('Spacing/12') }]}>
                Loading earnings…
              </Text>
            </View>
          ) : loadError ? (
            <View style={styles.centerState}>
              <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
                {loadError}
              </Text>
            </View>
          ) : (
            <>
              <SectionHeader
                title={config.snapshotTitle}
                subtitle={config.snapshotSubtitle}
                tone="neutral"
                typography={typography}
                contentInset={0}
              />
              <View style={styles.cardBand}>
                <EarningsSnapshotCard
                  netEarnings={formatUsd(snapshot.netEarningsCents)}
                  netEarningsCents={snapshot.netEarningsCents}
                  revenue={formatUsd(snapshot.revenueCents)}
                  costs={formatUsd(snapshot.costsCents)}
                  time={`${snapshot.totalHours.toFixed(1)}h`}
                  netPerHr={formatNetPerHr(snapshot.netPerHrCents)}
                  netPerHrCents={snapshot.netPerHrCents}
                  jobs={String(snapshot.jobCount)}
                  typography={typography}
                />
              </View>

              {outstanding.count > 0 ? (
                <View style={[styles.cardBand, styles.cardBandTopGap]}>
                  <JobsOpenSummaryCard
                    kind="unpaid"
                    count={outstanding.count}
                    trailingValue={formatUsd(outstanding.revenueCents)}
                    typography={typography}
                    onPress={() => {
                      analytics.capture('outstanding_payment_card_pressed', {
                        outstanding_count: outstanding.count,
                        outstanding_value_bucket: moneyBucket(outstanding.revenueCents),
                      });
                      onOpenJobsOpenTab('unpaid');
                    }}
                  />
                </View>
              ) : null}

              {rankedSections.map((section) => (
                <View key={section.key} style={styles.sectionGroup}>
                  <SectionHeader
                    title={section.title}
                    tone="neutral"
                    typography={typography}
                    contentInset={0}
                  />
                  {section.rows.length === 0 ? (
                    <View style={styles.cardBand}>
                      <Text style={[typography.body, { color: fg.primary }]}>
                        No jobs in this period.
                      </Text>
                    </View>
                  ) : (
                    section.rows.map(({ job, value, valueCents }, index) => (
                      <View key={job.id} style={styles.cardBand}>
                        <RankedJobRowCard
                          rank={index + 1}
                          title={job.shortDescription || 'Untitled Job'}
                          subtitle={job.customerName}
                          value={value}
                          valueCents={valueCents}
                          typography={typography}
                          onPress={() => {
                            analytics.capture('earnings_ranked_job_pressed', {
                              section: section.key,
                              rank: index + 1,
                              job_id: job.id,
                            });
                            onOpenJobDetail(job.id);
                          }}
                        />
                      </View>
                    ))
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: {
    alignItems: 'stretch',
  },
  safeAreaTopAccentWrap: {
    position: 'absolute',
    width: '100%',
    alignSelf: 'center',
    zIndex: 5,
  },
  topAccent: {
    width: '100%',
    height: 6,
    backgroundColor: color('Brand/Accent'),
  },
  titleOnlyRow: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
    minHeight: 48,
    justifyContent: 'center',
  },
  tabsWrap: {
    width: '100%',
    backgroundColor: bg.subtle,
    borderRadius: radius('Radius/Full'),
    padding: space('Spacing/4'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabActive: {
    flex: 1,
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/Full'),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...cardShadowRn,
  },
  tabIdle: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    textTransform: 'uppercase',
  },
  cardBand: {
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 0,
    marginBottom: space('Spacing/16'),
  },
  cardBandTopGap: {
    marginTop: space('Spacing/8'),
  },
  sectionGroup: {
    width: '100%',
    alignItems: 'stretch',
  },
  centerState: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  pressed: { opacity: 0.75 },
});
