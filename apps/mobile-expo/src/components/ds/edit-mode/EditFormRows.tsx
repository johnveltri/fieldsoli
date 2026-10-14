import { Children, createContext, forwardRef, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  findNodeHandle,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  Platform,
} from 'react-native';
import { radius, space } from '@fieldsolo/design-system/lib/tokens';

import { DsTextInput } from '../DsTextInput';
import { bg, border, fg, textInputMinHeight } from '../../../theme/nativeTokens';
import type { TextStyles } from '../../../theme/nativeTokens';
import { JOB_SHORT_DESCRIPTION_MAX_LENGTH } from '@fieldsolo/shared-types';

import { sanitizeSingleLineText } from '../../../lib/moneyInput';
import { useSheetChrome } from '../sheetChromeContext';

export const EDIT_ICON_SLOT = 28;

/** Body line height from `Typography/Body` (16px @ 140% → 22). Used only for
 * minimum tap-target sizing — never set as a fixed `height` on Text/TextInput
 * (RN pins glyphs to the bottom of a fixed height box and misaligns icons).
 */
const EDIT_BODY_LINE_HEIGHT = 22;

/** Shared text metrics for icon rows — inherit lineHeight from typography tokens. */
const editRowText = {
  includeFontPadding: false,
} as const;

const EDIT_FIELD_INPUT_MIN_HEIGHT = textInputMinHeight(EDIT_BODY_LINE_HEIGHT);

/** Extra space below the focused field when the keyboard opens. */
export const EDIT_KEYBOARD_SCROLL_OFFSET = 120;

/** Breathing room between a focused field and a sticky overlay CTA. */
const FOCUSED_FIELD_FOOTER_GAP = space('Spacing/12');

function useFocusedFieldKeyboardOffset(base = EDIT_KEYBOARD_SCROLL_OFFSET): number {
  const { stickyFooterHeight } = useSheetChrome();
  if (stickyFooterHeight <= 0) return base;
  return stickyFooterHeight + FOCUSED_FIELD_FOOTER_GAP;
}

/** Below-caret lead when a tall note cannot dock to the gray line. */
const TALL_NOTE_CARET_LEAD_LINES = 3;
const TALL_NOTE_CARET_LEAD = TALL_NOTE_CARET_LEAD_LINES * EDIT_BODY_LINE_HEIGHT;

/** Top breathing room when a tall entity block must scroll from the top. */
export const EDIT_ENTITY_SCROLL_MARGIN = space('Spacing/12');

const DEFAULT_KEYBOARD_HEIGHT = Platform.select({ ios: 336, android: 280, default: 280 }) ?? 280;

/**
 * Extra ScrollView bottom inset in edit mode so the last entity row can scroll
 * above the keyboard (dock target + separator + accessory bar).
 */
export const EDIT_KEYBOARD_BOTTOM_CLEARANCE =
  DEFAULT_KEYBOARD_HEIGHT + (Platform.select({ ios: 52, android: 40, default: 40 }) ?? 40);

type ScrollInputIntoView = (nativeTarget?: number, extraOffset?: number) => void;

type EditKeyboardScrollContextValue = {
  scrollInputIntoView: ScrollInputIntoView;
  scrollViewRef: RefObject<ScrollView | null>;
  scrollContentRef: RefObject<View | null>;
  scrollYRef: RefObject<number>;
  entityDockScrollYRef: RefObject<number | null>;
  getKeyboardScreenY: () => number;
  /** Scroll so `caretScreenY + 3 lines` sits at the keyboard top. */
  scrollCaretLeadIntoView: (caretScreenY: number) => void;
  setSuppressNativeKeyboardScroll: (suppress: boolean) => void;
  /** Call from ScrollView onScroll to hold dock position while a short note is docked. */
  guardEntityDockScroll: (contentOffsetY: number) => void;
  /** Queue entity-block scroll for keyboard show (or run now if open). */
  requestEntityBlockScroll: (
    scroll: () => void,
    waitForKeyboard?: boolean,
    didShowScroll?: () => void,
  ) => void;
  /** Queue dock scroll for keyboardDidShow only (tall notes with dockRef). */
  requestEntityDockScroll: (scroll: () => void, waitForKeyboard?: boolean) => void;
  /** Clears dock hold, pending scrolls, and native keyboard-scroll suppression. */
  resetKeyboardScrollState: () => void;
};

const EditKeyboardScrollContext = createContext<EditKeyboardScrollContextValue | null>(null);

export { EditKeyboardScrollContext };

