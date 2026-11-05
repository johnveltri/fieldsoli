import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  grantAnalyticsConsent,
  withdrawAnalyticsConsent,
} from '../lib/analytics/consentSync';
import { LEGAL_URLS } from '../lib/legal-versions';
import { analyticsConfig } from '../lib/analytics/config';
import { cardShadowRn, fg, space } from '../theme/nativeTokens';

type AnalyticsConsentPromptModalProps = {
  visible: boolean;
  userId: string;
  onResolved: () => void;
};

export function AnalyticsConsentPromptModal({
  visible,
  userId,
  onResolved,
}: AnalyticsConsentPromptModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
    setError(null);
  }, [visible]);

  const onAllow = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await grantAnalyticsConsent(userId);
      onResolved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your choice. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [onResolved, userId]);

  const onDecline = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await withdrawAnalyticsConsent(userId);
      onResolved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your choice. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }, [onResolved, userId]);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Help improve FieldSoli?</Text>
          <Text style={styles.body}>
            FieldSoli uses optional product analytics to understand reliability
            and improve features. Analytics stay off unless you tap Allow
            analytics below.
          </Text>
          <Text style={styles.listHeading}>If enabled, we may collect:</Text>
          <Text style={styles.listItem}>• App interactions (screens and actions you take)</Text>
          <Text style={styles.listItem}>• Device platform and app version</Text>
          {analyticsConfig.appleAdsAttributionEnabled && analyticsConfig.platform === 'ios' && (
            <Text style={styles.listItem}>• Apple Ads campaign information, linked to your app activity, to measure which ads are useful</Text>
          )}
          <Text style={styles.listItem}>• Coarse error categories (not raw error text)</Text>
          <Text style={styles.body}>
            We do not sell your data. You can change this anytime in Privacy
            Choices. See our{' '}
            <Text
              style={styles.link}
              onPress={() => void Linking.openURL(LEGAL_URLS.privacyPolicy)}
            >
              Privacy Policy
            </Text>{' '}
            for details.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void onAllow()}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonLabel}>Allow analytics</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => void onDecline()}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryButton,
              { opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.secondaryButtonLabel}>No thanks</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space('Spacing/24'),
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: space('Spacing/24'),
    gap: space('Spacing/12'),
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: fg.primary,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: fg.secondary,
  },
  listHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: fg.primary,
    marginTop: space('Spacing/4'),
  },
  listItem: {
    fontSize: 15,
    lineHeight: 22,
    color: fg.secondary,
  },
  link: {
    color: fg.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  error: {
    color: '#b00020',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    ...cardShadowRn,
    marginTop: space('Spacing/8'),
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonLabel: {
    color: fg.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
