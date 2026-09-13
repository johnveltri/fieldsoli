import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import {
  fetchFirstJobIdForCurrentUser,
  getWeeklyNetEarningsCentsForCurrentUser,
  listJobsForCurrentUserPage,
  listRecentDetailedJobsForCurrentUser,
  type ListJobsForCurrentUserItem,
} from '@fieldsolo/api-client';
import { color, radius } from '@fieldsolo/design-system/lib/tokens';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import {
  dynamicTypeLineMinHeight,
  dynamicTypeTextStyle,
} from '../theme/dynamicTypeText';
import {
  JOBS_OPEN_SECTION_KINDS,
  JobCard,
  JobsOpenSummaryCard,
  MetricSnapshotCard,
  SectionHeader,
  type JobsOpenSectionKind,
} from '../components/ds';
import { TopHeaderProfileIcon } from '../components/figma-icons/TopHeaderIcons';
import { PlatformHeaderAction, platformHeaderActionIconColor } from '../components/platform/PlatformHeaderAction';
import {
  platformHeaderDisplayTitleStyle,
  platformHeaderRowStyle,
  platformHeaderTitleSlotStyle,
} from '../components/platform/platformHeaderMetrics';
import { earningsSuccessNegativeColor } from '../lib/financialColors';
import { shellBottomNavOuterHeight } from '../components/shell/ShellBottomNav';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import {
  analytics,
  errorProperties,
  moneyBucket,
} from '../lib/analytics';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { bucketOpenTabJobs } from '../lib/openJobsBuckets';
import {
  bg,
  cardShadowRn,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

const OPEN_TAB_PAGE_SIZE = 100;

function formatWeeklyUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export type HomeScreenProps = {
  onCreateFirstJob?: () => Promise<string>;
  onOpenProfile: () => void;
  onOpenJobDetail: (jobId?: string, options?: { initialEditOpen?: boolean }) => void;
  /** Navigate to the Earnings tab (Past Week) — fired by the weekly snapshot card. */
  onOpenEarnings: () => void;
  /** Navigate to Jobs → Open and scroll to the matching stack section. */
  onOpenJobsOpenTab: (section: JobsOpenSectionKind) => void;
};

export function HomeScreen({
  onCreateFirstJob = async () => { throw new Error('Could not create your first job.'); },
  onOpenProfile,
  onOpenJobDetail,
  onOpenEarnings,
  onOpenJobsOpenTab,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const { fontScale } = useWindowDimensions();
  const brandTitle = fontScale > 1.6 ? 'DASH\nBOARD' : 'DASHBOARD';
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const { version } = useJobsListInvalidation();

  const [homeLoading, setHomeLoading] = useState(true);
  const hasLoadedHomeRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [weeklyNetCents, setWeeklyNetCents] = useState(0);
  const [hasAnyJobs, setHasAnyJobs] = useState<boolean | null>(null);
  const [creatingFirstJob, setCreatingFirstJob] = useState(false);
  const [firstJobError, setFirstJobError] = useState<string | null>(null);
  const [openTabJobsPage, setOpenTabJobsPage] = useState<ListJobsForCurrentUserItem[]>([]);
  const [recentJobsDetail, setRecentJobsDetail] = useState<ListJobsForCurrentUserItem[]>([]);
  /** Lined canvas height — same pattern as JobDetail (`CanvasTiledBackground` + `onContentSizeChange`). */
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const brandDisplay = typography.displayH1;
  const brandTitleStyle = dynamicTypeTextStyle(brandDisplay, fontScale, {
    letterSpacingUntilScale: 99,
    padRatio: Platform.OS === 'android' ? 0 : 0.08,
  });
  const brandLineCount = brandTitle.includes('\n') ? 2 : 1;
  const brandMinHeight = dynamicTypeLineMinHeight(
    brandDisplay?.fontSize ?? 32,
    fontScale,
    1.4 * brandLineCount,
  );

  const openTabJobBuckets = useMemo(
    () => bucketOpenTabJobs(openTabJobsPage),
    [openTabJobsPage],
  );

  const needsAttentionSummaries = useMemo(
    () =>
      JOBS_OPEN_SECTION_KINDS.filter((kind) => openTabJobBuckets[kind].length > 0).map((kind) => ({
        kind,
        count: openTabJobBuckets[kind].length,
      })),
    [openTabJobBuckets],
  );

  const runHomeFetch = useCallback(async (isCancelled: () => boolean) => {
    const startedAt = Date.now();
    if (!isSupabaseConfigured()) {
      if (!isCancelled()) {
        setHomeError('Supabase is not configured.');
        setWeeklyNetCents(0);
        setOpenTabJobsPage([]);
        setRecentJobsDetail([]);
        analytics.capture('supabase_not_configured_seen', {
          screen: 'home',
          operation: 'home_loaded',
        });
      }
      return;
    }
    if (!isCancelled()) setHomeError(null);
    try {
      const [weekly, openPage, recent, firstJobId] = await Promise.all([
        getWeeklyNetEarningsCentsForCurrentUser(supabase),
        listJobsForCurrentUserPage(supabase, {
          limit: OPEN_TAB_PAGE_SIZE,
          offset: 0,
          tab: 'open',
        }),
        listRecentDetailedJobsForCurrentUser(supabase, { limit: 3 }),
        fetchFirstJobIdForCurrentUser(supabase),
      ]);
      if (!isCancelled()) {
        setWeeklyNetCents(weekly.netEarningsCents);
        setOpenTabJobsPage(openPage.items);
        setRecentJobsDetail(recent);
        setHasAnyJobs(firstJobId != null);
        const buckets = bucketOpenTabJobs(openPage.items);
        analytics.capture('home_loaded', {
          weekly_net_bucket: moneyBucket(weekly.netEarningsCents),
          weekly_earnings_available: true,
          jump_back_in_count: recent.length,
          needs_attention_count: buckets.incomplete.length + buckets.inProgress.length + buckets.unpaid.length,
          open_incomplete_count: buckets.incomplete.length,
          open_in_progress_count: buckets.inProgress.length,
          open_unpaid_count: buckets.unpaid.length,
          load_duration_ms: Date.now() - startedAt,
        });
      }
    } catch (err) {
      if (!isCancelled()) {
        setHomeError(err instanceof Error ? err.message : 'Failed to load home.');
        setWeeklyNetCents(0);
        setOpenTabJobsPage([]);
        setRecentJobsDetail([]);
        setHasAnyJobs(null);
        analytics.capture('home_load_failed', {
          failing_module: 'home',
          load_duration_ms: Date.now() - startedAt,
          ...errorProperties(err),
        });
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    if (!hasLoadedHomeRef.current) {
      setHomeLoading(true);
    }
    void (async () => {
      await runHomeFetch(() => !alive);
      if (alive) {
        setHomeLoading(false);
        hasLoadedHomeRef.current = true;
      }
    })();
    return () => {
      alive = false;
    };
  }, [version, runHomeFetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runHomeFetch(() => false);
    } finally {
      setRefreshing(false);
    }
  }, [runHomeFetch]);

  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);
  const bottomNavReservedHeight = shellBottomNavOuterHeight(insets.bottom);
  const scrollBottomPad =
    bottomNavReservedHeight +
    (fontScale > 1.6 ? space('Spacing/24') * Math.min(fontScale, 2.25) : 0);

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
            paddingBottom: scrollBottomPad,
          },
        ]}
        onContentSizeChange={(_w, h) => setScrollContentHeight(h)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color('Brand/Primary')} />
        }
      >
        <View style={columnStyle}>
          <View style={styles.headerBand}>
            <View style={styles.topHeader}>
              <View
                style={platformHeaderRowStyle(styles.topHeaderChromeRow, {
                  fixedHeight: brandLineCount === 1,
                })}
              >
                <View
                  style={
                    Platform.OS === 'android' && brandLineCount === 1
                      ? platformHeaderTitleSlotStyle(styles.brandTitleFlex)
                      : [styles.brandTitle, { minHeight: brandMinHeight }]
                  }
                >
                  <Text
                    {...screenHeaderA11y('Dashboard')}
                    style={[
                      platformHeaderDisplayTitleStyle(brandTitleStyle, {
                        allowWrap: brandLineCount > 1,
                      }),
                      styles.brandTitleText,
                    ]}
                  >
                    {brandTitle}
                  </Text>
                </View>
                <PlatformHeaderAction
                  accessibilityLabel="Profile"
                  variant="primary"
                  onPress={onOpenProfile}
                >
                  <TopHeaderProfileIcon color={platformHeaderActionIconColor} size={20} />
                </PlatformHeaderAction>
              </View>
            </View>
          </View>

          <View style={styles.modulesColumn}>
          {homeLoading ? (
            <ActivityIndicator
              color={color('Brand/Primary')}
              style={{ marginTop: space('Spacing/24'), marginBottom: space('Spacing/16') }}
            />
          ) : null}
          {homeError != null && homeError !== '' ? (
            <Text
              style={[typography.bodySmall, styles.homeError, { color: color('Semantic/Status/Error/Text') }]}
            >
              {homeError}
            </Text>
          ) : null}

          {!homeLoading && hasAnyJobs === false ? (
            <View style={styles.firstJobEmptyState}>
              <Image
                accessibilityIgnoresInvertColors
                source={require('../../assets/brand/fieldsoli-solo-notch-light.png')}
                style={styles.firstJobLogo}
              />
              <Text accessibilityRole="header" style={[typography.headingH2, styles.firstJobTitle, { color: fg.primary }]}>
                Looks like you don't have any jobs yet
              </Text>
              <Text style={[typography.bodySmall, styles.firstJobBody, { color: fg.primary }]}>
                FieldSoli is a jobs &amp; earnings tracker for independent tradespeople designed for the field.
              </Text>
              <Text style={[typography.bodySmall, styles.firstJobBody, { color: fg.primary }]}>
                Start with minimal info, and then let FieldSoli guide you to track enough so that you can understand your profitability. Track every job to understand your business and price smarter over time.
              </Text>
              {firstJobError ? (
                <Text style={[typography.bodySmall, styles.firstJobError, { color: color('Semantic/Status/Error/Text') }]}>
                  {firstJobError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={creatingFirstJob}
                onPress={() => {
                  if (creatingFirstJob) return;
                  setCreatingFirstJob(true);
                  setFirstJobError(null);
                  void onCreateFirstJob()
                    .catch((error) => setFirstJobError(error instanceof Error ? error.message : 'Could not create your first job.'))
                    .finally(() => setCreatingFirstJob(false));
                }}
                style={({ pressed }) => [styles.firstJobButton, (pressed || creatingFirstJob) && styles.pressed]}
              >
                {creatingFirstJob ? (
                  <ActivityIndicator color={bg.canvasWarm} />
                ) : (
                  <Text style={[typography.bodyBold, styles.firstJobButtonText]}>Create my first job</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {!homeLoading && hasAnyJobs !== false ? (
            <>
              <SectionHeader
                title="Weekly Snapshot"
                subtitle="Completed jobs worked in the past 7 days"
                tone="neutral"
                typography={typography}
                contentInset={0}
              />
              <MetricSnapshotCard
                label="NET EARNINGS"
                value={formatWeeklyUsd(weeklyNetCents)}
                helperText={
                  weeklyNetCents === 0
                    ? needsAttentionSummaries.some((s) => s.kind === 'incomplete')
                      ? 'No earnings from this week'
                      : 'No earnings from this week. Complete a job to track earnings here.'
                    : undefined
                }
                valueTone="success"
                valueColor={earningsSuccessNegativeColor(weeklyNetCents)}
                typography={typography}
                onPress={onOpenEarnings}
              />
            </>
          ) : null}

          {hasAnyJobs !== false && needsAttentionSummaries.length > 0 ? (
            <>
              <SectionHeader
                title="Needs Attention"
                tone="neutral"
                typography={typography}
                contentInset={0}
              />
              <View style={styles.needsAttentionBlock}>
                {needsAttentionSummaries.map(({ kind, count }) => (
                  <View key={kind} style={styles.needsAttentionRowWrap}>
                    <JobsOpenSummaryCard
                      kind={kind}
                      count={count}
                      typography={typography}
                      onPress={() => {
                        analytics.capture('home_needs_attention_summary_pressed', {
                          open_section: kind,
                          job_count: count,
                        });
                        analytics.capture('home_jobs_open_pressed', {
                          source: 'needs_attention',
                          open_section: kind,
                        });
                        onOpenJobsOpenTab(kind);
                      }}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {hasAnyJobs !== false && recentJobsDetail.length > 0 ? (
            <>
              <SectionHeader
                title="Jump Back In"
                tone="neutral"
                typography={typography}
                contentInset={0}
              />
              <View style={styles.jumpBackList}>
                {recentJobsDetail.map((job) => (
                  <View key={job.id} style={styles.jumpBackRowWrap}>
                    <JobCard
                      job={job}
                      typography={typography}
                      recencyLabelMode="lastUpdated"
                      onPress={() => {
                        analytics.capture('home_job_card_pressed', {
                          module: 'jump_back_in',
                          job_id: job.id,
                          job_status: job.workStatus,
                        });
                        onOpenJobDetail(job.id);
                      }}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  scrollContent: {
    // Stretch lets capped-width bands use full width; `alignSelf: 'center'` on
    // those bands keeps cards centered on wider Android screens.
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
  headerBand: {
    width: '100%',
    alignItems: 'center',
    overflow: 'visible',
  },
  modulesColumn: {
    width: '100%',
    alignItems: 'stretch',
    overflow: 'visible',
  },
  firstJobEmptyState: {
    ...cardShadowRn,
    alignItems: 'center',
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    marginTop: space('Spacing/20'),
    padding: space('Spacing/28'),
  },
  firstJobLogo: {
    height: 76,
    marginBottom: space('Spacing/24'),
    resizeMode: 'contain',
    width: 76,
  },
  firstJobTitle: {
    marginBottom: space('Spacing/20'),
    textAlign: 'center',
  },
  firstJobBody: {
    marginBottom: space('Spacing/16'),
    textAlign: 'center',
  },
  firstJobError: {
    marginBottom: space('Spacing/12'),
    textAlign: 'center',
  },
  firstJobButton: {
    alignItems: 'center',
    backgroundColor: color('Brand/Primary'),
    borderRadius: radius('Radius/12'),
    justifyContent: 'center',
    marginTop: space('Spacing/12'),
    minHeight: 52,
    paddingHorizontal: space('Spacing/20'),
    width: '100%',
  },
  firstJobButtonText: {
    color: bg.canvasWarm,
  },
  homeError: {
    textAlign: 'center',
    marginBottom: space('Spacing/12'),
  },
  needsAttentionBlock: {
    width: '100%',
  },
  needsAttentionRowWrap: {
    width: '100%',
    marginBottom: space('Spacing/12'),
  },
  jumpBackList: {
    width: '100%',
  },
  jumpBackRowWrap: {
    width: '100%',
    marginBottom: space('Spacing/12'),
  },
  topHeader: {
    width: '100%',
    // Horizontal inset comes from the shared responsive content column.
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/8'),
  },
  topHeaderChromeRow: {
    width: '100%',
    justifyContent: 'space-between',
    gap: space('Spacing/12'),
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
    justifyContent: 'center',
  },
  brandTitleFlex: {
    minWidth: 0,
    overflow: 'visible',
  },
  brandTitleText: {
    width: '100%',
  },
  pressed: { opacity: 0.75 },
});
