import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  createFinancialDocument,
  deviceIanaTimeZone,
  FinancialDocumentError,
  listFinancialDocuments,
  previewFinancialDocument,
  setFinancialDocumentControls,
  shareDocumentUrl,
  type DocumentPreview,
  type FinancialDocumentRecord,
} from '@fieldsolo/api-client';
import { renderDocument, unsupportedRendererHtml, RENDERER_VERSION } from '@fieldsolo/document-renderer';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';

import {
  defaultDocumentType,
  documentLinkText,
  documentNumberLabel,
  gapLabels,
  gmailSubject,
  gmailUrl,
  pdfFileName,
  smsUrl,
  whatsAppUrl,
} from '../../lib/documentShare';
import { fg, space } from '../../theme/nativeTokens';
import type { TextStyles } from '../../theme/nativeTokens';

type Props = {
  client: FieldSoloSupabaseClient;
  jobId: string;
  workStatus: string;
  typography: TextStyles;
  mode: 'view' | 'edit';
  onEditDetails: () => void;
  /** Saves uncommitted Job edits before opening a preview. Return false to cancel. */
  beforeOpen?: () => Promise<boolean>;
};

function htmlFor(record: { rendererVersion: number; payload: DocumentPreview['payload']; paymentProjection: DocumentPreview['paymentProjection'] }) {
  if (record.rendererVersion !== RENDERER_VERSION) return unsupportedRendererHtml();
  return renderDocument(record.rendererVersion, record.payload, record.paymentProjection);
}

