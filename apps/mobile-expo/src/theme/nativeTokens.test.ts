import { Platform } from 'react-native';

import {
  TEXT_INPUT_DESCENDER_SLACK,
  textInputMinHeight,
  withTextInputMetrics,
} from './nativeTokens';

describe('withTextInputMetrics', () => {
  it('sizes inputs taller than design line-height so descenders are not clipped', () => {
    const body = { fontSize: 16, lineHeight: 22 };
    const metrics = withTextInputMetrics(body);

    expect(metrics.includeFontPadding).toBe(false);
    expect(metrics.minHeight).toBe(textInputMinHeight(22));

    if (Platform.OS === 'ios') {
      expect(metrics.lineHeight).toBeUndefined();
    } else {
      expect(metrics.lineHeight).toBe(22 + TEXT_INPUT_DESCENDER_SLACK);
      expect(metrics.textAlignVertical).toBe('center');
    }
  });
});
