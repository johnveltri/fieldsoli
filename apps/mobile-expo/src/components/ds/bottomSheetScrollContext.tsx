import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as NativeScrollView,
  type ScrollViewProps,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { EditKeyboardScrollContext } from './edit-mode/EditFormRows';

type BottomSheetScrollContextValue = {
  scrollOffsetYRef: MutableRefObject<number>;
  onScrollOffsetChange?: (offsetY: number) => void;
  dismissIfScrollPastTop: (
    scrollOffsetY: number,
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => void;
};

const BottomSheetScrollContext = createContext<BottomSheetScrollContextValue | null>(
  null,
);

export function BottomSheetScrollProvider({
  onDismiss,
  scrollOffsetYRef,
  onScrollOffsetChange,
  children,
}: {
  onDismiss: () => void;
  scrollOffsetYRef: MutableRefObject<number>;
  onScrollOffsetChange?: (offsetY: number) => void;
  children: ReactNode;
}) {
  const dismissIfScrollPastTop = useCallback(
    (scrollOffsetY: number, event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollOffsetY > 4) return;
      const { y } = event.nativeEvent.contentOffset;
      const vy = event.nativeEvent.velocity?.y ?? 0;
      const pullPastTop = Platform.OS === 'android' ? -8 : -24;
      const flickThreshold = Platform.OS === 'android' ? -0.12 : -0.35;
      if (y < pullPastTop || (y <= 0 && vy < flickThreshold)) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  const value = useMemo(
    () => ({ scrollOffsetYRef, dismissIfScrollPastTop, onScrollOffsetChange }),
    [dismissIfScrollPastTop, onScrollOffsetChange, scrollOffsetYRef],
  );

  return (
    <BottomSheetScrollContext.Provider value={value}>
      {children}
    </BottomSheetScrollContext.Provider>
  );
}

type BottomSheetScrollViewProps = ScrollViewProps & {
  /** Optional owner ref for keyboard-aware sheet form scrolling. */
  scrollViewRef?: RefObject<NativeScrollView | null>;
  /** RNGH: let the dismiss pan claim the gesture first when enabled. */
  waitFor?: RefObject<unknown> | RefObject<unknown>[];
  simultaneousHandlers?: RefObject<unknown> | RefObject<unknown>[];
};

/** ScrollView that closes the sheet when the user pulls past the top (modal overscroll). */
export function BottomSheetScrollView({
  scrollViewRef,
  onScroll,
  onScrollEndDrag,
  onMomentumScrollEnd,
  bounces = true,
  ...rest
}: BottomSheetScrollViewProps) {
  const ctx = useContext(BottomSheetScrollContext);
  const editScroll = useContext(EditKeyboardScrollContext);
  const localScrollOffsetY = useRef(0);
  const scrollOffsetYRef = ctx?.scrollOffsetYRef ?? localScrollOffsetY;

  return (
    <ScrollView
      ref={scrollViewRef}
      {...rest}
      bounces={bounces}
      overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
      onScroll={(event) => {
        const y = event.nativeEvent.contentOffset.y;
        scrollOffsetYRef.current = y;
        localScrollOffsetY.current = y;
        if (editScroll) {
          editScroll.scrollYRef.current = y;
          editScroll.guardEntityDockScroll(y);
        }
        ctx?.onScrollOffsetChange?.(y);
        onScroll?.(event);
      }}
      onScrollEndDrag={(event) => {
        ctx?.dismissIfScrollPastTop(localScrollOffsetY.current, event);
        onScrollEndDrag?.(event);
      }}
      onMomentumScrollEnd={(event) => {
        ctx?.dismissIfScrollPastTop(localScrollOffsetY.current, event);
        onMomentumScrollEnd?.(event);
      }}
    />
  );
}
