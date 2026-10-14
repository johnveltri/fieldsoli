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
  Animated,
  Easing,
  useWindowDimensions,
  Alert,
  Linking,
  Modal,
  Pressable,
  Platform,
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
import * as SMS from 'expo-sms';
import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import {
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconShare3,
  IconMail,
  IconMessageCircle,
} from '@tabler/icons-react-native';
import { PTSerif_700Bold } from '@expo-google-fonts/pt-serif';
import {
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
} from '@expo-google-fonts/ubuntu';
import {
  createFinancialDocument,
  createAndSelectFinancialDocument,
  finalizeJobWithInvoice,
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
import { EditAddRow, EditConfirmNoneRow, EditIconRow } from '../ds/edit-mode/EditFormRows';
import { EditSwipeableRow } from '../ds/edit-mode/EditSwipeableRow';

import {
  defaultDocumentType,
  documentLinkText,
  documentNumberLabel,
  gapLabels,
  gmailSubject,
  mailtoUrl,
  pdfFileName,
} from '../../lib/documentShare';
import { announceAccessibilityMessage } from '../../lib/accessibility';
import { formatUsdCombined } from '../../lib/formatUsd';
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
import { JobDetailIconTopClose } from '../figma-icons/JobDetailScreenIcons';
import { usePlatformGlass } from '../platform/usePlatformGlass';
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
  active?: boolean;
  onEditDetails: () => void;
  onManageDocs?: () => void;
  /** Saves uncommitted Job edits before opening a preview. Return false to cancel. */
  beforeOpen?: () => Promise<boolean>;
  onFinalized?: (status: 'completed' | 'paid') => void;
  onFinalizationClosed?: () => void;
  onRevenueInvoiceChanged?: () => void;
};

