import { useFonts } from 'expo-font';
import {
  fieldsoloExpoFontAssets,
  fieldsoloLoadedFonts,
} from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatList,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  countInboxItems,
  listJobsForCurrentUserPage,
  type ListJobsForCurrentUserItem,
  type ListJobsForCurrentUserTab,
} from '@fieldsolo/api-client';
import { color, colorWithAlpha, radius } from '@fieldsolo/design-system/lib/tokens';
import { incompletePillsForListJob } from '../lib/jobFinancialCompleteness';

import { CanvasTiledBackground } from '../components/CanvasTiledBackground';
import { PlatformHeaderAction, platformHeaderActionIconColor } from '../components/platform/PlatformHeaderAction';
import {
  PlatformHeaderTitle,
  platformHeaderRowStyle,
} from '../components/platform/platformHeaderMetrics';
import {
  JobsInboxIcon,
  JobsSearchClearIcon,
  JobsSearchIcon,
} from '../components/figma-icons/JobsScreenIcons';
import {
  JobCard,
  JobsOpenStackSectionHeader,
  type JobsOpenSectionKind,
} from '../components/ds';
import { shellBottomNavOuterHeight } from '../components/shell/ShellBottomNav';
import { useJobsListInvalidation } from '../context/JobsListInvalidationContext';
import { analytics, errorProperties } from '../lib/analytics';
import { bucketOpenTabJobs } from '../lib/openJobsBuckets';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  recencyBucket,
  RECENCY_BUCKET_TITLE,
  type RecencyBucket,
} from '../lib/timeBuckets';
import { DsTextInput } from '../components/ds/DsTextInput';
import {
  bg,
  border,
  cardShadowRn,
  createTextStyles,
  fg,
  space,
} from '../theme/nativeTokens';
import { useContentColumn } from '../theme/useContentColumn';
import { screenHeaderA11y } from '../lib/accessibility';

const PAGE_SIZE = 20;

const JOBS_TABS: ListJobsForCurrentUserTab[] = ['all', 'open', 'paid'];

type TabCacheEntry = {
  jobs: ListJobsForCurrentUserItem[];
  hasMore: boolean;
  loaded: boolean;
};

function emptyTabCache(): Record<ListJobsForCurrentUserTab, TabCacheEntry> {
  return {
    all: { jobs: [], hasMore: true, loaded: false },
    open: { jobs: [], hasMore: true, loaded: false },
    paid: { jobs: [], hasMore: true, loaded: false },
  };
}

type JobsScreenProps = {
  /** When false, the jobs tab is hidden — skip list refetch until the user returns. */
  isActive?: boolean;
  onOpenJobDetail: (jobId?: string, options?: { initialEditOpen?: boolean }) => void;
  /** Open the Inbox of unassigned quick captures (header icon). */
  onOpenInbox?: () => void;
  /**
   * When both are set, the All / Open / Paid tab is controlled by the parent so it
   * survives navigation (e.g. Job Detail unmounts this screen).
   */
  jobsListTab?: ListJobsForCurrentUserTab;
  onJobsListTabChange?: (tab: ListJobsForCurrentUserTab) => void;
  /** Scroll Open tab to this section header after deep-link navigation from Home/Earnings. */
  openScrollToSection?: JobsOpenSectionKind | null;
  /** Bumped on each deep-link so repeated taps re-scroll the same section. */
  openScrollNonce?: number;
  onOpenScrollToSectionHandled?: () => void;
};

type Typography = ReturnType<typeof createTextStyles>;

function incompletePillsFor(job: ListJobsForCurrentUserItem): string[] {
  return incompletePillsForListJob(job);
}

type JobsFlatRow =
  | { kind: 'section'; key: string; mode: 'recency'; title: string }
  | {
      kind: 'section';
      key: string;
      mode: 'openStack';
      openKind: JobsOpenSectionKind;
      count: number;
    }
  | { kind: 'job'; job: ListJobsForCurrentUserItem; key: string; incompletePills?: string[] };