type ScrollEntityBlock = (
  waitForKeyboard?: boolean,
  nativeTarget?: number,
  caretScreenY?: number,
) => void;

const EditEntityBlockContext = createContext<ScrollEntityBlock | null>(null);

/** Full-width row separator — matches ProfileRowsCard `rowTopBorder`. */
export const editSheetRowSeparator = {
  borderTopWidth: 1,
  borderTopColor: border.subtle,
} as const;

/** Height of the sheet separator rule below each list item (on the "Add …" row). */
const EDIT_ENTITY_SHEET_SEPARATOR_HEIGHT = editSheetRowSeparator.borderTopWidth;

/** True when the entity (top through dock line) fits in the space above the keyboard. */
function entityBlockFitsAboveKeyboard(
  blockScreenY: number,
  dockBottom: number,
  keyboardScreenY: number,
) {
  return dockBottom - blockScreenY <= keyboardScreenY - EDIT_ENTITY_SCROLL_MARGIN;
}

function dockBlockToKeyboard(
  blockRef: RefObject<View | null>,
  dockRef: RefObject<View | null> | undefined,
  scrollViewRef: RefObject<ScrollView | null>,
  scrollYRef: RefObject<number>,
  keyboardScreenY: number,
  entityDockScrollYRef: RefObject<number | null>,
  animated: boolean,
  settle: boolean,
) {
  const block = blockRef.current;
  const scroll = scrollViewRef.current;
  const dockTarget = dockRef?.current ?? block;
  if (!block || !scroll || !dockTarget) return;

  const dockOnce = () => {
    block.measureInWindow((_bx, blockScreenY) => {
      dockTarget.measureInWindow((_dx, dockScreenY, _dw, dockHeight) => {
        const dockBottom = dockScreenY + dockHeight + EDIT_ENTITY_SHEET_SEPARATOR_HEIGHT;
        const delta = dockBottom - keyboardScreenY;
        const targetY = dockRef?.current
          ? Math.max(0, scrollYRef.current + delta)
          : Math.max(
              0,
              scrollYRef.current +
                Math.min(delta, Math.max(0, blockScreenY - EDIT_ENTITY_SCROLL_MARGIN)),
            );

        scroll.scrollTo({ y: targetY, animated });
        scrollYRef.current = targetY;
        if (dockRef?.current) {
          entityDockScrollYRef.current = targetY;
        }
      });
    });
  };

  dockOnce();
  if (settle) {
    requestAnimationFrame(() => {
      dockOnce();
      requestAnimationFrame(dockOnce);
    });
  }
}

