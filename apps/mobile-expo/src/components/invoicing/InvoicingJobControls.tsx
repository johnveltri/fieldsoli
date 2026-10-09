import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { PTSerif_700Bold } from '@expo-google-fonts/pt-serif';
import {
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
} from '@expo-google-fonts/ubuntu';
import {
  createFinancialDocument,
  deviceIanaTimeZone,
  FinancialDocumentError,
  formatCustomerPhoneDisplay,
  listFinancialDocuments,
  previewFinancialDocument,
  setFinancialDocumentControls,
  shareDocumentUrl,
  type DocumentPreview,
  type FinancialDocumentRecord,
} from '@fieldsolo/api-client';
import {
  renderDocument,
  renderDocumentPreview,
  unsupportedRendererHtml,
  RENDERER_VERSION,
  type PreviewFontData,
} from '@fieldsolo/document-renderer';
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
import {
  bg,
  border,
  cardShadowRn,
  color,
  fg,
  radius,
  space,
} from '../../theme/nativeTokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformHeaderAction } from '../platform/PlatformHeaderAction';
import { TopHeaderBackIcon } from '../figma-icons/TopHeaderIcons';
import { ProfileChevronRightIcon } from '../figma-icons/ProfileScreenIcons';
import {
  BusinessSettingsScreen,
  type BusinessSettingsScreenHandle,
} from '../../screens/BusinessSettingsScreen';
import { BottomSheetShell } from '../ds/BottomSheetShell';
import { FullWidthFab } from '../ds/FullWidthFab';
import { ProfileRowsCard } from '../ds/ProfileRowsCard';
import { SegmentedControl } from '../ds/SegmentedControl';
import { useContentColumn } from '../../theme/useContentColumn';
import type { TextStyles } from '../../theme/nativeTokens';

type Props = {
  client: FieldSoloSupabaseClient;
  jobId: string;
  workStatus: string;
  typography: TextStyles;
  mode: 'view' | 'edit';
  onEditDetails: () => void;
  onManageDocs?: () => void;
  /** Saves uncommitted Job edits before opening a preview. Return false to cancel. */
  beforeOpen?: () => Promise<boolean>;
};

let previewFontDataPromise: Promise<PreviewFontData> | null = null;

function loadPreviewFontData(): Promise<PreviewFontData> {
  if (!previewFontDataPromise) {
    previewFontDataPromise = Promise.all([
      Asset.fromModule(Ubuntu_400Regular).downloadAsync(),
      Asset.fromModule(Ubuntu_500Medium).downloadAsync(),
      Asset.fromModule(Ubuntu_700Bold).downloadAsync(),
      Asset.fromModule(PTSerif_700Bold).downloadAsync(),
    ]).then(async ([bodyAsset, bodyBoldAsset, labelAsset, displayAsset]) => {
      if (
        !bodyAsset.localUri ||
        !bodyBoldAsset.localUri ||
        !labelAsset.localUri ||
        !displayAsset.localUri
      ) {
        throw new Error('preview_font_asset_unavailable');
      }
      const [body, bodyBold, label, display] = await Promise.all([
        new File(bodyAsset.localUri).base64(),
        new File(bodyBoldAsset.localUri).base64(),
        new File(labelAsset.localUri).base64(),
        new File(displayAsset.localUri).base64(),
      ]);
      return { body, bodyBold, label, display };
    });
  }
  return previewFontDataPromise;
}

function htmlFor(record: {
  rendererVersion: number;
  payload: DocumentPreview['payload'];
  paymentProjection: DocumentPreview['paymentProjection'];
}, presentation: 'document' | 'preview' = 'document', fonts?: PreviewFontData) {
  if (record.rendererVersion !== RENDERER_VERSION)
    return unsupportedRendererHtml();
  const payload =
    presentation === 'preview'
      ? {
          ...record.payload,
          businessPhone:
            formatCustomerPhoneDisplay(record.payload.businessPhone) ??
            record.payload.businessPhone,
          customerPhone:
            formatCustomerPhoneDisplay(record.payload.customerPhone) ??
            record.payload.customerPhone,
        }
      : record.payload;
  if (presentation === 'preview') {
    return renderDocumentPreview(
      record.rendererVersion,
      payload,
      record.paymentProjection,
      fonts,
    );
  }
  return renderDocument(record.rendererVersion, payload, record.paymentProjection);
}

