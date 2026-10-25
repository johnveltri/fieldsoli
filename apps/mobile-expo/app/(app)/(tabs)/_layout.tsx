import { useCallback } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useShellOverlays } from '../../../src/shell/ShellOverlayContext';
import { useShellChromeOptional } from '../../../src/shell/ShellChromeContext';
import type { ShellMainTab } from '../../../src/shell/shellTabRoutes';
import { bg, fg } from '../../../src/theme/nativeTokens';

/** Foundation/Text/Primary — ink for icons + labels. */
const tabInk = fg.primary;
/**
 * Android bar fill: Foundation/Surface/Subtle — same tan track as Earnings
 * “PAST WEEK / MONTH / YEAR” so the nav separates from canvas-warm content.
 */
const androidTabBarBg = bg.subtle;
/** Material 3 selected indicator (secondary-container-like wash of primary ink). */
const m3Indicator = 'rgba(43, 52, 65, 0.14)';
const m3Ripple = 'rgba(43, 52, 65, 0.12)';

const iconHome = require('../../../assets/tab-icons/home.png');
const iconJobs = require('../../../assets/tab-icons/jobs.png');
const iconEarnings = require('../../../assets/tab-icons/earnings.png');

function useDismissOverlaysOnTabPress() {
  const overlays = useShellOverlays();
  return useCallback(
    (destination: ShellMainTab) => {
      overlays?.dismissOverlaysForTabPress(destination);
    },
    [overlays],
  );
}

function NativeTabsLayout() {
  const dismissOverlays = useDismissOverlaysOnTabPress();
  const hideBottomChrome = useShellChromeOptional()?.hideBottomChrome ?? false;

  return (
    <NativeTabs
      hidden={hideBottomChrome}
      // iOS: leave background unset/transparent so Liquid Glass owns the chrome;
      // forcing a fill creates the opaque slab under Reduce Transparency.
      // Hidden tabs still paint Android's gesture area; match the full-page canvas.
      backgroundColor={Platform.OS === 'android'
        ? (hideBottomChrome ? bg.canvasWarm : androidTabBarBg)
        : 'transparent'}
      tintColor={tabInk}
      iconColor={{ default: tabInk, selected: tabInk }}
      labelStyle={{
        default: { color: tabInk, fontSize: 10, fontWeight: '600' },
        selected: { color: tabInk, fontSize: 10, fontWeight: '700' },
      }}
      // Android: standard Material 3 active indicator + labeled tabs.
      disableIndicator={false}
      indicatorColor={m3Indicator}
      rippleColor={m3Ripple}
      labelVisibilityMode="labeled"
      // iOS: thinner material than systemChrome* — less vertical “glass bleed” above the pill.
      blurEffect={Platform.OS === 'ios' ? 'systemThinMaterialLight' : undefined}
      shadowColor="transparent"
      // iOS: without this, NativeTabs assumes scroll-edge and the glass/blur
      // extends far above the pill (especially when ScrollView isn’t the first child).
      disableTransparentOnScrollEdge
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger
        name="index"
        disableTransparentOnScrollEdge
        listeners={{
          // Re-tap Home while Profile is open must dismiss — route does not change.
          tabPress: () => dismissOverlays('home'),
        }}
      >
        <NativeTabs.Trigger.Label>HOME</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={iconHome} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="jobs"
        disableTransparentOnScrollEdge
        listeners={{
          tabPress: () => dismissOverlays('jobs'),
        }}
      >
        <NativeTabs.Trigger.Label>JOBS</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={iconJobs} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="earnings"
        disableTransparentOnScrollEdge
        listeners={{
          tabPress: () => dismissOverlays('earnings'),
        }}
      >
        <NativeTabs.Trigger.Label>EARNINGS</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={iconEarnings} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/** Jest cannot host native tab navigators — use a stack with the same routes. */
function JestTabsLayout() {
  const dismissOverlays = useDismissOverlaysOnTabPress();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        listeners={{
          focus: () => dismissOverlays('home'),
        }}
      />
      <Stack.Screen
        name="jobs"
        listeners={{
          focus: () => dismissOverlays('jobs'),
        }}
      />
      <Stack.Screen
        name="earnings"
        listeners={{
          focus: () => dismissOverlays('earnings'),
        }}
      />
    </Stack>
  );
}

export default function TabsLayout() {
  if (process.env.JEST_WORKER_ID !== undefined) {
    return <JestTabsLayout />;
  }
  return <NativeTabsLayout />;
}
