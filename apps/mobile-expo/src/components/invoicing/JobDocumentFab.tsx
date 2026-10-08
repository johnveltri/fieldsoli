import { StyleSheet, View } from 'react-native';

import { PlatformPrimaryAction } from '../platform/PlatformPrimaryAction';
import { shellDockRowHeight } from '../platform/shellDockMetrics';
import { useContentColumn } from '../../theme/useContentColumn';
import { space } from '../../theme/nativeTokens';

/** Shares the Home FAB's platform surface, sizing, icon and pressed state. */
export function JobDocumentFab({
  bottomInset,
  onShare,
}: {
  bottomInset: number;
  onShare: () => void;
}) {
  const { fabRight } = useContentColumn();
  return (
    <View
      style={[
        styles.anchor,
        { right: fabRight, bottom: bottomInset + space('Spacing/16') },
      ]}
    >
      <PlatformPrimaryAction
        open={false}
        onOpen={onShare}
        onClose={() => undefined}
        size={shellDockRowHeight()}
        onSelectMenuItem={() => undefined}
        accessibilityLabel="Share job document"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', zIndex: 10, elevation: 10 },
});