const REPORT_PREVIEW_HEIGHT = `
(function () {
  const page = document.querySelector('.page') || document.body;
  const report = () => window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'preview-height', height: Math.ceil(page.getBoundingClientRect().height)
  }));
  new ResizeObserver(report).observe(page);
  if (document.fonts) document.fonts.ready.then(report);
  report();
})();
true;
`;

export type InvoicingJobControlsHandle = { openPreview: () => void };

export const InvoicingJobControls = forwardRef<
  InvoicingJobControlsHandle,
  Props
>(function InvoicingJobControls(
  {
    client,
    jobId,
    workStatus,
    typography,
    mode,
    onEditDetails,
    onManageDocs = onEditDetails,
    beforeOpen,
  }: Props,
  ref,
) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const businessScreenRef = useRef<BusinessSettingsScreenHandle>(null);
  const updatingDocumentRef = useRef<string | null>(null);
  const [updatingDocument, setUpdatingDocument] = useState<string | null>(null);
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewType, setPreviewType] = useState<'estimate' | 'invoice'>(
    defaultDocumentType(workStatus),
  );
  const [saved, setSaved] = useState<FinancialDocumentRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(600);
  const [previewFonts, setPreviewFonts] = useState<PreviewFontData | null>(null);
  const [previewFontsReady, setPreviewFontsReady] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;
    let cancelled = false;
    setPreviewFontsReady(false);
    void loadPreviewFontData()
      .then((fonts) => {
        if (!cancelled) {
          setPreviewFonts(fonts);
          setPreviewFontsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewFonts(null);
          setPreviewFontsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [previewOpen]);

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
    setPreview(null);
    setOffline(false);
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
      setBusy('Loading');
      try {
        setPreview(
          await previewFinancialDocument(client, {
            jobId,
            type,
            timezone: deviceIanaTimeZone(),
          }),
        );
        setPreviewType(type);
        setOffline(false);
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
        Alert.alert(
          'This Job changed. Review the updated preview before sharing.',
        );
        const next = await previewFinancialDocument(client, {
          jobId,
          type: previewType,
          timezone: deviceIanaTimeZone(),
        }).catch(() => null);
        if (next) setPreview(next);
        setRequestKey(null);
      } else if (
        error instanceof FinancialDocumentError &&
        error.code === 'incomplete'
      ) {
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
    async (
      kind:
        'messages' | 'whatsapp' | 'gmail' | 'more' | 'copy' | 'browser' | 'pdf',
    ) => {
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
            Alert.alert(
              'WhatsApp is unavailable. Use More to share this link.',
            );
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
              recipients: active.payload.customerEmail
                ? [active.payload.customerEmail]
                : [],
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

  const updateControls = async (
    doc: FinancialDocumentRecord,
    patch: { archived?: boolean; linkEnabled?: boolean },
  ) => {
    if (updatingDocumentRef.current) return;
    updatingDocumentRef.current = doc.id;
    setUpdatingDocument(doc.id);
    try {
      await setFinancialDocumentControls(client, {
        documentId: doc.id,
        archived: patch.archived ?? doc.archived,
        linkEnabled: patch.linkEnabled ?? doc.linkEnabled,
        expectedRevision: doc.controlRevision,
      });
      await reload();
    } catch {
      Alert.alert('Could not update document settings. Try again.');
    } finally {
      updatingDocumentRef.current = null;
      setUpdatingDocument(null);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      openPreview: () => {
        void openUnsaved();
      },
    }),
    [openUnsaved],
  );

  const visibleDocs =
    mode === 'view' ? documents.filter((doc) => !doc.archived) : documents;

  return (
    <View style={styles.block}>
      <Text
        accessibilityRole="header"
        style={[typography.titleH3, styles.sectionTitle]}
      >
        Docs
      </Text>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator
            style={styles.message}
            accessibilityLabel="Loading documents"
            color={fg.primary}
          />
        ) : null}
        {error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading documents"
            onPress={() => void reload()}
            style={styles.message}
          >
            <Text style={[typography.body, styles.secondary]}>{error}</Text>
            <Text style={[typography.bodyBold, styles.accent]}>Retry</Text>
          </Pressable>
        ) : null}
        {!loading && !error && visibleDocs.length === 0 ? (
          <Pressable
            accessibilityRole={mode === 'view' ? 'button' : undefined}
            accessibilityLabel={mode === 'view' ? 'Edit documents' : undefined}
            disabled={mode !== 'view'}
            onPress={onManageDocs}
            style={({ pressed }) => [styles.message, pressed && styles.pressed]}
          >
            <Text style={[typography.body, styles.emptyLabel]}>
              No documents yet
            </Text>
          </Pressable>
        ) : null}
        {visibleDocs.map((doc, index) => (
          <View key={doc.id} style={[index > 0 && styles.separator]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${mode === 'view' ? 'Edit' : 'Preview'} ${documentNumberLabel(doc.documentType, doc.documentNumber)}`}
              onPress={() => {
                if (mode === 'view') {
                  onManageDocs();
                  return;
                }
                setSaved(doc);
                setPreviewOpen(true);
                setShareOpen(false);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowLabel}>
                <Text style={typography.bodyBold}>
                  {documentNumberLabel(doc.documentType, doc.documentNumber)}
                </Text>
                <Text style={[typography.bodySmall, styles.secondary]}>
                  {doc.issueDate}
                  {doc.archived ? ' · Archived' : ''}
                </Text>
              </View>
              <ProfileChevronRightIcon color={fg.secondary} />
            </Pressable>
            {updatingDocument === doc.id ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[typography.bodySmall, styles.loadingLabel]}
              >
                Saving document settings…
              </Text>
            ) : null}
            {mode === 'edit' ? (
              <ProfileRowsCard
                typography={typography}
                framed={false}
                rows={[
                  {
                    kind: 'toggle',
                    label: 'Archived',
                    value: doc.archived,
                    disabled: updatingDocument != null,
                    onValueChange: (archived) => {
                      void updateControls(doc, { archived });
                    },
                  },
                  {
                    kind: 'toggle',
                    label: 'Shared link',
                    sublabel:
                      'Anyone with an enabled link can view this document.',
                    value: doc.linkEnabled,
                    disabled: updatingDocument != null,
                    onValueChange: (linkEnabled) => {
                      void updateControls(doc, { linkEnabled });
                    },
                  },
                ]}
              />
            ) : null}
          </View>
        ))}
        {mode === 'edit' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Generate new document"
            onPress={() => void openUnsaved()}
            style={({ pressed }) => [
              styles.row,
              styles.separator,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[typography.bodyBold, styles.rowLabel, styles.accent]}>
              Generate new
            </Text>
            <ProfileChevronRightIcon color={fg.secondary} />
          </Pressable>
        ) : null}
      </View>
      {offline ? (
        <Text style={[typography.bodySmall, styles.secondary]}>
          Offline — payment status may be out of date.
        </Text>
      ) : null}

      <Modal
        visible={previewOpen}
        animationType="slide"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View
          style={[
            styles.preview,
            {
              paddingTop: insets.top,
            },
          ]}
        >
          <ScrollView
            testID="document-preview-scroll"
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
          >
            <View style={[columnStyle, styles.previewBar]}>
              <PlatformHeaderAction
                accessibilityLabel="Back"
                onPress={() => setPreviewOpen(false)}
              >
                <TopHeaderBackIcon size={28} color={fg.primary} />
              </PlatformHeaderAction>
              {!saved ? (
                <SegmentedControl
                  accessibilityLabel="Document type"
                  value={previewType}
                  options={[
                    { value: 'estimate', label: 'Estimate' },
                    { value: 'invoice', label: 'Invoice' },
                  ]}
                  onValueChange={(type) => void switchType(type)}
                  labelStyle={typography.statusPillLabel}
                  disabled={!!busy}
                  fill={false}
                  style={styles.previewSelector}
                />
              ) : (
                <Text style={typography.body}>
                  {documentNumberLabel(saved.documentType, saved.documentNumber)}
                </Text>
              )}
            </View>
            {busy ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[typography.bodySmall, styles.loadingLabel]}
              >
                {busy}
              </Text>
            ) : null}
            {preview && !saved && preview.gaps.length > 0 ? (
              <View style={[columnStyle, styles.gapWrap]}>
                <View style={styles.gapCard}>
                  <Text style={typography.bodyBold}>
                    Complete these details before sharing:
                  </Text>
                  {gapLabels(preview.gaps).map((label) => (
                    <Text key={label} style={typography.body}>
                      {label}
                    </Text>
                  ))}
                  {preview.gaps.includes('business_name') ? (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.textAction}
                      onPress={() => setBusinessOpen(true)}
                    >
                      <Text style={[typography.bodyBold, styles.accent]}>
                        Edit business info
                      </Text>
                    </Pressable>
                  ) : null}
                  {preview.gaps.some((gap) => gap !== 'business_name') ? (
                    <Pressable
                      accessibilityRole="button"
                      style={styles.textAction}
                      onPress={() => {
                        setPreviewOpen(false);
                        onEditDetails();
                      }}
                    >
                      <Text style={[typography.bodyBold, styles.accent]}>
                        Edit Job details
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={styles.paperWrap}>
              <View style={styles.paper}>
                {previewFontsReady ? (
                  <WebView
                    testID="document-preview-html"
                    originWhitelist={['*']}
                    source={{
                      html: saved
                        ? htmlFor(saved, 'preview', previewFonts ?? undefined)
                        : preview
                          ? htmlFor(
                              {
                                ...preview,
                                paymentProjection: preview.paymentProjection,
                              },
                              'preview',
                              previewFonts ?? undefined,
                            )
                          : '<html><body></body></html>',
                    }}
                    scrollEnabled={false}
                    containerStyle={{ flex: 0, height: previewHeight }}
                    injectedJavaScript={REPORT_PREVIEW_HEIGHT}
                    onMessage={(event) => {
                      try {
                        const message = JSON.parse(event.nativeEvent.data);
                        if (message.type === 'preview-height' &&
                            Number.isFinite(message.height) && message.height > 0) {
                          setPreviewHeight((height) =>
                            Math.abs(height - message.height) > 1 ? message.height : height);
                        }
                      } catch {
                        // Ignore messages unrelated to document sizing.
                      }
                    }}
                    style={[styles.web, { height: previewHeight }]}
                  />
                ) : (
                  <ActivityIndicator size="small" color={fg.primary} />
                )}
              </View>
            </View>
          </ScrollView>
          {!saved && preview && preview.gaps.length === 0 ? (
            <View pointerEvents="box-none" style={styles.fabOverlay}>
              <FullWidthFab
                typography={typography}
                label={
                  busy === 'Creating…'
                    ? 'CREATING…'
                    : previewType === 'estimate'
                      ? 'CREATE & SHARE ESTIMATE'
                      : 'CREATE & SHARE INVOICE'
                }
                onPress={() => void createAndShare()}
                disabled={!!busy}
                includeSafeArea
              />
            </View>
          ) : null}
          {saved ? (
            <View pointerEvents="box-none" style={styles.fabOverlay}>
              <FullWidthFab
                typography={typography}
                label={
                  saved.documentType === 'estimate'
                    ? 'SHARE ESTIMATE'
                    : 'SHARE INVOICE'
                }
                onPress={() => setShareOpen(true)}
                includeSafeArea
              />
            </View>
          ) : null}
          <Modal
            visible={businessOpen}
            animationType="slide"
            onRequestClose={() => businessScreenRef.current?.requestBack()}
          >
            <BusinessSettingsScreen
              ref={businessScreenRef}
              typography={typography}
              mode="business"
              onBack={() => {
                setBusinessOpen(false);
                void switchType(previewType);
              }}
            />
          </Modal>

          <Modal
            visible={shareOpen}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={() => setShareOpen(false)}
          >
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheetShell
                autoSizeUpToFraction={0.9}
                visible={shareOpen}
                onClose={() => setShareOpen(false)}
                accessibilityTitle="Share document"
              >
                <View style={styles.sheet}>
                  <View style={styles.shareHeading}>
                    <PlatformHeaderAction
                      accessibilityLabel="Back to preview"
                      onPress={() => setShareOpen(false)}
                    >
                      <TopHeaderBackIcon size={24} color={fg.primary} />
                    </PlatformHeaderAction>
                    <Text style={[typography.titleH3, styles.rowLabel]}>
                      {active?.documentType === 'estimate'
                        ? 'Share Estimate'
                        : 'Share Invoice'}
                    </Text>
                  </View>
                  {active ? (
                    <Text style={[typography.bodySmall, styles.secondary]}>
                      {documentNumberLabel(
                        active.documentType,
                        active.documentNumber,
                      )}
                    </Text>
                  ) : null}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.destinations}
                  >
                    {(['messages', 'whatsapp', 'gmail', 'more'] as const).map(
                      (kind) => (
                        <Pressable
                          key={kind}
                          accessibilityRole="button"
                          onPress={() => void handoff(kind)}
                          style={({ pressed }) => [
                            styles.destination,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={typography.bodyBold}>
                            {kind === 'messages'
                              ? 'Messages'
                              : kind === 'whatsapp'
                                ? 'WhatsApp'
                                : kind === 'gmail'
                                  ? 'Gmail'
                                  : 'More'}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </ScrollView>
                  <ProfileRowsCard
                    typography={typography}
                    rows={[
                      {
                        kind: 'link',
                        label: 'Copy link',
                        onPress: () => {
                          void handoff('copy');
                        },
                      },
                      {
                        kind: 'link',
                        label: 'Open in browser',
                        onPress: () => {
                          void handoff('browser');
                        },
                      },
                      {
                        kind: 'link',
                        label:
                          busy === 'Creating PDF…'
                            ? 'Creating PDF…'
                            : 'Download PDF',
                        onPress: busy
                          ? undefined
                          : () => {
                              void handoff('pdf');
                            },
                      },
                    ]}
                  />
                </View>
              </BottomSheetShell>
            </GestureHandlerRootView>
          </Modal>
        </View>
      </Modal>
    </View>
  );
});

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
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const styles = StyleSheet.create({
  block: { width: '100%', marginTop: space('Spacing/12') },
  sectionTitle: {
    paddingTop: space('Spacing/16'),
    paddingBottom: space('Spacing/12'),
  },
  card: {
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
    ...cardShadowRn,
  },
  message: { padding: space('Spacing/20'), gap: space('Spacing/8') },
  emptyLabel: { color: fg.secondary, textAlign: 'center' },
  row: {
    padding: space('Spacing/16'),
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
  rowLabel: { flex: 1, minWidth: 0, gap: space('Spacing/4') },
  separator: { borderTopWidth: 1, borderTopColor: border.subtle },
  secondary: { color: fg.secondary },
  accent: { color: color('Brand/Primary') },
  pressed: { opacity: 0.75 },
  preview: {
    flex: 1,
    backgroundColor: bg.canvasWarm,
  },
  previewScroll: { flex: 1, width: '100%' },
  previewContent: { paddingTop: space('Spacing/12'), gap: space('Spacing/12') },
  previewBar: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: space('Spacing/8'),
  },
  previewSelector: { width: 320, maxWidth: '100%', alignSelf: 'center' },
  loadingLabel: { color: fg.secondary, textAlign: 'center' },
  gapWrap: { flexShrink: 1 },
  gapCard: {
    padding: space('Spacing/16'),
    backgroundColor: bg.surfaceWhite,
    borderRadius: radius('Radius/16'),
    borderWidth: 1,
    borderColor: border.subtle,
    gap: space('Spacing/4'),
  },
  textAction: { minHeight: 44, justifyContent: 'center' },
  paperWrap: { width: '100%' },
  paper: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  fabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    elevation: 2,
  },
  web: { width: '100%', backgroundColor: bg.surfaceWhite },
  sheet: { padding: space('Spacing/20'), gap: space('Spacing/12') },
  destinations: { gap: space('Spacing/8') },
  destination: {
    minHeight: 52,
    padding: space('Spacing/12'),
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: radius('Radius/12'),
    backgroundColor: bg.surfaceWhite,
    justifyContent: 'center',
  },
  shareHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
  },
});
