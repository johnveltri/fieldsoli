import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import {
  CONTENT_COLUMN_MAX_WIDTH,
  contentColumnMetrics,
} from '@fieldsolo/design-system/lib/responsiveLayout';
import {
  color,
  radius,
  space,
  typographyJson,
  type TypographyTokenName,
} from '@fieldsolo/design-system/lib/tokens';

export {
  CONTENT_COLUMN_MAX_WIDTH,
  CONTENT_GUTTER_COMPACT,
  CONTENT_GUTTER_DEFAULT,
  COMPACT_WIDTH_BREAKPOINT,
  FAB_SIZE,
  FAB_CONTENT_GAP,
  contentColumnMetrics,
  contentGutter,
  fabRightInset,
  scrollBottomInsetForFab,
} from '@fieldsolo/design-system/lib/responsiveLayout';

/** RN styles for the shared responsive content column. */
export function contentColumnStyleRn(windowWidth: number): ViewStyle {
  const { gutter } = contentColumnMetrics(windowWidth);
  return {
    width: '100%',
    maxWidth: CONTENT_COLUMN_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: gutter,
  };
}

export const bg = {
  canvas: color('Foundation/Background/Default'),
  canvasWarm: color('Foundation/Background/CanvasWarm'),
  surface: color('Foundation/Surface/Default'),
  surfaceWhite: color('Foundation/Surface/White'),
  subtle: color('Foundation/Surface/Subtle'),
} as const;

export const fg = {
  primary: color('Foundation/Text/Primary'),
  secondary: color('Foundation/Text/Secondary'),
  muted: color('Foundation/Text/Muted'),
} as const;

export const border = {
  subtle: color('Foundation/Border/Subtle'),
  default: color('Foundation/Border/Default'),
} as const;

/**
 * Maps `Shadow/Card/Default` (`0px 1px 2px rgba(0,0,0,0.05)`).
 *
 * iOS uses shadow* props. Android Material `elevation` ignores opacity/radius and
 * elevation:2 reads as a harsh grey slab on CanvasWarm — keep a softer lift
 * (elevation 1 + ambient shadowColor on API 28+) without changing iOS.
 */
