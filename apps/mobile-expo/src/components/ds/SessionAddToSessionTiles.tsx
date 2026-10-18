import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '@fieldsolo/design-system/lib/tokens';

import { bg, border, cardShadowRn, fg } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';
import {
  SessionCaptureTileMaterialIcon,
  SessionCaptureTileNoteIcon,
} from '../figma-icons/JobDetailScreenIcons';

type TileKind = 'note' | 'material';

const TILE_LABEL: Record<TileKind, string> = {
  note: 'Note',
  material: 'Material',
};

function tileIcon(kind: TileKind, tint: string): ReactNode {
  const props = { color: tint };
  switch (kind) {
    case 'note':
      return <SessionCaptureTileNoteIcon {...props} />;
    case 'material':
      return <SessionCaptureTileMaterialIcon {...props} />;
  }
}

function tileTint(kind: TileKind): string {
  switch (kind) {
    case 'note':
      return color('Semantic/Activity/Note');
    case 'material':
      return color('Semantic/Activity/Material');
  }
}

export type SessionAddToSessionTilesProps = {
  typography: TextStyles;
  /** When set, Note tile is pressable. */
  onAddNote?: () => void;
  /** When set, Material tile is pressable. */
  onAddMaterial?: () => void;
};

/**
 * "Add to Session" heading + Note and Material capture tiles (half-width each).
 */
export function SessionAddToSessionTiles({
  typography,
  onAddNote,
  onAddMaterial,
}: SessionAddToSessionTilesProps) {
  return (
    <View style={styles.captureSection}>
      <Text style={[typography.bodySmall, { color: fg.primary }]}>Add to Visit</Text>
      <View style={styles.tileRow}>
        {(['note', 'material'] as TileKind[]).map((kind) => {
          const interactive =
            (kind === 'note' && onAddNote) || (kind === 'material' && onAddMaterial);
          const inner = (
            <>
              {tileIcon(kind, tileTint(kind))}
              <Text style={[styles.tileLabel, typography.pillCompact, { color: fg.primary }]}>
                {TILE_LABEL[kind]}
              </Text>
            </>
          );
          if (interactive) {
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={`Add ${TILE_LABEL[kind]}`}
                onPress={kind === 'note' ? onAddNote : onAddMaterial}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              >
                {inner}
              </Pressable>
            );
          }
          return (
            <View key={kind} style={styles.tile}>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captureSection: {
    marginTop: space('Spacing/16'),
    paddingHorizontal: space('Spacing/16'),
    gap: space('Spacing/8'),
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space('Spacing/8'),
    width: '100%',
  },
  tile: {
    ...cardShadowRn,
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: radius('Radius/12'),
    borderWidth: 1,
    borderColor: border.subtle,
    backgroundColor: bg.surfaceWhite,
    alignItems: 'center',
    paddingTop: 10,
    gap: 6,
  },
  tileLabel: {
    textTransform: 'none',
  },
  pressed: { opacity: 0.75 },
});