type QueuedHandoff =
  | { kind: 'text' | 'email' | 'share' | 'browser' }
  | { kind: 'pdf'; uri: string };

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
}, presentation: 'document' | 'preview' | 'pdf' = 'document', fonts?: PreviewFontData) {
  if (record.rendererVersion !== RENDERER_VERSION)
    return unsupportedRendererHtml();
  const payload = {
    ...record.payload,
    businessPhone:
      formatCustomerPhoneDisplay(record.payload.businessPhone) ??
      record.payload.businessPhone,
    customerPhone:
      formatCustomerPhoneDisplay(record.payload.customerPhone) ??
      record.payload.customerPhone,
  };
  if (presentation === 'preview') {
    return renderDocumentPreview(
      record.rendererVersion,
      payload,
      record.paymentProjection,
      fonts,
    );
  }
  return renderDocument(
    record.rendererVersion,
    payload,
    record.paymentProjection,
    fonts,
    presentation,
  );
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

export type InvoicingJobControlsHandle = {
  openPreview: () => void;
  openDocument: (documentId: string) => void;
  openFinalization: (status: 'completed' | 'paid') => void;
  getPendingPreferences: () => {
    revenueDocumentId: string | null;
    expectedRevenueDocumentId: string | null;
    confirmedPaidTotalCents?: number | null;
    controls: Array<{ documentId: string; archived: boolean; linkEnabled: boolean; expectedRevision: number }>;
    currentTotalCents: number | null;
  } | null;
  discardPendingControls: () => void;
};

type FinalizationReview = {
  status: 'completed' | 'paid';
  selected: FinancialDocumentRecord | null;
  preview: DocumentPreview | null;
};

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
    active: isActive = true,
    onEditDetails,
    onManageDocs = onEditDetails,
    beforeOpen,
    onFinalized,
    onFinalizationClosed,
    onRevenueInvoiceChanged,
  }: Props,
  ref,
) {
  const insets = useSafeAreaInsets();
  const { columnStyle } = useContentColumn();
  const businessScreenRef = useRef<BusinessSettingsScreenHandle>(null);
  const previewRequestRef = useRef(0);
  const archivingRef = useRef(false);
  const [documents, setDocuments] = useState<FinancialDocumentRecord[]>([]);
  const [pendingControls, setPendingControls] = useState<Record<string, { archived: boolean; linkEnabled: boolean }>>({});
  const [revenueDocumentDraft, setRevenueDocumentDraft] = useState<string | null>(null);
  const [finalization, setFinalization] = useState<FinalizationReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [previewType, setPreviewType] = useState<'estimate' | 'invoice'>(
    defaultDocumentType(workStatus),
  );
  const [saved, setSaved] = useState<FinancialDocumentRecord | null>(null);
  const [previewOpen, setPreviewOpenState] = useState(false);
  const { height: previewWindowHeight } = useWindowDimensions();
  const previewTranslateY = useRef(new Animated.Value(previewWindowHeight)).current;
  useEffect(() => () => previewTranslateY.stopAnimation(), [previewTranslateY]);
  const { reduceMotion } = usePlatformGlass();
  const animatePreviewIn = useCallback(() => {
    Animated.timing(previewTranslateY, {
      toValue: 0,
      duration: reduceMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [previewTranslateY, reduceMotion]);
  const setPreviewOpen = useCallback((open: boolean, afterClose?: () => void) => {
    previewTranslateY.stopAnimation();
    if (open) {
      previewTranslateY.setValue(previewWindowHeight);
      setPreviewOpenState(true);
      return;
    }
    Animated.timing(previewTranslateY, {
      toValue: previewWindowHeight,
      duration: reduceMotion ? 0 : 210,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPreviewOpenState(false);
        afterClose?.();
      }
    });
  }, [previewTranslateY, previewWindowHeight, reduceMotion]);
  const [previewHeight, setPreviewHeight] = useState(600);
  const [previewFonts, setPreviewFonts] = useState<PreviewFontData | null>(null);
  const [previewFontsReady, setPreviewFontsReady] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const businessReturnRef = useRef<
    | { kind: 'preview' }
    | { kind: 'finalization'; status: 'completed' | 'paid' }
    | null
  >(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareModalMounted, setShareModalMounted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const queuedHandoffRef = useRef<QueuedHandoff | null>(null);
  const handoffRunningRef = useRef(false);
  const copySuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openShareSheet = useCallback(() => {
    setShareModalMounted(true);
    setShareOpen(true);
  }, []);

  const closeShareSheet = useCallback(() => {
    if (busy) return;
    setShareOpen(false);
  }, [busy]);

  useEffect(
    () => () => {
      if (copySuccessTimeoutRef.current) clearTimeout(copySuccessTimeoutRef.current);
    },
    [],
  );

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
      const nextDocuments = await listFinancialDocuments(client, jobId);
      setDocuments(nextDocuments);
      setRevenueDocumentDraft(nextDocuments.find((doc) => doc.isRevenueSource)?.id ?? null);
      setOffline(false);
    } catch {
      setError('Could not load this document.');
    } finally {
      setLoading(false);
    }
  }, [client, jobId]);

  useEffect(() => {
    if (isActive) void reload();
  }, [isActive, reload]);

  const openUnsaved = useCallback(async () => {
    if (beforeOpen) {
      const ok = await beforeOpen().catch(() => false);
      if (!ok) return;
    }
    setPreviewOpen(true);
    setSaved(null);
    setPreview(null);
    setOffline(false);
    const request = ++previewRequestRef.current;
    setBusy('Loading');
    setPreviewType(defaultDocumentType(workStatus));
    try {
      const next = await previewFinancialDocument(client, {
        jobId,
        type: defaultDocumentType(workStatus),
        timezone: deviceIanaTimeZone(),
      });
      if (request === previewRequestRef.current) {
        setPreview(next);
        setOffline(false);
      }
    } catch {
      if (request === previewRequestRef.current) {
        setOffline(true);
        Alert.alert('Could not load this document.', 'Retry');
      }
    } finally {
      if (request === previewRequestRef.current) setBusy(null);
    }
  }, [beforeOpen, client, jobId, workStatus, setPreviewOpen]);

  const switchType = useCallback(
    async (type: 'estimate' | 'invoice') => {
      if (saved) return;
      const request = ++previewRequestRef.current;
      setPreviewType(type);
      setBusy(null);
      try {
        const next = await previewFinancialDocument(client, {
          jobId,
          type,
          timezone: deviceIanaTimeZone(),
        });
        if (request === previewRequestRef.current) {
          setPreview(next);
          setOffline(false);
        }
      } catch {
        if (request === previewRequestRef.current) {
          setPreviewType(preview?.payload.documentType ?? defaultDocumentType(workStatus));
          Alert.alert('Could not load this document.', 'Retry');
        }
      }
    },
    [client, jobId, preview, saved, workStatus],
  );

  const createAndShare = useCallback(async () => {
    if (!preview || preview.gaps.length > 0) return;
    const key = requestKey ?? newRequestKey();
    setRequestKey(key);
    setBusy('Creating…');
    try {
      let confirmedPaidTotalCents: number | null = null;
      if (previewType === 'invoice' && workStatus === 'paid') {
        confirmedPaidTotalCents = await new Promise<number | null>((resolve) => {
          Alert.alert('Confirm payment', `Confirm ${formatUsdCombined(preview.payload.totalCents)} paid?`, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            { text: 'Confirm', onPress: () => resolve(preview.payload.totalCents) },
          ]);
        });
        if (confirmedPaidTotalCents == null) return;
      }
      const created = previewType === 'invoice'
        ? await createAndSelectFinancialDocument(client, {
            jobId,
            fingerprint: preview.fingerprint,
            timezone: deviceIanaTimeZone(),
            requestKey: key,
            confirmedPaidTotalCents,
          })
        : await createFinancialDocument(client, {
            jobId,
            type: previewType,
            fingerprint: preview.fingerprint,
            timezone: deviceIanaTimeZone(),
            requestKey: key,
          });
      setSaved(created);
      setRequestKey(null);
      if (previewType === 'invoice') onRevenueInvoiceChanged?.();
      openShareSheet();
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
  }, [client, jobId, onRevenueInvoiceChanged, openShareSheet, preview, previewType, reload, requestKey, workStatus]);

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

  const offerNativeShareFallback = useCallback((message: string) => {
    Alert.alert(message, undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => setPreviewOpen(true) },
      {
        text: 'Share link…',
        onPress: () => {
          void Share.share({ message: linkText, title: active ? documentNumberLabel(active.documentType, active.documentNumber) : undefined })
            .catch(() => Alert.alert('Could not share this link. Try again.'))
            .finally(() => setPreviewOpen(true));
        },
      },
    ]);
  }, [active, linkText, setPreviewOpen]);

  const performQueuedHandoff = useCallback(async () => {
    const action = queuedHandoffRef.current;
    if (!active || !action || handoffRunningRef.current) return;
    queuedHandoffRef.current = null;
    handoffRunningRef.current = true;
    let fallbackAlertOpen = false;
    let handoffFailed = false;
    try {
      if (action.kind === 'text') {
        if (!(await SMS.isAvailableAsync())) {
          fallbackAlertOpen = true;
          offerNativeShareFallback('Messages is unavailable on this device.');
          return;
        }
        await SMS.sendSMSAsync(active.payload.customerPhone ?? '', linkText);
      } else if (action.kind === 'email') {
        const subject = gmailSubject({
          type: active.documentType,
          number: active.documentNumber,
          businessName: active.payload.businessName,
        });
        try {
          await Linking.openURL(mailtoUrl({
            email: active.payload.customerEmail,
            subject,
            body: linkText,
          }));
        } catch {
          if (await MailComposer.isAvailableAsync()) {
            await MailComposer.composeAsync({
              subject,
              body: linkText,
              recipients: active.payload.customerEmail
                ? [active.payload.customerEmail]
                : [],
            });
          } else {
            fallbackAlertOpen = true;
            offerNativeShareFallback('Email is unavailable on this device.');
            return;
          }
        }
      } else if (action.kind === 'share') {
        await Share.share({
          message: linkText,
          title: documentNumberLabel(active.documentType, active.documentNumber),
        });
      } else if (action.kind === 'browser') {
        await Linking.openURL(link);
      } else if (action.kind === 'pdf') {
        await Sharing.shareAsync(action.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: action.uri.split('/').at(-1),
        });
      }
    } catch {
      handoffFailed = true;
      const message = action.kind === 'browser'
        ? 'Could not open this document. Try again.'
        : action.kind === 'pdf'
          ? 'Could not share the PDF. Try again.'
          : 'Could not open the share option. Try again.';
      Alert.alert(message, undefined, [
        { text: 'Close', style: 'cancel', onPress: () => setPreviewOpen(true) },
        { text: 'Try again', onPress: openShareSheet },
      ]);
    } finally {
      handoffRunningRef.current = false;
      setBusy(null);
      if (!fallbackAlertOpen && !handoffFailed) setPreviewOpen(true);
    }
  }, [active, link, linkText, offerNativeShareFallback, openShareSheet, setPreviewOpen]);

  const closePreviewForHandoff = useCallback(() => {
    if (!queuedHandoffRef.current) return;
    setPreviewOpen(false, () => {
      if (Platform.OS !== 'ios') {
        requestAnimationFrame(() => requestAnimationFrame(() => void performQueuedHandoff()));
      }
    });
  }, [performQueuedHandoff, setPreviewOpen]);

  const onShareSheetClosed = useCallback(() => {
    setShareModalMounted(false);
    if (Platform.OS !== 'ios' && queuedHandoffRef.current) {
      requestAnimationFrame(() => requestAnimationFrame(closePreviewForHandoff));
    }
  }, [closePreviewForHandoff]);

  const requestHandoff = useCallback(async (
    kind: 'text' | 'email' | 'share' | 'browser' | 'pdf',
  ) => {
    if (!active || handoffRunningRef.current || queuedHandoffRef.current) return;
    if (!active.linkEnabled && kind !== 'pdf') {
      Alert.alert('Enable the shared link in Documents to share this document.');
      return;
    }
    handoffRunningRef.current = true;
    if (kind === 'pdf') {
      setBusy('Creating PDF…');
      try {
        if (!(await Sharing.isAvailableAsync())) {
          handoffRunningRef.current = false;
          setBusy(null);
          Alert.alert('PDF sharing is unavailable on this device.');
          return;
        }
        const generated = await Print.printToFileAsync({
          html: htmlFor(active, 'pdf', await loadPreviewFontData()),
          margins: { top: 36, right: 36, bottom: 36, left: 36 },
        });
        const filename = pdfFileName(
          active.documentType,
          active.documentNumber,
          active.payload.businessName,
        );
        const namedFile = new File(Paths.cache, filename);
        await new File(generated.uri).copy(namedFile, { overwrite: true });
        queuedHandoffRef.current = { kind: 'pdf', uri: namedFile.uri };
        setBusy(null);
        handoffRunningRef.current = false;
        closeShareSheet();
      } catch {
        handoffRunningRef.current = false;
        setBusy(null);
        Alert.alert('Could not create the PDF. Try again.');
      }
      return;
    }
    queuedHandoffRef.current = { kind };
    handoffRunningRef.current = false;
    closeShareSheet();
  }, [active, closeShareSheet]);

  const copyLink = useCallback(async () => {
    if (!active) return;
    if (!active.linkEnabled) {
      Alert.alert('Enable the shared link in Documents to share this document.');
      return;
    }
    try {
      await Clipboard.setStringAsync(link);
      setCopySuccess(true);
      announceAccessibilityMessage('Link copied');
      if (copySuccessTimeoutRef.current) clearTimeout(copySuccessTimeoutRef.current);
      copySuccessTimeoutRef.current = setTimeout(() => setCopySuccess(false), 1800);
    } catch {
      Alert.alert('Could not copy the link. Try again.');
    }
  }, [active, link]);

  const archiveDocument = async (doc: FinancialDocumentRecord) => {
    if (archivingRef.current) return;
    archivingRef.current = true;
    try {
      const updated = await setFinancialDocumentControls(client, {
        documentId: doc.id,
        archived: true,
        linkEnabled: false,
        expectedRevision: doc.controlRevision,
      });
      setDocuments((current) => current.map((item) => item.id === doc.id ? updated : item));
    } catch {
      Alert.alert('Could not archive this document. Try again.');
      void reload();
    } finally {
      archivingRef.current = false;
    }
  };

  const openDocument = useCallback((documentId: string) => {
    const doc = documents.find((item) => item.id === documentId);
    if (!doc) {
      void reload();
      Alert.alert('Could not load this invoice. Try again.');
      return;
    }
    previewRequestRef.current += 1;
    setSaved(doc);
    setPreview(null);
    setPreviewOpen(true);
  }, [documents, reload, setPreviewOpen]);

  const openFinalization = useCallback(async (status: 'completed' | 'paid') => {
    setBusy('Reviewing…');
    try {
      const nextDocuments = await listFinancialDocuments(client, jobId);
      setDocuments(nextDocuments);
      const selected = nextDocuments.find((doc) => doc.isRevenueSource) ?? null;
      const nextPreview = selected ? null : await previewFinancialDocument(client, {
        jobId,
        type: 'invoice',
        timezone: deviceIanaTimeZone(),
      });
      setRevenueDocumentDraft(selected?.id ?? null);
      setFinalization({ status, selected, preview: nextPreview });
      previewRequestRef.current += 1;
      setSaved(selected);
      setPreview(nextPreview);
      setPreviewType('invoice');
      setShareOpen(false);
      setPreviewOpen(true);
    } catch {
      Alert.alert('Could not review this invoice. Try again.');
      onFinalizationClosed?.();
    } finally {
      setBusy(null);
    }
  }, [client, jobId, onFinalizationClosed, setPreviewOpen]);

  const openBusinessSettings = useCallback((returnTo: NonNullable<typeof businessReturnRef.current>) => {
    businessReturnRef.current = returnTo;
    setBusinessOpen(true);
  }, []);

  const closeBusinessSettings = useCallback(() => {
    setBusinessOpen(false);
    const returnTo = businessReturnRef.current;
    businessReturnRef.current = null;
    if (returnTo?.kind === 'finalization') {
      void openFinalization(returnTo.status);
    } else if (returnTo?.kind === 'preview') {
      void switchType(previewType);
    }
  }, [openFinalization, previewType, switchType]);

  const confirmFinalization = useCallback(async () => {
    if (!finalization) return;
    const totalCents = finalization.selected?.payload.totalCents ?? finalization.preview?.payload.totalCents;
    if (totalCents == null || (!finalization.selected && (finalization.preview?.gaps.length ?? 0) > 0)) return;
    const key = requestKey ?? newRequestKey();
    setRequestKey(key);
    setBusy('Saving…');
    try {
      await finalizeJobWithInvoice(client, {
        jobId,
        status: finalization.status,
        documentId: finalization.selected?.id ?? null,
        fingerprint: finalization.selected ? null : finalization.preview?.fingerprint,
        timezone: deviceIanaTimeZone(),
        requestKey: key,
        confirmedPaidTotalCents: finalization.status === 'paid' ? totalCents : null,
      });
      setRequestKey(null);
      setPreviewOpen(false);
      setFinalization(null);
      await reload();
      onFinalized?.(finalization.status);
    } catch (error) {
      if (error instanceof FinancialDocumentError && error.code === 'stale') {
        Alert.alert('This Job changed. Review the updated invoice before continuing.');
        void openFinalization(finalization.status);
      } else if (error instanceof FinancialDocumentError && error.code === 'incomplete') {
        Alert.alert('Complete the invoice details before finishing this Job.');
      } else if (error instanceof FinancialDocumentError && error.code === 'confirmation_required') {
        Alert.alert('The invoice total changed. Review it and confirm the current amount.');
        void openFinalization(finalization.status);
      } else {
        Alert.alert('Could not finish this Job. Try again.');
      }
    } finally {
      setBusy(null);
    }
  }, [client, finalization, jobId, onFinalized, openFinalization, reload, requestKey, setPreviewOpen]);

  const closeInvoicePreview = () => {
    if (busy) return;
    setPreviewOpen(false);
    if (finalization) {
      setFinalization(null);
      onFinalizationClosed?.();
    }
  };

  const getPendingPreferences = useCallback(() => {
    const initialRevenueId = documents.find((doc) => doc.isRevenueSource)?.id ?? null;
    const controls = Object.entries(pendingControls).flatMap(([documentId, next]) => {
      const original = documents.find((doc) => doc.id === documentId);
      return original ? [{ documentId, ...next, expectedRevision: original.controlRevision }] : [];
    });
    if (initialRevenueId === revenueDocumentDraft && controls.length === 0) return null;
    const selected = documents.find((doc) => doc.id === revenueDocumentDraft) ?? null;
    const current = documents.find((doc) => doc.id === initialRevenueId) ?? null;
    return {
      revenueDocumentId: revenueDocumentDraft,
      expectedRevenueDocumentId: initialRevenueId,
      controls,
      currentTotalCents: current?.payload.totalCents ?? null,
      ...(selected ? { confirmedPaidTotalCents: selected.payload.totalCents } : {}),
    };
  }, [documents, pendingControls, revenueDocumentDraft]);

  useImperativeHandle(
    ref,
    () => ({
      openPreview: () => {
        void openUnsaved();
      },
      openDocument,
      openFinalization: (status) => { void openFinalization(status); },
      getPendingPreferences,
      discardPendingControls: () => {
        setPendingControls({});
        setRevenueDocumentDraft(documents.find((doc) => doc.isRevenueSource)?.id ?? null);
      },
    }),
    [documents, getPendingPreferences, openDocument, openFinalization, openUnsaved],
  );

  const editedDocuments = documents.map((doc) => ({ ...doc, ...pendingControls[doc.id] }));
  const visibleDocs =
    mode === 'view' ? editedDocuments.filter((doc) => !doc.archived) : editedDocuments;
  const createDocumentLabel = defaultDocumentType(workStatus) === 'invoice'
    ? 'Create Invoice'
    : 'Create Estimate';

  return (
    <View style={styles.block}>
      {mode === 'view' ? (
        <Text
          accessibilityRole="header"
          style={[typography.titleH3, styles.sectionTitle]}
        >
          Documents
        </Text>
      ) : null}
      <View style={[styles.card, mode === 'edit' && styles.editCard]}>
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
        {!loading && !error && visibleDocs.length === 0 && mode === 'view' ? (
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
            {mode === 'view' ? (
              <EditSwipeableRow
                typography={typography}
                accessibilityLabel={documentNumberLabel(doc.documentType, doc.documentNumber)}
                actionLabel="Archive"
                onDelete={() => void archiveDocument(doc)}
              >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Preview ${documentNumberLabel(doc.documentType, doc.documentNumber)}, ${doc.issueDate}, ${formatUsdCombined(doc.payload.totalCents)}`}
                onPress={() => {
                  previewRequestRef.current += 1;
                  setSaved(doc);
                  setPreviewOpen(true);
                  setShareOpen(false);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowLabel}>
                  <Text style={[typography.body, styles.secondary]}>
                    {documentNumberLabel(doc.documentType, doc.documentNumber)}
                  </Text>
                  <Text style={[typography.bodySmall, styles.secondary]}>{doc.issueDate}</Text>
                </View>
                <Text style={[typography.metric, { textTransform: 'none' }]}>
                  {formatUsdCombined(doc.payload.totalCents)}
                </Text>
              </Pressable>
              </EditSwipeableRow>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={doc.archived ? 'Un-Archive to Preview' : 'Preview and Share'}
                accessibilityState={{ disabled: doc.archived }}
                disabled={doc.archived}
                onPress={() => {
                  previewRequestRef.current += 1;
                  setSaved(doc);
                  setPreviewOpen(true);
                  setShareOpen(false);
                }}
                style={({ pressed }) => [
                  styles.documentPreviewRow,
                  pressed && !doc.archived && styles.pressed,
                ]}
              >
                <IconShare3
                  color={doc.archived ? fg.secondary : color('Brand/Primary')}
                  size={24}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    doc.archived ? typography.labelHeadingSecondary : typography.labelCaps,
                    !doc.archived && styles.accent,
                  ]}
                >
                  {doc.archived ? 'UNARCHIVE TO PREVIEW' : 'PREVIEW & SHARE'}
                </Text>
              </Pressable>
            )}
            {mode === 'edit' ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${documentNumberLabel(doc.documentType, doc.documentNumber)}, ${doc.issueDate}`}
                  onPress={() => openDocument(doc.id)}
                  style={({ pressed }) => [
                    styles.documentDetailsRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[typography.body, { color: fg.secondary }]}>
                    {`${documentNumberLabel(doc.documentType, doc.documentNumber)} (${doc.issueDate})`}
                  </Text>
                </Pressable>
                <EditConfirmNoneRow
                  typography={typography}
                  confirmed={doc.archived || !doc.linkEnabled}
                  confirmLabel="Archive & Disable Link"
                  confirmedLabel="Archive & Disable Link"
                  showTopBorder={false}
                  onToggle={() => {
                    const disabledOrArchived = doc.archived || !doc.linkEnabled;
                    const controls = {
                      archived: !disabledOrArchived,
                      linkEnabled: disabledOrArchived,
                    };
                    setPendingControls((current) => {
                      const original = documents.find((item) => item.id === doc.id);
                      if (original?.archived === controls.archived && original.linkEnabled === controls.linkEnabled) {
                        const next = { ...current };
                        delete next[doc.id];
                        return next;
                      }
                      return { ...current, [doc.id]: controls };
                    });
                  }}
                />
                {doc.documentType === 'invoice' ? (
                  <EditConfirmNoneRow
                    typography={typography}
                    confirmed={revenueDocumentDraft === doc.id}
                    confirmLabel="Use for Job Revenue"
                    confirmedLabel="Use for Job Revenue"
                    showTopBorder={false}
                    onToggle={() => {
                      if (revenueDocumentDraft !== doc.id) setRevenueDocumentDraft(doc.id);
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ))}
        {mode === 'edit' && !loading && !error ? (
          <EditAddRow
            typography={typography}
            icon={<IconShare3 color={fg.secondary} size={24} strokeWidth={2} />}
            label={createDocumentLabel}
            onPress={() => void openUnsaved()}
            showTopBorder={visibleDocs.length > 0}
          />
        ) : null}
      </View>
      {offline ? (
        <Text style={[typography.bodySmall, styles.secondary]}>
          Offline — payment status may be out of date.
        </Text>
      ) : null}

      <Modal
        visible={previewOpen}
        transparent
        animationType="none"
        onShow={animatePreviewIn}
        onDismiss={() => {
          if (Platform.OS === 'ios') void performQueuedHandoff();
        }}
        onRequestClose={closeInvoicePreview}
      >
        <Animated.View
          style={[
            styles.preview,
            {
              paddingTop: Math.max(insets.top - space('Spacing/8'), 0) + space('Spacing/4'),
              transform: [{ translateY: previewTranslateY }],
            },
          ]}
        >
          <View style={[columnStyle, styles.previewCloseHeader]}>
            <PlatformHeaderAction
              accessibilityLabel="Close preview"
              onPress={closeInvoicePreview}
              useFloatingChrome={false}
              style={styles.previewCloseButton}
            >
              <JobDetailIconTopClose color={fg.primary} />
            </PlatformHeaderAction>
          </View>
          <ScrollView
            testID="document-preview-scroll"
            style={styles.previewScroll}
            contentContainerStyle={styles.previewContent}
          >
            {!saved && !finalization ? (
              <View style={[columnStyle, styles.previewBar]}>
                <SegmentedControl
                  accessibilityLabel="Document type"
                  value={previewType}
                  options={[
                    { value: 'estimate', label: 'Estimate' },
                    { value: 'invoice', label: 'Invoice' },
                  ]}
                  onValueChange={(type) => void switchType(type)}
                  labelStyle={typography.statusPillLabel}
                  disabled={busy != null && busy !== 'Loading'}
                  fill={false}
                  style={styles.previewSelector}
                />
              </View>
            ) : null}
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
                    {finalization ? 'Complete these details before finishing:' : 'Complete these details before sharing:'}
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
                      onPress={() => openBusinessSettings(finalization
                        ? { kind: 'finalization', status: finalization.status }
                        : { kind: 'preview' })}
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
                        closeInvoicePreview();
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
          {!finalization && !saved && preview && preview.gaps.length === 0 ? (
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
          {!finalization && saved ? (
            <View pointerEvents="box-none" style={styles.fabOverlay}>
              <FullWidthFab
                typography={typography}
                label={
                  saved.documentType === 'estimate'
                    ? 'SHARE ESTIMATE'
                    : 'SHARE INVOICE'
                }
                onPress={openShareSheet}
                includeSafeArea
              />
            </View>
          ) : null}
          {finalization && (finalization.selected || finalization.preview?.gaps.length === 0) ? (
            <View pointerEvents="box-none" style={styles.fabOverlay}>
              <FullWidthFab
                typography={typography}
                label={busy === 'Saving…'
                  ? 'SAVING…'
                  : finalization.status === 'paid'
                    ? finalization.selected
                      ? `CONFIRM ${formatUsdCombined(finalization.selected.payload.totalCents)} PAID`
                      : 'CREATE INVOICE & MARK PAID'
                    : finalization.selected
                      ? 'COMPLETE JOB'
                      : 'COMPLETE & CREATE INVOICE'}
                onPress={() => void confirmFinalization()}
                disabled={!!busy}
                includeSafeArea
              />
            </View>
          ) : null}
          <Modal
            visible={shareModalMounted}
            transparent
            animationType="none"
            statusBarTranslucent
            onDismiss={() => {
              if (Platform.OS === 'ios') closePreviewForHandoff();
            }}
            onRequestClose={closeShareSheet}
          >
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheetShell
                autoSizeUpToFraction={0.9}
                visible={shareOpen}
                onClose={closeShareSheet}
                onClosed={onShareSheetClosed}
                accessibilityTitle="Share document"
              >
                <View style={styles.sheet}>
                  <Text
                    accessibilityRole="header"
                    style={[typography.titleH3, styles.shareTitle]}
                  >
                    {active?.documentType === 'estimate'
                      ? 'Share Estimate'
                      : 'Share Invoice'}
                  </Text>
                  <View style={styles.shortcuts}>
                    {([
                      { kind: 'text', label: 'Text', Icon: IconMessageCircle },
                      { kind: 'email', label: 'Email', Icon: IconMail },
                      { kind: 'share', label: 'Share', Icon: IconShare3 },
                    ] as const).map(({ kind, label, Icon }) => (
                      <Pressable
                        key={kind}
                        accessibilityRole="button"
                        accessibilityLabel={
                          kind === 'text'
                            ? `Text ${active?.payload.customerName ?? 'customer'}`
                            : kind === 'email'
                              ? `Email ${active?.payload.customerName ?? 'customer'}`
                              : 'Share document'
                        }
                        accessibilityHint={
                          kind === 'share'
                            ? 'Choose an app and recipient'
                            : 'Opens a message composer'
                        }
                        disabled={busy != null}
                        onPress={() => void requestHandoff(kind)}
                        style={({ pressed }) => [
                          styles.shortcut,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.shortcutIcon}>
                          <Icon size={24} color={fg.primary} strokeWidth={2} />
                        </View>
                        <Text style={typography.bodyBold}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <ProfileRowsCard
                    typography={typography}
                    rows={[
                      {
                        kind: 'link',
                        label: copySuccess ? 'Copied' : 'Copy link',
                        onPress: () => void copyLink(),
                        trailingIcon: (
                          <IconCopy
                            size={20}
                            color={fg.primary}
                            strokeWidth={2}
                          />
                        ),
                      },
                      {
                        kind: 'link',
                        label: 'Open in browser',
                        onPress: () => void requestHandoff('browser'),
                        trailingIcon: (
                          <IconExternalLink
                            size={20}
                            color={fg.primary}
                            strokeWidth={2}
                          />
                        ),
                      },
                      {
                        kind: 'link',
                        label:
                          busy === 'Creating PDF…'
                            ? 'Creating PDF…'
                            : 'Download PDF',
                        onPress: busy
                          ? undefined
                          : () => void requestHandoff('pdf'),
                        trailingIcon: (
                          <IconDownload
                            size={20}
                            color={fg.primary}
                            strokeWidth={2}
                          />
                        ),
                      },
                    ]}
                  />
                </View>
              </BottomSheetShell>
            </GestureHandlerRootView>
          </Modal>
        </Animated.View>
      </Modal>
      <Modal
        visible={businessOpen}
        animationType="slide"
        onRequestClose={() => businessScreenRef.current?.requestBack()}
      >
        <BusinessSettingsScreen
          ref={businessScreenRef}
          typography={typography}
          mode="business"
          onBack={closeBusinessSettings}
        />
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
  editCard: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
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
  documentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/12'),
    minHeight: 48,
    paddingVertical: space('Spacing/12'),
    paddingLeft: space('Spacing/16'),
    paddingRight: space('Spacing/16'),
  },
  documentDetailsRow: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: space('Spacing/12'),
    paddingLeft: space('Spacing/16') + 28 + space('Spacing/12'),
    paddingRight: space('Spacing/16'),
  },
  separator: { borderTopWidth: 1, borderTopColor: border.subtle },
  secondary: { color: fg.secondary },
  accent: { color: color('Brand/Primary') },
  pressed: { opacity: 0.75 },
  preview: {
    flex: 1,
    backgroundColor: bg.canvasWarm,
  },
  previewCloseHeader: { paddingBottom: space('Spacing/4'), alignItems: 'flex-start' },
  previewCloseButton: {
    width: 44,
    height: 44,
    borderRadius: radius('Radius/Full'),
    backgroundColor: bg.surfaceWhite,
  },
  previewScroll: { flex: 1, width: '100%', backgroundColor: bg.surfaceWhite },
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
  sheet: { paddingVertical: space('Spacing/20'), gap: space('Spacing/12') },
  shareTitle: { alignSelf: 'stretch', textAlign: 'center' },
  shortcuts: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingVertical: space('Spacing/4'),
  },
  shortcut: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: space('Spacing/8'),
    paddingVertical: space('Spacing/4'),
  },
  shortcutIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius('Radius/Full'),
    borderWidth: 1,
    borderColor: border.subtle,
    backgroundColor: bg.surfaceWhite,
  },
});