export function EditKeyboardScrollProvider({
  scrollViewRef,
  scrollContentRef,
  scrollYRef,
  active = true,
  children,
  offset = EDIT_KEYBOARD_SCROLL_OFFSET,
}: {
  scrollViewRef: RefObject<ScrollView | null>;
  scrollContentRef: RefObject<View | null>;
  scrollYRef: RefObject<number>;
  /** When false, dismisses the keyboard and clears dock / pending scroll state. */
  active?: boolean;
  children: ReactNode;
  offset?: number;
}) {
  const windowHeight = Dimensions.get('window').height;
  const keyboardScreenYRef = useRef(windowHeight - DEFAULT_KEYBOARD_HEIGHT);
  const keyboardVisibleRef = useRef(false);
  const pendingEntityScrollRef = useRef<(() => void) | null>(null);
  const pendingEntityDidShowScrollRef = useRef<(() => void) | null>(null);
  const suppressNativeKeyboardScrollRef = useRef(false);
  const entityDockScrollYRef = useRef<number | null>(null);

  const pendingInputScrollRef = useRef<(() => void) | null>(null);
  const inputScrollGenRef = useRef(0);

  const setSuppressNativeKeyboardScroll = useCallback((suppress: boolean) => {
    suppressNativeKeyboardScrollRef.current = suppress;
    if (!suppress) {
      entityDockScrollYRef.current = null;
    }
  }, []);

  const resetKeyboardScrollState = useCallback(() => {
    suppressNativeKeyboardScrollRef.current = false;
    entityDockScrollYRef.current = null;
    pendingEntityScrollRef.current = null;
    pendingEntityDidShowScrollRef.current = null;
    pendingInputScrollRef.current = null;
  }, []);

  useEffect(() => {
    if (active) return;
    Keyboard.dismiss();
    resetKeyboardScrollState();
  }, [active, resetKeyboardScrollState]);

  const guardEntityDockScroll = useCallback(
    (contentOffsetY: number) => {
      const heldY = entityDockScrollYRef.current;
      if (
        heldY == null ||
        !suppressNativeKeyboardScrollRef.current ||
        Math.abs(contentOffsetY - heldY) <= 4
      ) {
        return;
      }
      scrollViewRef.current?.scrollTo({ y: heldY, animated: false });
      scrollYRef.current = heldY;
    },
    [scrollViewRef, scrollYRef],
  );

  useEffect(() => {
    const scroll = scrollViewRef.current;
    if (!scroll?.scrollResponderScrollNativeHandleToKeyboard) return;

    const original = scroll.scrollResponderScrollNativeHandleToKeyboard.bind(scroll);
    scroll.scrollResponderScrollNativeHandleToKeyboard = (
      handle: number,
      extraOffset?: number,
      preventNegativeScrollOffset?: boolean,
    ) => {
      if (suppressNativeKeyboardScrollRef.current) return;
      return original(handle, extraOffset, preventNegativeScrollOffset);
    };

    return () => {
      scroll.scrollResponderScrollNativeHandleToKeyboard = original;
    };
  }, [scrollViewRef]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      keyboardScreenYRef.current = event.endCoordinates.screenY;
      keyboardVisibleRef.current = true;
      const pending = pendingEntityScrollRef.current;
      pendingEntityScrollRef.current = null;
      pending?.();
      pendingInputScrollRef.current?.();
    });
    const didShowSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardDidShow', (event) => {
            keyboardScreenYRef.current = event.endCoordinates.screenY;
            const pending = pendingEntityDidShowScrollRef.current;
            pendingEntityDidShowScrollRef.current = null;
            pending?.();
            pendingInputScrollRef.current?.();
          })
        : null;
    const changeSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', (event) => {
            keyboardScreenYRef.current = event.endCoordinates.screenY;
            keyboardVisibleRef.current = event.endCoordinates.height > 0;
            pendingInputScrollRef.current?.();
          })
        : null;
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardScreenYRef.current = windowHeight;
      keyboardVisibleRef.current = false;
      pendingEntityScrollRef.current = null;
      pendingEntityDidShowScrollRef.current = null;
      pendingInputScrollRef.current = null;
    });

    return () => {
      showSub.remove();
      didShowSub?.remove();
      changeSub?.remove();
      hideSub.remove();
    };
  }, [windowHeight]);

  const requestEntityBlockScroll = useCallback(
    (scroll: () => void, waitForKeyboard = true, didShowScroll?: () => void) => {
      if (!waitForKeyboard || keyboardVisibleRef.current) {
        scroll();
        didShowScroll?.();
        return;
      }
      pendingEntityScrollRef.current = scroll;
      if (didShowScroll) {
        pendingEntityDidShowScrollRef.current = didShowScroll;
      }
    },
    [],
  );

  const requestEntityDockScroll = useCallback((scroll: () => void, waitForKeyboard = true) => {
    if (!waitForKeyboard || keyboardVisibleRef.current) {
      scroll();
      return;
    }
    pendingEntityDidShowScrollRef.current = scroll;
  }, []);

  const scrollCaretLeadIntoView = useCallback(
    (caretScreenY: number) => {
      const delta = caretScreenY + TALL_NOTE_CARET_LEAD - keyboardScreenYRef.current;
      const targetY = Math.max(0, scrollYRef.current + delta);
      scrollViewRef.current?.scrollTo({ y: targetY, animated: false });
      scrollYRef.current = targetY;
    },
    [scrollViewRef, scrollYRef],
  );

  const scrollInputIntoView = useCallback<ScrollInputIntoView>(
    (nativeTarget, extraOffset = offset) => {
      if (nativeTarget == null || suppressNativeKeyboardScrollRef.current) return;
      const run = () => {
        if (suppressNativeKeyboardScrollRef.current) return;
        const scrollView = scrollViewRef.current;
        if (!scrollView) return;
        const node =
          typeof nativeTarget === 'number' ? nativeTarget : findNodeHandle(nativeTarget);
        if (node == null) return;
        // Keyboard willShow / didShow / QuickType change-frame all call this.
        // Invalidate in-flight measures so we don't stack deltas (that pinned
        // live-session materials under the status bar after Add → focus).
        const gen = ++inputScrollGenRef.current;
        UIManager.measureInWindow(node, (_x, y, _w, h) => {
          if (gen !== inputScrollGenRef.current) return;
          const limitY = keyboardScreenYRef.current - extraOffset;
          const delta = y + h - limitY;
          if (delta <= 4) return;
          const targetY = Math.max(0, scrollYRef.current + delta);
          scrollView.scrollTo({ y: targetY, animated: false });
          scrollYRef.current = targetY;
        });
      };
      pendingInputScrollRef.current = run;
      if (!keyboardVisibleRef.current) return;
      run();
    },
    [offset, scrollViewRef, scrollYRef],
  );

  const value = useMemo(
    () => ({
      scrollInputIntoView,
      scrollViewRef,
      scrollContentRef,
      scrollYRef,
      entityDockScrollYRef,
      getKeyboardScreenY: () => keyboardScreenYRef.current,
      scrollCaretLeadIntoView,
      setSuppressNativeKeyboardScroll,
      guardEntityDockScroll,
      requestEntityBlockScroll,
      requestEntityDockScroll,
      resetKeyboardScrollState,
    }),
    [
      guardEntityDockScroll,
      requestEntityBlockScroll,
      requestEntityDockScroll,
      resetKeyboardScrollState,
      scrollCaretLeadIntoView,
      scrollContentRef,
      scrollInputIntoView,
      scrollViewRef,
      scrollYRef,
      setSuppressNativeKeyboardScroll,
    ],
  );

  return (
    <EditKeyboardScrollContext.Provider value={value}>
      {children}
    </EditKeyboardScrollContext.Provider>
  );
}

