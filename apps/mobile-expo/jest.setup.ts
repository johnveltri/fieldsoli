import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, bottom: 0, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const SafeAreaInsetsContext = React.createContext(inset);
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(SafeAreaInsetsContext.Provider, { value: inset }, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => inset,
    SafeAreaInsetsContext,
    initialWindowMetrics: { insets: inset, frame },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');
  const passthrough = React.forwardRef(function Passthrough(
    props: { children?: React.ReactNode },
    _ref: unknown,
  ) {
    const { children, ...rest } = props;
    return React.createElement(View, rest, children);
  });
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: passthrough,
    NativeViewGestureHandler: passthrough,
    Swipeable: passthrough,
    ScrollView,
    State: { BEGAN: 2, ACTIVE: 4, END: 5, CANCELLED: 3, FAILED: 1 },
  };
});

jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return {
    GlassView: View,
    GlassContainer: View,
    isGlassEffectAPIAvailable: () => false,
    isLiquidGlassAvailable: () => false,
  };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: View,
    BlurTargetView: React.forwardRef(function BlurTargetViewMock(
      props: { children?: React.ReactNode },
      ref: unknown,
    ) {
      return React.createElement(View, { ...props, ref }, props.children);
    }),
  };
});

try {
  require('react-native-reanimated/mock');
} catch {
  // optional
}
