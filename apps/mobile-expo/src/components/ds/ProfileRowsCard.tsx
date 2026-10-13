import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import { ProfileChevronRightIcon } from '../figma-icons/ProfileScreenIcons';

/**
 * Single bordered card listing one or more profile rows. Each row sits
 * underneath a 1px hairline that matches the Figma `1922:1691` /
 * `1924:1841` / `1924:1880` / `1924:1947` cards.
 *
 * Variants:
 *   - `field`       — uppercase tiny label + value (Name / Email / Trade)
 *   - `link`        — single-line label + chevron (Change password / Log out)
 *   - `linkBadge`   — label + sublabel + status pill + chevron (Current Plan)
 *   - `linkWithIcon`— leading icon + label (Delete account)
 *   - `toggle`      — label + optional sublabel + Switch
 */

type ProfileRowFieldVariant = {
  kind: 'field';
  /** Uppercase tiny label, e.g. "Name". */
  label: string;
  /** Body text under the label. Use "—" for empty. */
  value: string;
};

type ProfileRowLinkVariant = {
  kind: 'link';
  label: string;
  onPress?: () => void;
  /** Replaces the default trailing chevron for action rows. */
  trailingIcon?: ReactNode;
  /** When set, label uses the matching color and chevron tint matches. */
  tone?: 'default' | 'danger';
  /** Hide the trailing chevron — Log out is a terminal action. */
  hideChevron?: boolean;
};

type ProfileRowLinkBadgeVariant = {
  kind: 'linkBadge';
  label: string;
  sublabel?: string;
  badge?: {
    text: string;
    /** Filled background + matching outline color. */
    color: string;
    backgroundColor: string;
  };
  onPress?: () => void;
  hideChevron?: boolean;
};

type ProfileRowLinkWithIconVariant = {
  kind: 'linkWithIcon';
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
};