export function InvoicingJobControls({
  client,
  jobId,
  workStatus,
  typography,
  mode,
  onEditDetails,
  beforeOpen,
}: Props) {
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewType, setPreviewType] = useState<'estimate' | 'invoice'>(defaultDocumentType(workStatus));
  const [saved, setSaved] = useState<FinancialDocumentRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await listFinancialDocuments(client, jobId));
      setOffline(false);
    } catch {
      setError('Could not load this document.');
    } finally {
      setLoading(false);
    }
  }, [client, jobId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openUnsaved = useCallback(async () => {
    if (beforeOpen) {
      const ok = await beforeOpen().catch(() => false);
      if (!ok) return;
    }
    setPreviewOpen(true);
    setSaved(null);
    setBusy('Loading');
    setPreviewType(defaultDocumentType(workStatus));
    try {
      const next = await previewFinancialDocument(client, {
        jobId,
        type: defaultDocumentType(workStatus),
        timezone: deviceIanaTimeZone(),
      });
      setPreview(next);
      setOffline(false);
    } catch {
      setOffline(true);
      Alert.alert('Could not load this document.', 'Retry');
    } finally {
      setBusy(null);
    }
  }, [beforeOpen, client, jobId, workStatus]);

  const switchType = useCallback(
    async (type: 'estimate' | 'invoice') => {
      if (saved) return;
      setPreviewType(type);
      setBusy('Loading');
      try {
        setPreview(
          await previewFinancialDocument(client, {
            jobId,
            type,
            timezone: deviceIanaTimeZone(),
          }),
        );
      } catch {
        Alert.alert('Could not load this document.', 'Retry');
      } finally {
        setBusy(null);
      }
    },
    [client, jobId, saved],
  );

  const createAndShare = useCallback(async () => {
    if (!preview || preview.gaps.length > 0) return;
    const key = requestKey ?? newRequestKey();
    setRequestKey(key);
    setBusy('Creating…');
    try {
      const created = await createFinancialDocument(client, {
        jobId,
        type: previewType,
        fingerprint: preview.fingerprint,
        timezone: deviceIanaTimeZone(),
        requestKey: key,
      });
      setSaved(created);
      setRequestKey(null);
      setShareOpen(true);
      await reload();
    } catch (error) {
      if (error instanceof FinancialDocumentError && error.code === 'stale') {
        Alert.alert('This Job changed. Review the updated preview before sharing.');
        const next = await previewFinancialDocument(client, {
          jobId,
          type: previewType,
          timezone: deviceIanaTimeZone(),
        }).catch(() => null);
        if (next) setPreview(next);
        setRequestKey(null);
      } else if (error instanceof FinancialDocumentError && error.code === 'incomplete') {
        Alert.alert('Complete these details before sharing.');
      } else {
        Alert.alert('Could not confirm creation. Try again.');
      }
    } finally {
      setBusy(null);
    }
  }, [client, jobId, preview, previewType, reload, requestKey]);

  const active = saved;
  const link = active ? shareDocumentUrl(active.token) : '';
  const linkText = active
    ? documentLinkText({
        type: active.documentType,
        number: active.documentNumber,
        businessName: active.payload.businessName,
        url: link,
      })
    : '';

  const handoff = useCallback(
    async (kind: 'messages' | 'whatsapp' | 'gmail' | 'more' | 'copy' | 'browser' | 'pdf') => {
      if (!active) return;
      if (!active.linkEnabled && kind !== 'pdf') {
        Alert.alert('Enable the shared link in Docs to share a link.');
        return;
      }
      try {
        if (kind === 'copy') {
          await Clipboard.setStringAsync(link);
          Alert.alert('Link copied.');
          return;
        }
        if (kind === 'browser') {
          const opened = await Linking.openURL(link);
          if (!opened) Alert.alert('Could not open this link. Try again.');
          return;
        }
        if (kind === 'messages') {
          await Linking.openURL(smsUrl(active.payload.customerPhone, linkText));
          return;
        }
        if (kind === 'whatsapp') {
          const url = whatsAppUrl(active.payload.customerPhone, linkText);
          const can = url ? await Linking.canOpenURL(url) : false;
          if (!can || !url) {
            Alert.alert('WhatsApp is unavailable. Use More to share this link.');
            return;
          }
          await Linking.openURL(url);
          return;
        }
        if (kind === 'gmail') {
          const available = await MailComposer.isAvailableAsync();
          if (!available) {
            Alert.alert('Gmail is unavailable. Use More to share this link.');
            return;
          }
          await Linking.openURL(
            gmailUrl({
              email: active.payload.customerEmail,
              subject: gmailSubject({
                type: active.documentType,
                number: active.documentNumber,
                businessName: active.payload.businessName,
              }),
              body: linkText,
            }),
          ).catch(async () => {
            await MailComposer.composeAsync({
              subject: gmailSubject({
                type: active.documentType,
                number: active.documentNumber,
                businessName: active.payload.businessName,
              }),
              body: linkText,
              recipients: active.payload.customerEmail ? [active.payload.customerEmail] : [],
            });
          });
          return;
        }
        if (kind === 'more') {
          await Share.share({ message: linkText });
          return;
        }
        setBusy('Creating PDF…');
        const file = await Print.printToFileAsync({
          html: htmlFor(active),
        });
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('PDF sharing is unavailable on this device.');
          return;
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: pdfFileName(active.documentType, active.documentNumber),
        });
      } catch {
        if (kind === 'pdf') Alert.alert('Could not create the PDF. Try again.');
        else Alert.alert('Could not open this link. Try again.');
      } finally {
        setBusy(null);
      }
    },
    [active, link, linkText],
  );

  const visibleDocs = mode === 'view' ? documents.filter((doc) => !doc.archived) : documents;

  return (
    <View style={styles.block}>
      <Text style={typography.headingH2}>Docs</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading documents" /> : null}
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => void reload()}>
          <Text style={typography.body}>{error} Retry</Text>
        </Pressable>
      ) : null}
      {!loading && visibleDocs.length === 0 ? (
        <Text style={typography.body}>No documents yet.</Text>
      ) : null}
      {visibleDocs.map((doc) => (
        <Pressable
          key={doc.id}
          accessibilityRole="button"
          onPress={() => {
            if (mode === 'view') onEditDetails();
          }}
          style={styles.row}
        >
          <Text style={typography.body}>
            {documentNumberLabel(doc.documentType, doc.documentNumber)}
            {doc.archived ? ' Archived' : ''}
          </Text>
          <Text style={typography.bodySmall}>{doc.issueDate}</Text>
          {mode === 'edit' ? (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Preview"
                onPress={() => {
                  setSaved(doc);
                  setPreviewOpen(true);
                  setShareOpen(false);
                }}
              >
                <Text style={typography.body}>Preview</Text>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: doc.archived }}
                onPress={() => {
                  void setFinancialDocumentControls(client, {
                    documentId: doc.id,
                    archived: !doc.archived,
                    linkEnabled: doc.linkEnabled,
                    expectedRevision: doc.controlRevision,
                  })
                    .then(() => reload())
                    .catch(() => Alert.alert('Could not update document settings. Try again.'));
                }}
              >
                <Text style={typography.body}>{doc.archived ? 'Archived' : 'Archive'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: doc.linkEnabled }}
                onPress={() => {
                  void setFinancialDocumentControls(client, {
                    documentId: doc.id,
                    archived: doc.archived,
                    linkEnabled: !doc.linkEnabled,
                    expectedRevision: doc.controlRevision,
                  })
                    .then(() => reload())
                    .catch(() => Alert.alert('Could not update document settings. Try again.'));
                }}
              >
                <Text style={typography.body}>
                  {doc.linkEnabled ? 'Shared link enabled' : 'Shared link disabled'}
                </Text>
              </Pressable>
              <Text style={typography.bodySmall}>Anyone with an enabled link can view this document.</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
      {mode === 'view' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share job document"
          onPress={() => void openUnsaved()}
          style={styles.share}
        >
          <Text style={[typography.body, styles.shareLabel]}>Share</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => void openUnsaved()}>
          <Text style={typography.body}>Generate new</Text>
        </Pressable>
      )}
      {offline ? (
        <Text style={typography.bodySmall}>Offline — payment status may be out of date.</Text>
      ) : null}

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.preview}>
          <View style={styles.previewBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setPreviewOpen(false)}>
              <Text style={typography.body}>Back</Text>
            </Pressable>
            {!saved ? (
              <View style={styles.selector}>
                <Pressable accessibilityRole="button" onPress={() => void switchType('estimate')}>
                  <Text style={typography.body}>Estimate</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void switchType('invoice')}>
                  <Text style={typography.body}>Invoice</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={typography.body}>
                {documentNumberLabel(saved.documentType, saved.documentNumber)}
              </Text>
            )}
          </View>
          {busy ? <Text accessibilityRole="text">{busy}</Text> : null}
          {preview && !saved && preview.gaps.length > 0 ? (
            <View>
              <Text style={typography.body}>Complete these details before sharing:</Text>
              {gapLabels(preview.gaps).map((label) => (
                <Text key={label} style={typography.body}>
                  {label}
                </Text>
              ))}
              <Pressable accessibilityRole="button" onPress={onEditDetails}>
                <Text style={typography.body}>Edit details</Text>
              </Pressable>
            </View>
          ) : null}
          <WebView
            originWhitelist={['*']}
            source={{
              html: saved
                ? htmlFor(saved)
                : preview
                  ? htmlFor({ ...preview, paymentProjection: preview.paymentProjection })
                  : '<html><body></body></html>',
            }}
            style={styles.web}
          />
          {!saved && preview && preview.gaps.length === 0 ? (
            <Pressable accessibilityRole="button" onPress={() => void createAndShare()} style={styles.share}>
              <Text style={[typography.body, styles.shareLabel]}>
                {busy === 'Creating…'
                  ? 'Creating…'
                  : previewType === 'estimate'
                    ? 'Create & Share Estimate'
                    : 'Create & Share Invoice'}
              </Text>
            </Pressable>
          ) : null}
          {saved ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShareOpen(true)}
              style={styles.share}
            >
              <Text style={[typography.body, styles.shareLabel]}>
                {saved.documentType === 'estimate' ? 'Share Estimate' : 'Share Invoice'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShareOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={typography.headingH2}>
              {active ? (active.documentType === 'estimate' ? 'Share Estimate' : 'Share Invoice') : 'Share'}
            </Text>
            {active ? (
              <Text style={typography.body}>
                {documentNumberLabel(active.documentType, active.documentNumber)}
              </Text>
            ) : null}
            <ScrollView horizontal>
              {(['messages', 'whatsapp', 'gmail', 'more'] as const).map((kind) => (
                <Pressable key={kind} accessibilityRole="button" onPress={() => void handoff(kind)} style={styles.dest}>
                  <Text style={typography.body}>
                    {kind === 'messages' ? 'Messages' : kind === 'whatsapp' ? 'WhatsApp' : kind === 'gmail' ? 'Gmail' : 'More'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => void handoff('copy')}>
              <Text style={typography.body}>Copy link</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void handoff('browser')}>
              <Text style={typography.body}>Open in browser</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void handoff('pdf')}>
              <Text style={typography.body}>{busy === 'Creating PDF…' ? 'Creating PDF…' : 'Download PDF'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function newRequestKey(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const styles = StyleSheet.create({
  block: { gap: space('Spacing/8'), marginTop: space('Spacing/16') },
  row: { paddingVertical: space('Spacing/8'), gap: 4 },
  share: {
    minHeight: 48,
    backgroundColor: fg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  shareLabel: { color: '#fff' },
  preview: { flex: 1, backgroundColor: '#fff', paddingTop: 48 },
  previewBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  selector: { flexDirection: 'row', gap: 16 },
  web: { flex: 1, backgroundColor: '#fff' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', padding: 20, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  dest: { padding: 12, minWidth: 88, minHeight: 48, justifyContent: 'center' },
});
