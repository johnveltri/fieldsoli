import { type ComponentProps, type ForwardRefExoticComponent, type ReactNode, type RefAttributes, useRef } from 'react';
import { type AccessibilityProps, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';

type EditSwipeableRowProps = {
  typography: TextStyles;
  children: ReactNode;
  onDelete: () => void;
  accessibilityLabel: string;
  /** When false, renders the row without swipe-to-delete (stable tree for focus). */
  enabled?: boolean;
};

type SwipeableAccessibilityProps = Pick<
  AccessibilityProps,
  'accessibilityActions' | 'onAccessibilityAction'
>;

type AccessibleSwipeableProps = ComponentProps<typeof Swipeable> & SwipeableAccessibilityProps;

// Swipeable forwards unknown props to its gesture-handler host at runtime, but
// its public type omits React Native accessibility-action props.
const AccessibleSwipeable = Swipeable as unknown as ForwardRefExoticComponent<
  AccessibleSwipeableProps & RefAttributes<Swipeable>
>;

export function EditSwipeableRow({
  typography,
  children,
  onDelete,
  accessibilityLabel,
  enabled = true,
}: EditSwipeableRowProps) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete"
        onPress={() => {
          swipeRef.current?.close();
          onDelete();
        }}
        style={styles.deleteAction}
      >
        <Animated.Text style={[typography.bodyBold, styles.deleteLabel, { transform: [{ scale }] }]}>
          Delete
        </Animated.Text>
      </Pressable>
    );
  };

  const row = (
    <View accessibilityLabel={accessibilityLabel} style={styles.row}>
      {children}
    </View>
  );

  if (!enabled) {
    return row;
  }

  return (
    <AccessibleSwipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'delete') onDelete();
      }}
    >
      {row}
    </AccessibleSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: bg.surfaceWhite,
    width: '100%',
    alignSelf: 'stretch',
  },
  deleteAction: {
    backgroundColor: color('Semantic/Status/Error/Text'),
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 1,
  },
  deleteLabel: {
    color: bg.canvasWarm,
  },
});