function buildFlatRows(jobs: ListJobsForCurrentUserItem[]): JobsFlatRow[] {
  const nowMs = Date.now();
  let prev: RecencyBucket | null = null;
  const rows: JobsFlatRow[] = [];
  for (const job of jobs) {
    const b = recencyBucket(job.lastWorkedAt, job.createdAt, nowMs);
    if (b !== prev) {
      rows.push({
        kind: 'section',
        mode: 'recency',
        title: RECENCY_BUCKET_TITLE[b],
        key: `h-${b}-${rows.length}`,
      });
      prev = b;
    }
    rows.push({ kind: 'job', job, key: job.id });
  }
  return rows;
}

function buildOpenFlatRows(jobs: ListJobsForCurrentUserItem[]): JobsFlatRow[] {
  const { incomplete, inProgress, unpaid } = bucketOpenTabJobs(jobs);

  const rows: JobsFlatRow[] = [];
  const pushOpenSection = (
    openKind: JobsOpenSectionKind,
    sectionJobs: ListJobsForCurrentUserItem[],
    withPills: boolean,
  ) => {
    if (sectionJobs.length === 0) return;
    rows.push({
      kind: 'section',
      mode: 'openStack',
      openKind,
      count: sectionJobs.length,
      key: `h-open-${openKind}-${rows.length}`,
    });
    for (const job of sectionJobs) {
      rows.push({
        kind: 'job',
        job,
        key: job.id,
        incompletePills: withPills ? incompletePillsFor(job) : undefined,
      });
    }
  };

  pushOpenSection('incomplete', incomplete, true);
  pushOpenSection('inProgress', inProgress, false);
  pushOpenSection('unpaid', unpaid, false);
  return rows;
}

function JobsLoadingSkeleton({ typography }: { typography: Typography }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const { columnStyle } = useContentColumn();
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.skeletonWrap, columnStyle]} accessibilityLabel="Loading jobs">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonRow,
            {
              opacity: pulse,
            },
          ]}
        />
      ))}
      <ActivityIndicator color={color('Brand/Primary')} style={{ marginTop: space('Spacing/24') }} />
      <Text style={[typography.body, { color: fg.primary, marginTop: space('Spacing/12') }]}>
        Loading jobs…
      </Text>
    </View>
  );
}