export const cardShadowRn: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: color('Foundation/Shadow/Ambient'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  android: {
    shadowColor: color('Foundation/Shadow/Ambient'),
    // Soft warm-paper lift; elevation 2+ is too strong vs iOS 5% ambient.
    elevation: 1,
  },
  default: {
    shadowColor: color('Foundation/Shadow/Ambient'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
})!;

export const shadowNoneRn: ViewStyle = {
  shadowOpacity: 0,
  elevation: 0,
};

export function padScreenHorizontal(): number {
  return space('Spacing/20');
}

export { color, radius, space };

export type LoadedFonts = {
  serifBold: string;
  sans: string;
  sansSemi: string;
  sansBold: string;
};

type TypographyDef = (typeof typographyJson)[TypographyTokenName];

function fontFamilyForToken(t: TypographyDef, f: LoadedFonts): string {
  if (t.family === 'PT Serif') return f.serifBold;
  if (t.weight >= 700) return f.sansBold;
  if (t.weight >= 600) return f.sansSemi;
  return f.sans;
}

/** Line height in px: token `100` = auto → ~1.25× font size; else percent of font size. */
function lineHeightPx(t: TypographyDef): number {
  if (t.lineHeight === 100) {
    return Math.round(t.size * 1.25);
  }
  return Math.round((t.size * t.lineHeight) / 100);
}

/** Letter-spacing in px (approximates CSS `letterSpacing/100 em`). */
function letterSpacingPx(t: TypographyDef): number {
  if (t.letterSpacing === 0) return 0;
  return Math.round((t.letterSpacing / 100) * t.size * 10) / 10;
}

/**
 * Builds React Native `TextStyle` from design-system `typography.json` + loaded Expo font names.
 */
export function typographyRn(
  token: TypographyTokenName,
  f: LoadedFonts,
  colorOverride?: string,
): TextStyle {
  const t = typographyJson[token];
  const textTransform =
    'textTransform' in t && t.textTransform === 'uppercase' ? 'uppercase' : 'none';

  return {
    fontFamily: fontFamilyForToken(t, f),
    fontSize: t.size,
    lineHeight: lineHeightPx(t),
    letterSpacing: letterSpacingPx(t),
    textTransform,
    color: colorOverride ?? fg.primary,
  };
}

export type TextStyles = ReturnType<typeof createTextStyles>;

/**
 * Extra layout height beyond the design token line-height. iOS `TextInput` clips glyphs to
 * `lineHeight`, so we either omit it (iOS) or inflate it (Android).
 */
export const TEXT_INPUT_DESCENDER_SLACK = Platform.select({ ios: 6, android: 4, default: 4 }) ?? 4;

/** Minimum box height for a single-line input using the given design line-height. */
export function textInputMinHeight(designLineHeight: number): number {
  return designLineHeight + TEXT_INPUT_DESCENDER_SLACK;
}

/**
 * Applies typography to a `TextInput` without clipping descenders. Use instead of raw token
 * styles on single-line inputs (edit rows, sheet fields, search bars).
 */
export function withTextInputMetrics(style: TextStyle): TextStyle {
  const fontSize = style.fontSize ?? 16;
  const designLineHeight =
    typeof style.lineHeight === 'number' ? style.lineHeight : Math.round(fontSize * 1.4);
  const minHeight = textInputMinHeight(designLineHeight);

  if (Platform.OS === 'ios') {
    // iOS clips descenders when `lineHeight` matches tight design tokens — drop it and
    // size the field with `minHeight` so native font metrics can paint below the baseline.
    const { lineHeight: _lineHeight, ...rest } = style;
    return {
      ...rest,
      includeFontPadding: false,
      minHeight,
    };
  }

  return {
    ...style,
    lineHeight: designLineHeight + TEXT_INPUT_DESCENDER_SLACK,
    includeFontPadding: false,
    minHeight,
    textAlignVertical: 'center' as const,
  };
}

/** Typography mapped to loaded Expo Google Font family names — all sizes/weights from `typography.json`. */
export function createTextStyles(f: LoadedFonts) {
  const t = (name: TypographyTokenName, colorOverride?: string): TextStyle =>
    typographyRn(name, f, colorOverride);

  return {
    displayH1: t('Typography/Display-H1'),
    titleH3: t('Typography/Title-H3'),
    headingH2: t('Typography/Heading-H2'),
    body: t('Typography/Body'),
    bodySecondary: { ...t('Typography/Body'), color: fg.secondary },
    bodyBold: t('Typography/Body-Bold'),
    bodySmall: t('Typography/Body-Small'),
    labelCaps: t('Typography/LABEL'),
    labelHeadingSecondary: t('Typography/LABEL', fg.secondary),
    metric: t('Typography/Metric'),
    metricXL: t('Typography/Metric-XL'),
    metricS: t('Typography/Section/MetricS-Dense', color('Brand/Accent')),
    sessionTimeRange: t('Typography/Session/TimeRange', fg.secondary),
    jobDetailSubtitle: t('Typography/JobDetail/Subtitle', fg.secondary),
    jobDetailCategoryLabel: t('Typography/JobDetail/CategoryLabel', fg.secondary),
    jobDetailMetricColumnLabel: t('Typography/JobDetail/MetricColumnLabel', fg.secondary),
    jobDetailNetAmount: t('Typography/JobDetail/NetAmount'),
    ctaPrimaryLabel: t('Typography/CTA/PrimaryLabel'),
    pillCompact: t('Typography/Pill/Compact'),
    /** `Typography/Metric-S` — block / tile button labels (16 SemiBold). */
    metricSLabel: t('Typography/Metric-S'),
    /** `Typography/LABEL` — status pills; pair with `color` from semantic status tokens (all-caps in UI). */
    statusPillLabel: t('Typography/LABEL'),
  };
}
