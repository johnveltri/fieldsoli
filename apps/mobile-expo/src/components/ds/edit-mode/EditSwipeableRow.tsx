import { type ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, fg } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';

type EditSwipeableRowProps = {
  typography: TextStyles;
  children: ReactNode;
  onDelete: () => void;
  accessibilityLabel: string;
};

export function EditSwipeableRow({
  typography,
  children,
  onDelete,
  accessibilityLabel,
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

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'delete') onDelete();
      }}
    >
      <View
        accessibilityLabel={accessibilityLabel}
        style={styles.row}
      >
        {children}
      </View>
    </Swipeable>
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