export function JobsScreen({
  onOpenJobDetail,
  onOpenInbox,
  isActive = true,
  jobsListTab: jobsListTabProp,
  onJobsListTabChange,
  openScrollToSection = null,
  openScrollNonce = 0,
  onOpenScrollToSectionHandled,
}: JobsScreenProps) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const scrollOffsetRef = useRef(0);
  const { version } = useJobsListInvalidation();
  const [fontsLoaded] = useFonts(fieldsoloExpoFontAssets);

  const typography = useMemo(
    () =>
      createTextStyles(fieldsoloLoadedFonts),
    [],
  );

  const [tabCache, setTabCache] = useState(emptyTabCache);
  const tabCacheRef = useRef(tabCache);
  useEffect(() => {
    tabCacheRef.current = tabCache;
  }, [tabCache]);

  // Live count of unassigned quick captures for the header Inbox badge.
  // Refetched whenever the jobs list is invalidated (e.g. after a capture or
  // an assign-to-job), so the badge stays in sync without its own channel.
  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const counts = await countInboxItems(supabase);
        if (alive) setInboxCount(counts.total);
      } catch {
        // Best-effort badge; leave the prior count on failure.
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  const [internalJobsTab, setInternalJobsTab] = useState<ListJobsForCurrentUserTab>('all');
  const jobsTabControlled =
    jobsListTabProp !== undefined && onJobsListTabChange !== undefined;
  const activeTab = jobsTabControlled ? jobsListTabProp : internalJobsTab;
  const setActiveTab = useCallback(
    (t: ListJobsForCurrentUserTab) => {
      if (t !== activeTab) {
        analytics.capture('jobs_tab_changed', {
          from_tab: activeTab,
          to_tab: t,
          current_count: jobsRef.current.length,
        });
      }
      if (jobsTabControlled) onJobsListTabChange(t);
      else setInternalJobsTab(t);
    },
    [activeTab, jobsTabControlled, onJobsListTabChange],
  );

  const activeEntry = tabCache[activeTab];
  const jobs = activeEntry.jobs;
  const hasMore = activeEntry.hasMore;
  const tabAwaitingData = !activeEntry.loaded;
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreInFlight = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const firstPageRequestIdRef = useRef(0);
  const [listContentHeight, setListContentHeight] = useState(0);
  const listRef = useRef<FlatList<JobsFlatRow>>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const formatLoadError = useCallback((error: unknown): string => {
    return error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Failed to load jobs.';
  }, []);

  const jobsListFetchKeyRef = useRef('');
  const lastJobsFetchVersionRef = useRef(-1);

  const loadAllTabsFirstPage = useCallback(async () => {
    const startedAt = Date.now();
    const requestId = firstPageRequestIdRef.current + 1;
    firstPageRequestIdRef.current = requestId;
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setTabCache(emptyTabCache());
      setLoadError('Supabase is not configured.');
      analytics.capture('supabase_not_configured_seen', {
        screen: 'jobs',
        operation: 'jobs_list_loaded',
      });
      return;
    }
    if (searchFocused && debouncedSearch.trim() === '') {
      setLoading(false);
      setLoadError(null);
      return;
    }
    const showLoading = !JOBS_TABS.some((t) => tabCacheRef.current[t].loaded);
    if (showLoading) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const search = debouncedSearch.trim() || undefined;
      const results = await Promise.all(
        JOBS_TABS.map((tab) =>
          listJobsForCurrentUserPage(supabase, {
            limit: PAGE_SIZE,
            offset: 0,
            tab,
            search,
          }),
        ),
      );
      if (firstPageRequestIdRef.current !== requestId) return;
      setTabCache((prev) => {
        const next = { ...prev };
        JOBS_TABS.forEach((tab, i) => {
          next[tab] = {
            jobs: results[i]?.items ?? [],
            hasMore: results[i]?.hasMore ?? false,
            loaded: true,
          };
        });
        return next;
      });
      const activeIndex = JOBS_TABS.indexOf(activeTab);
      const activeItems = results[activeIndex]?.items ?? [];
      analytics.capture('jobs_list_loaded', {
        tab: activeTab,
        search_present: debouncedSearch.trim().length > 0,
        search_length: debouncedSearch.trim().length,
        item_count: activeItems.length,
        has_more: results[activeIndex]?.hasMore ?? false,
        load_duration_ms: Date.now() - startedAt,
        inbox_count: inboxCount,
        prefetched_tabs: JOBS_TABS.length,
      });
      if (searchFocused && debouncedSearch.trim().length > 0) {
        analytics.capture('jobs_search_submitted', {
          query_length: debouncedSearch.trim().length,
          result_count: activeItems.length,
          tab: activeTab,
        });
      }
    } catch (error) {
      if (firstPageRequestIdRef.current !== requestId) return;
      setTabCache({
        all: { jobs: [], hasMore: false, loaded: true },
        open: { jobs: [], hasMore: false, loaded: true },
        paid: { jobs: [], hasMore: false, loaded: true },
      });
      setLoadError(formatLoadError(error));
      analytics.capture('jobs_list_load_failed', {
        tab: activeTab,
        search_present: debouncedSearch.trim().length > 0,
        search_length: debouncedSearch.trim().length,
        load_duration_ms: Date.now() - startedAt,
        ...errorProperties(error),
      });
    } finally {
      if (firstPageRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [activeTab, debouncedSearch, formatLoadError, inboxCount, searchFocused]);

  useEffect(() => {
    if (!isActive) return;
    if (searchFocused && debouncedSearch.trim() === '') {
      setLoading(false);
      return;
    }
    const fetchKey = `${debouncedSearch}|${searchFocused}`;
    const filtersChanged = jobsListFetchKeyRef.current !== fetchKey;
    const versionChanged = lastJobsFetchVersionRef.current !== version;
    if (!filtersChanged && !versionChanged && JOBS_TABS.every((t) => tabCacheRef.current[t].loaded)) {
      return;
    }
    jobsListFetchKeyRef.current = fetchKey;
    lastJobsFetchVersionRef.current = version;
    void loadAllTabsFirstPage();
  }, [isActive, version, loadAllTabsFirstPage, debouncedSearch, searchFocused]);

  const loadNextPage = useCallback(async () => {
    if (!isSupabaseConfigured() || loadMoreInFlight.current || loading || !hasMore) return;
    if (searchFocused && debouncedSearch.trim() === '') return;
    const requestId = firstPageRequestIdRef.current;
    const tab = activeTab;
    loadMoreInFlight.current = true;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const offset = tabCacheRef.current[tab].jobs.length;
      const { items, hasMore: more } = await listJobsForCurrentUserPage(supabase, {
        limit: PAGE_SIZE,
        offset,
        tab,
        search: debouncedSearch.trim() || undefined,
      });
      if (firstPageRequestIdRef.current !== requestId) return;
      setTabCache((prev) => {
        const cur = prev[tab];
        const seen = new Set(cur.jobs.map((j) => j.id));
        const merged = [...cur.jobs];
        for (const j of items) {
          if (!seen.has(j.id)) merged.push(j);
        }
        return {
          ...prev,
          [tab]: { jobs: merged, hasMore: more, loaded: true },
        };
      });
      analytics.capture('jobs_pagination_loaded', {
        tab,
        offset,
        added_count: items.length,
        has_more: more,
        search_present: debouncedSearch.trim().length > 0,
      });
    } catch (error) {
      if (firstPageRequestIdRef.current !== requestId) return;
      setLoadError(formatLoadError(error));
      analytics.capture('jobs_pagination_failed', {
        tab,
        offset: tabCacheRef.current[tab].jobs.length,
        search_present: debouncedSearch.trim().length > 0,
        ...errorProperties(error),
      });
    } finally {
      loadMoreInFlight.current = false;
      if (firstPageRequestIdRef.current === requestId) {
        setLoadingMore(false);
      }
    }
  }, [activeTab, debouncedSearch, formatLoadError, hasMore, loading, searchFocused]);

  const onSearchFocus = useCallback(() => {
    analytics.capture('jobs_search_started', { source: 'jobs' });
    setSearchFocused(true);
    setDebouncedSearch(searchQuery);
  }, [searchQuery]);

  const exitSearch = useCallback(() => {
    if (searchQuery.trim().length > 0) {
      analytics.capture('jobs_search_cleared', {
        query_length: searchQuery.trim().length,
        result_count: jobsRef.current.length,
      });
    }
    searchInputRef.current?.blur();
    setSearchFocused(false);
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

  const onSearchBlur = useCallback(() => {
    exitSearch();
  }, [exitSearch]);

  const onEndReached = useCallback(() => {
    void loadNextPage();
  }, [loadNextPage]);

  const flatData = useMemo(
    () => (activeTab === 'open' ? buildOpenFlatRows(jobs) : buildFlatRows(jobs)),
    [activeTab, jobs],
  );

  const scrollToOpenSection = useCallback(
    (section: JobsOpenSectionKind) => {
      const index = flatData.findIndex(
        (row) =>
          row.kind === 'section' &&
          row.mode === 'openStack' &&
          row.openKind === section,
      );
      if (index < 0) return;
      const viewOffset = space('Spacing/8');
      listRef.current?.scrollToIndex({ index, viewOffset, animated: true });
    },
    [flatData],
  );

  useEffect(() => {
    if (!isActive || !openScrollToSection || activeTab !== 'open') return;
    if (loading || tabAwaitingData) return;
    const section = openScrollToSection;
    const frame = requestAnimationFrame(() => {
      scrollToOpenSection(section);
    });
    const done = setTimeout(() => {
      onOpenScrollToSectionHandled?.();
    }, 320);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
  }, [
    activeTab,
    flatData,
    isActive,
    loading,
    onOpenScrollToSectionHandled,
    openScrollNonce,
    openScrollToSection,
    scrollToOpenSection,
    tabAwaitingData,
  ]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * info.index),
        animated: true,
      });
    },
    [],
  );

  const renderItem = useCallback<ListRenderItem<JobsFlatRow>>(
    ({ item }) => {
      if (item.kind === 'section') {
        if (item.mode === 'recency') {
          return (
            <View style={styles.listRowBand}>
              <View style={[styles.sectionHeader, styles.listRowInner, columnStyle]}>
                <Text style={typography.titleH3}>{item.title}</Text>
              </View>
            </View>
          );
        }
        return (
          <View style={styles.listRowBand}>
            <View style={[styles.listRowInner, columnStyle]}>
              <JobsOpenStackSectionHeader
                kind={item.openKind}
                count={item.count}
                typography={typography}
                contentInset={0}
              />
            </View>
          </View>
        );
      }
      return (
        <View style={styles.listRowBand}>
          <View style={[styles.jobRowWrap, styles.listRowInner, columnStyle]}>
            <JobCard
              job={item.job}
              onPress={() => onOpenJobDetail(item.job.id)}
              typography={typography}
              incompletePills={item.incompletePills}
            />
          </View>
        </View>
      );
    },
    [columnStyle, onOpenJobDetail, typography],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeaderBand}>
        <View style={columnStyle}>
        <View style={styles.topHeader}>
          <View style={platformHeaderRowStyle(styles.topHeaderChromeRow)}>
            <PlatformHeaderTitle
              {...screenHeaderA11y()}
              typography={typography.displayH1}
            >
              JOBS
            </PlatformHeaderTitle>
            <View style={styles.inboxWrap}>
              <PlatformHeaderAction
                accessibilityLabel={`Inbox${inboxCount > 0 ? `, ${inboxCount} unassigned` : ''}`}
                variant="primary"
                onPress={() => onOpenInbox?.()}
              >
                <JobsInboxIcon color={platformHeaderActionIconColor} />
              </PlatformHeaderAction>
              {inboxCount > 0 ? (
                <View pointerEvents="none" style={styles.inboxBadge}>
                  <Text
                    style={[
                      typography.bodySmall,
                      styles.inboxBadgeText,
                      { color: bg.surfaceWhite },
                    ]}
                  >
                    {inboxCount > 99 ? '99+' : inboxCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.searchBarOuter}>
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <View style={styles.searchIconSlot} pointerEvents="none">
              <JobsSearchIcon color={fg.secondary} />
            </View>
            <DsTextInput
              ref={searchInputRef}
              testID="jobs-search-input"
              accessibilityLabel="Search jobs"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              placeholder="Search by job or customer"
              placeholderTextColor={fg.secondary}
              style={[typography.body, styles.searchInput]}
              selectionColor={color('Brand/Primary')}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchFocused ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close search"
                onPress={exitSearch}
                hitSlop={12}
                style={({ pressed }) => [styles.searchClearButton, pressed && styles.pressed]}
              >
                <JobsSearchClearIcon color={fg.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {searchFocused && debouncedSearch.trim() === '' ? (
          <View style={styles.searchEmptyPanel}>
            <View style={styles.searchEmptyInner}>
              <View style={styles.searchEmptyIconWrap}>
                <JobsSearchIcon color={fg.secondary} size={32} />
              </View>
              <Text style={[typography.bodyBold, { color: fg.secondary, textAlign: 'center' }]}>
                Start typing to search jobs
              </Text>
            </View>
          </View>
        ) : null}

        {searchFocused ? null : (
          <>
            <View style={styles.tabsWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === 'all' }}
                onPress={() => setActiveTab('all')}
                style={({ pressed }) => [
                  activeTab === 'all' ? styles.tabActive : styles.tabIdle,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.statusPillLabel,
                    styles.jobsTabLabel,
                    { color: activeTab === 'all' ? fg.primary : fg.secondary },
                  ]}
                >
                  All
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === 'open' }}
                onPress={() => setActiveTab('open')}
                style={({ pressed }) => [
                  activeTab === 'open' ? styles.tabActive : styles.tabIdle,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.statusPillLabel,
                    styles.jobsTabLabel,
                    { color: activeTab === 'open' ? fg.primary : fg.secondary },
                  ]}
                >
                  Open
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === 'paid' }}
                onPress={() => setActiveTab('paid')}
                style={({ pressed }) => [
                  activeTab === 'paid' ? styles.tabActive : styles.tabIdle,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    typography.statusPillLabel,
                    styles.jobsTabLabel,
                    { color: activeTab === 'paid' ? fg.primary : fg.secondary },
                  ]}
                >
                  Paid
                </Text>
              </Pressable>
            </View>
          </>
        )}
        </View>
      </View>
    ),
    [
      activeTab,
      columnStyle,
      debouncedSearch,
      exitSearch,
      inboxCount,
      onOpenInbox,
      onSearchBlur,
      onSearchFocus,
      searchFocused,
      searchQuery,
      typography,
    ],
  );

  const listEmpty = useMemo(() => {
    if (searchFocused && debouncedSearch.trim() === '') {
      return null;
    }
    if ((loading || tabAwaitingData) && jobs.length === 0) {
      return <JobsLoadingSkeleton typography={typography} />;
    }
    if (loadError) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
            {loadError}
          </Text>
        </View>
      );
    }
    if (searchFocused && debouncedSearch.trim() !== '' && jobs.length === 0) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
            No matching jobs.
          </Text>
        </View>
      );
    }
    if (activeTab === 'open' && jobs.length === 0) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
            All caught up! No open jobs.
          </Text>
        </View>
      );
    }
    if (activeTab === 'paid' && jobs.length === 0) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
            No paid jobs yet.
          </Text>
        </View>
      );
    }
    if (activeTab === 'open' && jobs.length > 0 && flatData.length === 0) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center' }]}>
            No jobs in Incomplete, In Progress, or Unpaid right now.
          </Text>
        </View>
      );
    }
    if (jobs.length === 0) {
      return (
        <View style={styles.centerState}>
          <Text style={[typography.body, { color: fg.primary }]}>No jobs yet.</Text>
        </View>
      );
    }
    return null;
  }, [
    activeTab,
    debouncedSearch,
    flatData.length,
    jobs.length,
    loadError,
    loading,
    searchFocused,
    tabAwaitingData,
    typography,
  ]);

  const listFooter = useMemo(() => {
    const showSpinner = loadingMore;
    const showPageError = loadError != null && jobs.length > 0;
    if (!showSpinner && !showPageError) return null;
    return (
      <View style={[styles.listFooter, styles.listRowBand]}>
        {showPageError ? (
          <Text style={[typography.body, { color: fg.primary, textAlign: 'center', marginBottom: space('Spacing/12') }]}>
            {loadError}
          </Text>
        ) : null}
        {showSpinner ? <ActivityIndicator color={color('Brand/Primary')} /> : null}
      </View>
    );
  }, [jobs.length, loadError, loadingMore, typography]);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <CanvasTiledBackground scrollY={scrollY} contentHeight={listContentHeight} />
      </View>
    );
  }

  const bottomNavReservedHeight = shellBottomNavOuterHeight(insets.bottom);
  const headerTopPad = Math.max(insets.top - space('Spacing/12'), 0);
  const scrollBottomPad = bottomNavReservedHeight + space('Spacing/20');
  const searchAwaitingInput = searchFocused && debouncedSearch.trim() === '';
  const listData = searchAwaitingInput
    ? []
    : loading || tabAwaitingData
      ? jobs.length === 0
        ? []
        : flatData
      : flatData;

  return (
    <View style={styles.root} collapsable={false}>
      <CanvasTiledBackground scrollY={scrollY} contentHeight={listContentHeight} />
      <View
        pointerEvents="none"
        style={[styles.safeAreaTopAccentWrap, { top: 0 }]}
      >
        <View style={styles.topAccent} />
      </View>
      <Animated.FlatList
        ref={listRef}
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        style={[styles.scroll, { paddingTop: headerTopPad }]}
        contentContainerStyle={[
          styles.flatListContent,
          {
            paddingBottom: scrollBottomPad,
            flexGrow: 1,
          },
        ]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
          listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          },
        })}
        scrollEventThrottle={16}
        onContentSizeChange={(_w, h) => setListContentHeight(h)}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        onScrollToIndexFailed={onScrollToIndexFailed}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Match lined canvas fill (`CanvasTiledBackground`) so overscroll (rubber-band)
   * does not flash the window default. Lines still do not draw in the bounce
   * inset — only this solid `canvasWarm` shows there.
   */
  root: { flex: 1, alignItems: 'center', backgroundColor: bg.canvasWarm },
  scroll: { flex: 1, width: '100%', backgroundColor: 'transparent', zIndex: 1 },
  flatListContent: {
    // `center` collapses row width to min-content and breaks job cards; stretch
    // full width, then center capped blocks via `listRowBand` / `listHeaderBand`.
    alignItems: 'stretch',
  },
  listHeaderBand: {
    width: '100%',
    alignItems: 'center',
  },
  listRowBand: {
    width: '100%',
    alignItems: 'center',
  },
  listRowInner: {
    width: '100%',
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
  topHeader: {
    width: '100%',
    // Horizontal inset comes from the shared responsive content column.
    paddingHorizontal: 0,
    paddingTop: space('Spacing/32'),
    paddingBottom: space('Spacing/16'),
  },
  topHeaderChromeRow: {
    width: '100%',
    justifyContent: 'space-between',
  },
  inboxWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    overflow: 'visible',
  },
  inboxBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: radius('Radius/Full'),
    backgroundColor: fg.primary,
    borderWidth: 2,
    borderColor: bg.canvasWarm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  inboxBadgeText: {
    fontSize: 10,
    lineHeight: 11,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  searchBarOuter: {
    width: '100%',
  },
  searchBar: {
    position: 'relative',
    width: '100%',
    minHeight: 48,
    backgroundColor: bg.surfaceWhite,
    // Keep borderWidth constant so the white input area does not shrink on focus.
    borderWidth: 2,
    borderColor: border.subtle,
    borderRadius: 12,
    ...cardShadowRn,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space('Spacing/12'),
  },
  searchBarFocused: {
    borderColor: color('Brand/PrimaryStroke'),
  },
  searchIconSlot: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    marginLeft: 44,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingRight: space('Spacing/8'),
    color: fg.primary,
    minHeight: 48,
  },
  searchClearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius('Radius/Full'),
    backgroundColor: colorWithAlpha('Foundation/Text/Primary', 0.1),
  },
  searchEmptyPanel: {
    width: '100%',
    marginTop: space('Spacing/12'),
    backgroundColor: bg.surfaceWhite,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: 16,
    ...cardShadowRn,
    paddingVertical: space('Spacing/16'),
    paddingHorizontal: space('Spacing/20'),
  },
  searchEmptyInner: {
    alignItems: 'center',
    paddingVertical: space('Spacing/12'),
    paddingHorizontal: space('Spacing/12'),
  },
  searchEmptyIconWrap: {
    marginBottom: space('Spacing/8'),
  },
  tabsWrap: {
    width: '100%',
    marginTop: space('Spacing/12'),
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
  jobsTabLabel: {
    textTransform: 'uppercase',
  },
  sectionHeader: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/16'),
    paddingBottom: space('Spacing/12'),
  },
  jobRowWrap: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: space('Spacing/12'),
  },
  listFooter: {
    paddingVertical: space('Spacing/20'),
    alignItems: 'center',
    width: '100%',
  },
  skeletonWrap: {
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: space('Spacing/24'),
    alignItems: 'center',
    minHeight: 220,
  },
  skeletonRow: {
    width: '100%',
    height: 72,
    borderRadius: 16,
    backgroundColor: bg.subtle,
    marginBottom: space('Spacing/12'),
    borderWidth: 1,
    borderColor: border.subtle,
  },
  centerState: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space('Spacing/20'),
  },
  pressed: { opacity: 0.75 },
});