type ProfileRowToggleVariant = {
  kind: 'toggle';
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

export type ProfileRowsCardRow =
  | ProfileRowFieldVariant
  | ProfileRowLinkVariant
  | ProfileRowLinkBadgeVariant
  | ProfileRowLinkWithIconVariant
  | ProfileRowToggleVariant;

type ProfileRowsCardProps = {
  typography: TextStyles;
  rows: ProfileRowsCardRow[];
  /**
   * @default true. When false the outer card border (and shadow) are
   * omitted — useful when nesting in another framed surface.
   */
  framed?: boolean;
  /**
   * No surface fill or card chrome — for destructive actions that should not
   * read as a list row (e.g. Delete account).
   */
  plain?: boolean;
};

export function ProfileRowsCard({
  typography,
  rows,
  framed = true,
  plain = false,
}: ProfileRowsCardProps) {
  return (
    <View
      style={[
        styles.card,
        plain && styles.cardPlain,
        framed && !plain && styles.cardFramed,
      ]}
    >
      {rows.map((row, i) => (
        <Row
          key={`profile-row-${i}`}
          row={row}
          typography={typography}
          index={i}
          plain={plain}
        />
      ))}
    </View>
  );
}

function Row({
  row,
  typography,
  index,
  plain,
}: {
  row: ProfileRowsCardRow;
  typography: TextStyles;
  index: number;
  plain: boolean;
}) {
  // The Figma cards top-stroke every row except the first — visually all
  // rows are separated by a single 1px hairline (the card border + the
  // first row's missing top edge collapse into the same line).
  const topBorder = index > 0 ? styles.rowTopBorder : null;

  if (row.kind === 'field') {
    return (
      <View style={[styles.fieldRow, topBorder]}>
        <Text style={[typography.bodySmall, { color: fg.secondary }]}>{row.label}</Text>
        <Text style={[typography.body, { color: fg.primary }]}>{row.value}</Text>
      </View>
    );
  }

  if (row.kind === 'link') {
    const labelColor =
      row.tone === 'danger' ? color('Semantic/Status/Error/Text') : fg.primary;
    const chevronColor =
      row.tone === 'danger' ? color('Semantic/Status/Error/Text') : fg.secondary;
    const interactive = !!row.onPress;
    const Body = (
      <View style={styles.linkRowInner}>
        <Text style={[typography.bodyBold, { color: labelColor, flex: 1, minWidth: 0 }]}>
          {row.label}
        </Text>
        {row.trailingIcon ?? (!row.hideChevron ? (
          <ProfileChevronRightIcon color={chevronColor} size={12} />
        ) : null)}
      </View>
    );

    if (!interactive) {
      return <View style={[styles.linkRow, topBorder]}>{Body}</View>;
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.label}
        onPress={row.onPress}
        style={({ pressed }) => [styles.linkRow, topBorder, pressed && styles.pressed]}
      >
        {Body}
      </Pressable>
    );
  }

  if (row.kind === 'linkBadge') {
    const interactive = !!row.onPress;
    const Body = (
      <View style={styles.linkBadgeInner}>
        <View style={styles.linkBadgeLeftCol}>
          <Text style={[typography.bodyBold, { color: fg.primary }]}>{row.label}</Text>
          {row.sublabel ? (
            <Text style={[typography.bodySmall, { color: fg.secondary }]}>{row.sublabel}</Text>
          ) : null}
        </View>
        {row.badge ? (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: row.badge.backgroundColor,
              },
            ]}
          >
            <Text
              style={[
                typography.statusPillLabel,
                { color: row.badge.color, textTransform: 'uppercase' },
              ]}
            >
              {row.badge.text}
            </Text>
          </View>
        ) : null}
        {!row.hideChevron ? (
          <ProfileChevronRightIcon color={fg.secondary} size={12} />
        ) : null}
      </View>
    );

    if (!interactive) {
      return <View style={[styles.linkRow, topBorder]}>{Body}</View>;
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.label}
        onPress={row.onPress}
        style={({ pressed }) => [styles.linkRow, topBorder, pressed && styles.pressed]}
      >
        {Body}
      </Pressable>
    );
  }

  // linkWithIcon
  if (row.kind === 'linkWithIcon') {
    const labelColor =
      row.tone === 'danger' ? color('Semantic/Status/Error/Text') : fg.primary;
    const interactive = !!row.onPress;
    const rowStyle = plain ? styles.linkRowPlain : styles.linkRow;
    const Body = (
      <View style={styles.linkIconInner}>
        {row.icon}
        <Text style={[typography.bodyBold, { color: labelColor, flex: 1, minWidth: 0 }]}>
          {row.label}
        </Text>
      </View>
    );
    if (!interactive) {
      return <View style={[rowStyle, !plain && topBorder]}>{Body}</View>;
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.label}
        onPress={row.onPress}
        style={({ pressed }) => [rowStyle, !plain && topBorder, pressed && styles.pressed]}
      >
        {Body}
      </Pressable>
    );
  }

  return (
    <View style={[styles.toggleRow, topBorder]}>
      <View style={styles.toggleTextCol}>
        <Text style={[typography.bodyBold, { color: fg.primary }]}>{row.label}</Text>
        {row.sublabel ? (
          <Text style={[typography.bodySmall, { color: fg.secondary }]}>{row.sublabel}</Text>
        ) : null}
      </View>
      <View style={styles.toggleSwitchWrap}>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={row.label}
          value={row.value}
          onValueChange={row.onValueChange}
          disabled={row.disabled}
          trackColor={{ false: border.subtle, true: color('Brand/Accent') }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    overflow: 'hidden',
  },
  cardFramed: {
    borderWidth: 1,
    borderColor: border.subtle,
    ...cardShadowRn,
  },
  cardPlain: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
  },
  rowTopBorder: {
    borderTopWidth: 1,
    borderTopColor: border.subtle,
  },
  fieldRow: {
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/16'),
    gap: space('Spacing/4'),
  },
  linkRow: {
    paddingHorizontal: space('Spacing/16'),
    minHeight: 70,
    justifyContent: 'center',
  },
  linkRowPlain: {
    paddingHorizontal: space('Spacing/16'),
    paddingVertical: space('Spacing/8'),
    justifyContent: 'center',
  },
  linkRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space('Spacing/12'),
  },
  linkBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  linkBadgeLeftCol: {
    flex: 1,
    minWidth: 0,
    gap: space('Spacing/4'),
  },
  statusPill: {
    paddingHorizontal: space('Spacing/12'),
    paddingVertical: space('Spacing/4'),
    borderRadius: radius('Radius/Full'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkIconInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/8'),
  },
  toggleRow: {
    paddingHorizontal: space('Spacing/16'),
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space('Spacing/12'),
  },
  toggleTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: space('Spacing/4'),
  },
  toggleSwitchWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