/** ScrollView wired to EditKeyboardScrollProvider (guard + scrollY tracking). */
export function EditModeScrollView({
  scrollViewRef,
  scrollYRef,
  children,
  onScroll,
  ...props
}: React.ComponentProps<typeof ScrollView> & {
  scrollViewRef: RefObject<ScrollView | null>;
  scrollYRef: RefObject<number>;
}) {
  const scroll = useContext(EditKeyboardScrollContext);

  return (
    <ScrollView
      ref={scrollViewRef}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={false}
      scrollEventThrottle={16}
      {...props}
      onScroll={(event) => {
        const y = event.nativeEvent.contentOffset.y;
        scrollYRef.current = y;
        scroll?.guardEntityDockScroll(y);
        onScroll?.(event);
      }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Wraps one list item (session, material, other cost, note) so focus / tap scrolls
 * the full row into view — icon fields through the attach-session row.
 * Tall notes (dockRef) that do not fit above the keyboard keep the caret line visible instead.
 */
export function EditEntityBlockScope({
  children,
  dockRef,
}: {
  children: ReactNode;
  /** When set, short notes dock this view's bottom to the keyboard; tall notes skip dock. */
  dockRef?: RefObject<View | null>;
}) {
  const blockRef = useRef<View>(null);
  const scroll = useContext(EditKeyboardScrollContext);
  const { stickyFooterHeight } = useSheetChrome();

  const scrollBlockIntoView = useCallback<ScrollEntityBlock>(
    (waitForKeyboard = true, nativeTarget, caretScreenY) => {
      if (!scroll) return;

      const run = () => {
        const block = blockRef.current;
        const dockTarget = dockRef?.current ?? block;
        if (!block || !dockTarget) return;

        const keyboardScreenY = scroll.getKeyboardScreenY() - stickyFooterHeight;

        if (dockRef?.current && nativeTarget != null) {
          block.measureInWindow((_bx, blockScreenY) => {
            dockTarget.measureInWindow((_dx, dockScreenY, _dw, dockHeight) => {
              const dockBottom = dockScreenY + dockHeight + EDIT_ENTITY_SHEET_SEPARATOR_HEIGHT;
              if (!entityBlockFitsAboveKeyboard(blockScreenY, dockBottom, keyboardScreenY)) {
                scroll.setSuppressNativeKeyboardScroll(true);
                if (caretScreenY != null) {
                  scroll.scrollCaretLeadIntoView(caretScreenY);
                }
                return;
              }
              scroll.setSuppressNativeKeyboardScroll(true);
              dockBlockToKeyboard(
                blockRef,
                dockRef,
                scroll.scrollViewRef,
                scroll.scrollYRef,
                keyboardScreenY,
                scroll.entityDockScrollYRef,
                false,
                true,
              );
            });
          });
          return;
        }

        dockBlockToKeyboard(
          blockRef,
          dockRef,
          scroll.scrollViewRef,
          scroll.scrollYRef,
          keyboardScreenY,
          scroll.entityDockScrollYRef,
          false,
          !!dockRef,
        );
      };

      if (dockRef) {
        scroll.requestEntityDockScroll(run, waitForKeyboard);
        return;
      }
      scroll.requestEntityBlockScroll(run, waitForKeyboard);
    },
    [dockRef, scroll, stickyFooterHeight],
  );

  return (
    <EditEntityBlockContext.Provider value={scrollBlockIntoView}>
      <View ref={blockRef} collapsable={false}>
        {children}
      </View>
    </EditEntityBlockContext.Provider>
  );
}

/** White grouped block — edit form section card. */
export function EditSheet({ children }: { children: ReactNode }) {
  return <View style={styles.sheet}>{children}</View>;
}

/** Large borderless title under the header chrome. */
export const EditTitleField = forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput> & { typography: TextStyles }
>(function EditTitleField(
  {
    typography,
    onFocus,
    maxLength = JOB_SHORT_DESCRIPTION_MAX_LENGTH,
    ...props
  },
  ref,
) {
  const scroll = useContext(EditKeyboardScrollContext);
  const keyboardOffset = useFocusedFieldKeyboardOffset();

  return (
    // Outer inset + inner clip: iOS TextInput intrinsic width follows the full
    // string and paints through padding into the sheet edge unless clipped in a
    // width-bounded view that is already inset from the pill.
    <View style={styles.titleFieldWrap}>
      <View style={styles.titleFieldClip}>
        <DsTextInput
          ref={ref}
          placeholderTextColor={fg.secondary}
          style={[typography.titleH3, styles.titleInput]}
          // iOS defaults to word-wrapping when paragraph styles (e.g. lineHeight) are
          // set, so long titles stop early with empty trailing space until focused.
          // Clip matches the focused single-line edge (partial word visible).
          lineBreakModeIOS="clip"
          multiline={false}
          numberOfLines={1}
          maxLength={maxLength}
          onFocus={(event) => {
            scroll?.scrollInputIntoView(event.nativeEvent.target, keyboardOffset);
            onFocus?.(event);
          }}
          {...props}
        />
      </View>
    </View>
  );
});

/**
 * Optional long description under the title — same multiline field as notes.
 */
export function EditDescriptionField({
  typography,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & { typography: TextStyles }) {
  const dockRef = useRef<View>(null);

  return (
    <EditEntityBlockScope dockRef={dockRef}>
      <View ref={dockRef} collapsable={false} style={styles.descriptionFieldWrap}>
        <EditFieldInput
          typography={typography}
          multiline
          placeholder="Description"
          style={[styles.descriptionInput, style]}
          {...props}
        />
      </View>
    </EditEntityBlockScope>
  );
}

/** Single row: leading icon + content. */
export function EditIconRow({
  icon,
  children,
  showTopBorder = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  showTopBorder?: boolean;
}) {
  return (
    <View style={[styles.iconRow, showTopBorder && editSheetRowSeparator]}>
      <View style={styles.iconSlot}>
        <View style={styles.iconFrame}>{icon}</View>
      </View>
      <View style={styles.iconContent}>{children}</View>
    </View>
  );
}

/** Multiple rows sharing one leading icon column (e.g. session time block). */
export function EditIconGroup({
  icon,
  children,
  iconAlign = 'center',
}: {
  icon: ReactNode;
  children: ReactNode;
  /** Vertical alignment of the leading icon vs row content. */
  iconAlign?: 'center' | 'top';
}) {
  const items = Children.toArray(children);
  return (
    <>
      {items.map((child, index) => (
        <View
          key={index}
          style={[
            styles.iconRow,
            iconAlign === 'top' && styles.iconRowTop,
          ]}
        >
          <View
            style={[
              styles.iconSlot,
              iconAlign === 'top' && styles.iconSlotTop,
            ]}
          >
            <View style={styles.iconFrame}>{index === 0 ? icon : null}</View>
          </View>
          <View style={styles.iconContent}>{child}</View>
        </View>
      ))}
    </>
  );
}

export function EditFieldInput({
  typography,
  align = 'left',
  onFocus,
  onBlur,
  onChangeText,
  multiline,
  style,
  value,
  placeholder,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  typography: TextStyles;
  align?: 'left' | 'right';
}) {
  const scroll = useContext(EditKeyboardScrollContext);
  const scrollEntityBlock = useContext(EditEntityBlockContext);
  const keyboardOffset = useFocusedFieldKeyboardOffset();

  if (multiline) {
    return (
      <EditMultilineField
        typography={typography}
        value={value}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onChangeText={onChangeText}
        style={style}
        {...props}
      />
    );
  }

  return (
    <DsTextInput
      placeholderTextColor={fg.secondary}
      value={value}
      placeholder={placeholder}
      style={[
        typography.body,
        styles.fieldInput,
        align === 'right' && styles.fieldInputRight,
        style,
      ]}
      onFocus={(event) => {
        const nativeTarget = event.nativeEvent.target;
        if (scrollEntityBlock) {
          scrollEntityBlock(true, nativeTarget);
        } else {
          scroll?.scrollInputIntoView(nativeTarget, keyboardOffset);
        }
        onFocus?.(event);
      }}
      onBlur={onBlur}
      {...props}
      multiline={false}
      numberOfLines={1}
      blurOnSubmit={props.blurOnSubmit ?? true}
      onChangeText={(text) => {
        onChangeText?.(sanitizeSingleLineText(text));
      }}
    />
  );
}

/**
 * iOS UITextView paints wrapped glyphs in these rows when scrolling is enabled,
 * but the edit page should own scrolling. A hidden `Text` sizer plus content
 * size keeps the input frame as tall as the text so the native view has
 * nothing to scroll inside.
 */
function EditMultilineField({
  typography,
  onFocus,
  onBlur,
  style,
  value,
  placeholder,
  ...props
}: Omit<React.ComponentProps<typeof TextInput>, 'multiline'> & { typography: TextStyles }) {
  const scroll = useContext(EditKeyboardScrollContext);
  const scrollEntityBlock = useContext(EditEntityBlockContext);
  const keyboardOffset = useFocusedFieldKeyboardOffset();
  const caretScreenYRef = useRef<number | null>(null);
  const [sizerHeight, setSizerHeight] = useState(EDIT_BODY_LINE_HEIGHT);
  const [contentHeight, setContentHeight] = useState(EDIT_BODY_LINE_HEIGHT);
  const hasValue = typeof value === 'string' && value.length > 0;

  useEffect(() => {
    setContentHeight((prev) => (sizerHeight < prev ? sizerHeight : prev));
  }, [sizerHeight]);
  const shown = hasValue ? value : placeholder && placeholder.length > 0 ? placeholder : ' ';
  const flatStyle = StyleSheet.flatten(style);
  const styleMinHeight =
    typeof flatStyle?.minHeight === 'number' ? flatStyle.minHeight : EDIT_BODY_LINE_HEIGHT;
  const boxHeight = Math.max(styleMinHeight, sizerHeight, contentHeight);

  return (
    <View style={[styles.fieldInputMultilineWrap, { minHeight: boxHeight }]}>
      <Text
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0) setSizerHeight((prev) => (prev === next ? prev : next));
        }}
        style={[
          typography.body,
          styles.multilineVisibleText,
          !hasValue && styles.multilinePlaceholder,
          style,
          { opacity: 0 },
        ]}
      >
        {shown}
      </Text>
      <DsTextInput
        placeholderTextColor={fg.secondary}
        {...props}
        value={value}
        placeholder={placeholder}
        multiline
        scrollEnabled
        blurOnSubmit={false}
        submitBehavior="newline"
        textAlignVertical="top"
        style={[
          typography.body,
          styles.multilineOverlayInput,
          style,
          { height: boxHeight, color: fg.primary },
        ]}
        onPressIn={(event) => {
          caretScreenYRef.current = event.nativeEvent.pageY;
        }}
        onContentSizeChange={(event) => {
          const next = Math.ceil(event.nativeEvent.contentSize.height);
          if (next > 0) setContentHeight((prev) => (prev === next ? prev : next));
        }}
        onFocus={(event) => {
          const nativeTarget = event.nativeEvent.target;
          if (scrollEntityBlock) {
            scrollEntityBlock(true, nativeTarget, caretScreenYRef.current ?? undefined);
          } else {
            scroll?.scrollInputIntoView(nativeTarget, keyboardOffset);
          }
          onFocus?.(event);
        }}
        onBlur={(event) => {
          caretScreenYRef.current = null;
          scroll?.setSuppressNativeKeyboardScroll(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
}

/** Quantity | UOM | unit price — 25 / 25 / 50; Qty/UOM keep a 44pt floor so empty placeholders don’t eat the gap. */
export function EditMaterialBreakdownRow({
  unitPrice,
  quantity,
  unit,
}: {
  unitPrice: ReactNode;
  quantity: ReactNode;
  unit: ReactNode;
}) {
  return (
    <View style={styles.materialBreakdownRow}>
      <View style={styles.materialQtyCol}>
        <View style={styles.materialBreakdownCell}>{quantity}</View>
      </View>
      <View style={styles.materialUomCol}>
        <View style={styles.materialBreakdownCell}>{unit}</View>
      </View>
      <View style={styles.materialPriceCol}>
        <View style={styles.materialBreakdownCell}>{unitPrice}</View>
      </View>
    </View>
  );
}

/** Date | time split row. */
export function EditSplitFields({
  typography,
  left,
  right,
  trailingPaddingRight,
}: {
  typography: TextStyles;
  left: ReactNode;
  right: ReactNode;
  /** Extra inset before the trailing edge (e.g. session duration). */
  trailingPaddingRight?: number;
}) {
  return (
    <View style={styles.splitRow}>
      <View style={styles.splitLeading}>{left}</View>
      <View
        style={[
          styles.splitTrailing,
          trailingPaddingRight != null && { paddingRight: trailingPaddingRight },
        ]}
      >
        {right}
      </View>
    </View>
  );
}

/** Tappable secondary action aligned with icon content (Add location style). */
export function EditActionText({
  typography,
  label,
  onPress,
  accessibilityLabel,
}: {
  typography: TextStyles;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
    >
      <Text style={[typography.body, { color: fg.secondary }]}>{label}</Text>
    </Pressable>
  );
}

/** Start – end time row (View-style range). */
export function EditSplitTimeRow({
  typography,
  startValue,
  endValue,
  startPlaceholder = 'Start',
  endPlaceholder = 'End',
  onPressStart,
  onPressEnd,
}: {
  typography: TextStyles;
  startValue: string;
  endValue: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  return (
    <View style={styles.timeRangeRow}>
      <View style={styles.timeHalf}>
        <EditTappableValue
          typography={typography}
          value={startValue}
          placeholder={startPlaceholder}
          accessibilityLabel="Start time"
          onPress={onPressStart}
        />
      </View>
      <Text style={[typography.body, styles.timeHyphen, { color: fg.secondary }]}> - </Text>
      <View style={styles.timeHalf}>
        <EditTappableValue
          typography={typography}
          value={endValue}
          placeholder={endPlaceholder}
          accessibilityLabel="End time"
          onPress={onPressEnd}
        />
      </View>
    </View>
  );
}

/** Tappable read-only value — opens a picker instead of the keyboard. */
export function EditTappableValue({
  typography,
  value,
  placeholder,
  onPress,
  variant = 'body',
  align = 'left',
  accessibilityLabel,
}: {
  typography: TextStyles;
  value: string;
  placeholder?: string;
  onPress: () => void;
  variant?: 'body' | 'bodySmall' | 'metric';
  align?: 'left' | 'right';
  accessibilityLabel: string;
}) {
  const isEmpty = value.length === 0;
  const display = isEmpty ? (placeholder ?? '') : value;
  const scrollEntityBlock = useContext(EditEntityBlockContext);
  const textStyle =
    variant === 'metric'
      ? typography.metric
      : variant === 'bodySmall'
        ? typography.bodySmall
        : typography.body;
  // iOS `Text` and `TextInput` disagree on baseline — mirror EditFieldInput so UOM
  // lines up with Quantity / Unit Price in both empty and filled states.
  const mirrorFieldInput = Platform.OS === 'ios' && variant === 'body';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        scrollEntityBlock?.(false);
        onPress();
      }}
      style={styles.tappableHit}
    >
      {mirrorFieldInput ? (
        <DsTextInput
          editable={false}
          caretHidden
          showSoftInputOnFocus={false}
          value={isEmpty ? '' : value}
          placeholder={placeholder}
          placeholderTextColor={fg.secondary}
          pointerEvents="none"
          style={[
            typography.body,
            styles.fieldInput,
            {
              color: isEmpty ? fg.secondary : fg.primary,
            },
            align === 'right' && styles.fieldInputRight,
          ]}
        />
      ) : (
        <Text
          style={[
            textStyle,
            editRowText,
            {
              color: isEmpty ? fg.secondary : fg.primary,
              textAlign: align,
              textTransform: variant === 'metric' ? 'none' : undefined,
            },
          ]}
          numberOfLines={1}
        >
          {display}
        </Text>
      )}
    </Pressable>
  );
}

/** Value on the right, tappable. */
export function EditValueRow({
  typography,
  value,
  onPress,
  accessibilityLabel,
}: {
  typography: TextStyles;
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.valueRow}
    >
      <Text style={[typography.body, styles.valueText]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

/** Add session / Add location style row with icon. */
export function EditAddRow({
  typography,
  icon,
  label,
  onPress,
  showTopBorder = false,
}: {
  typography: TextStyles;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  showTopBorder?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconRow, styles.addRow, showTopBorder && editSheetRowSeparator]}
    >
      <View style={styles.iconSlot}>
        <View style={styles.iconFrame}>{icon}</View>
      </View>
      <View style={styles.iconContent}>
        <Text style={[typography.body, editRowText, { color: fg.secondary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Checkbox row for confirming no materials / no other costs (Edit cards). */
export function EditConfirmNoneRow({
  typography,
  confirmed,
  confirmLabel,
  confirmedLabel,
  onToggle,
  showTopBorder = true,
  disabled = false,
}: {
  typography: TextStyles;
  confirmed: boolean;
  confirmLabel: string;
  confirmedLabel: string;
  onToggle: () => void;
  showTopBorder?: boolean;
  disabled?: boolean;
}) {
  const label = confirmed ? confirmedLabel : confirmLabel;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: confirmed, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onToggle}
      style={[styles.iconRow, styles.addRow, showTopBorder && editSheetRowSeparator]}
    >
      <View style={styles.iconSlot}>
        <View style={styles.iconFrame}>
          <View style={[styles.confirmCheckbox, confirmed && styles.confirmCheckboxChecked]}>
            {confirmed ? <Text style={styles.confirmCheckboxMark}>✓</Text> : null}
          </View>
        </View>
      </View>
      <View style={styles.iconContent}>
        <Text
          style={[
            typography.body,
            editRowText,
            { color: confirmed ? fg.primary : fg.secondary },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    overflow: 'hidden',
    marginTop: space('Spacing/12'),
  },
  titleFieldWrap: {
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/12'),
    minHeight: 52,
    justifyContent: 'center',
  },
  titleFieldClip: {
    width: '100%',
    overflow: 'hidden',
  },
  titleInput: {
    color: fg.primary,
    padding: 0,
    margin: 0,
    width: '100%',
  },
  descriptionFieldWrap: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: space('Spacing/16'),
    paddingBottom: space('Spacing/12'),
  },
  descriptionInput: {
    minHeight: EDIT_BODY_LINE_HEIGHT,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: space('Spacing/12'),
    paddingRight: space('Spacing/16'),
    gap: space('Spacing/12'),
  },
  iconRowTop: {
    alignItems: 'flex-start',
  },
  iconSlot: {
    width: EDIT_ICON_SLOT + space('Spacing/16'),
    paddingLeft: space('Spacing/16'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotTop: {
    paddingTop: 4,
    justifyContent: 'flex-start',
  },
  iconFrame: {
    width: EDIT_ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  fieldInput: {
    color: fg.primary,
    paddingHorizontal: 0,
    margin: 0,
    width: '100%',
  },
  fieldInputMultilineWrap: {
    position: 'relative',
    width: '100%',
  },
  multilineVisibleText: {
    color: fg.primary,
    padding: 0,
    margin: 0,
    width: '100%',
    includeFontPadding: false,
  },
  multilinePlaceholder: {
    color: fg.secondary,
  },
  multilineOverlayInput: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  addRow: {
    alignItems: 'center',
  },
  confirmCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg.surfaceWhite,
  },
  confirmCheckboxChecked: {
    backgroundColor: fg.primary,
    borderColor: fg.primary,
  },
  confirmCheckboxMark: {
    color: bg.surfaceWhite,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  fieldInputRight: {
    textAlign: 'right',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  splitLeading: {
    flex: 1,
    minWidth: 0,
  },
  splitTrailing: {
    width: 88,
    flexShrink: 0,
  },
  materialBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: EDIT_BODY_LINE_HEIGHT,
    gap: space('Spacing/8'),
  },
  materialBreakdownCell: {
    minHeight: EDIT_FIELD_INPUT_MIN_HEIGHT,
    justifyContent: 'center',
  },
  /** Floor so empty `Qty` / `UOM` placeholders keep the row gap on ~360dp phones. */
  materialQtyCol: {
    flex: 1,
    minWidth: 44,
    flexShrink: 0,
    justifyContent: 'center',
  },
  materialUomCol: {
    flex: 1,
    minWidth: 44,
    flexShrink: 0,
    justifyContent: 'center',
  },
  materialPriceCol: {
    flex: 2,
    minWidth: 0,
    justifyContent: 'center',
  },
  valueRow: {
    alignSelf: 'stretch',
  },
  valueText: {
    color: fg.primary,
    textAlign: 'right',
  },
  tappableHit: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: EDIT_FIELD_INPUT_MIN_HEIGHT,
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
    alignSelf: 'stretch',
  },
  timeHalf: {
    flex: 1,
    minWidth: 0,
  },
  timeHyphen: {
    flexShrink: 0,
  },
});
