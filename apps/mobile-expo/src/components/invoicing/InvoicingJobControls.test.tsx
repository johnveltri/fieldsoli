import React, { createRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, AppState, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { color } from '@fieldsolo/design-system/lib/tokens';
import type {
  DocumentPreview,
  FinancialDocumentRecord,
} from '@fieldsolo/api-client';
import { createTextStyles } from '../../theme/nativeTokens';
import {
  InvoicingJobControls,
  type InvoicingJobControlsHandle,
} from './InvoicingJobControls';

const mockList =
  jest.fn<(...args: unknown[]) => Promise<FinancialDocumentRecord[]>>();
const mockPreview = jest.fn<(...args: unknown[]) => Promise<DocumentPreview>>();
const mockSetControls =
  jest.fn<(...args: unknown[]) => Promise<FinancialDocumentRecord>>();
const mockFinalize =
  jest.fn<(...args: unknown[]) => Promise<FinancialDocumentRecord>>();
const mockCreate =
  jest.fn<(...args: unknown[]) => Promise<FinancialDocumentRecord>>();
const mockCreateAndSelect =
  jest.fn<(...args: unknown[]) => Promise<FinancialDocumentRecord>>();
const mockPrintToFile = jest.fn<(...args: unknown[]) => Promise<{ uri: string }>>();
const mockPdfSharingAvailable = jest.fn<() => Promise<boolean>>();

jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
  createFinancialDocument: (...args: unknown[]) => mockCreate(...args),
  createAndSelectFinancialDocument: (...args: unknown[]) => mockCreateAndSelect(...args),
  listFinancialDocuments: (...args: unknown[]) => mockList(...args),
  previewFinancialDocument: (...args: unknown[]) => mockPreview(...args),
  setFinancialDocumentControls: (...args: unknown[]) =>
    mockSetControls(...args),
  finalizeJobWithInvoice: (...args: unknown[]) => mockFinalize(...args),
}));
jest.mock('react-native-webview', () => ({
  WebView: require('react-native').View,
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-mail-composer', () => ({ isAvailableAsync: jest.fn() }));
jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrintToFile(...args) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: () => mockPdfSharingAvailable(), shareAsync: jest.fn() }));
jest.mock('expo-asset', () => ({
  Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'file:///font.ttf' }) }) },
}));
jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;
    constructor(base: string, name?: string) { this.uri = name ? `${base}/${name}` : base; }
    async base64() { return 'Zm9udA=='; }
    async copy(target: { uri: string }) { this.uri = target.uri; }
  },
  Paths: { cache: 'file:///cache' },
}));
jest.mock('../../screens/BusinessSettingsScreen', () => ({
  BusinessSettingsScreen: ({ onBack }: { onBack: () => void }) => {
    const { Text } = require('react-native');
    return <Text onPress={onBack}>Business info form</Text>;
  },
}));
jest.mock('../ds/BottomSheetShell', () => ({
  BottomSheetShell: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@fieldsolo/document-renderer', () => ({
  RENDERER_VERSION: 1,
  renderDocument: (_version: number, _payload: unknown, status: unknown) => String(status),
  renderDocumentPreview: (_version: number, _payload: unknown, status: unknown) => String(status),
}));

const typography = createTextStyles({
  serifBold: 'serif',
  sans: 'sans',
  sansSemi: 'semi',
  sansBold: 'bold',
});
const payload: DocumentPreview['payload'] = {
  schemaVersion: 1, documentType: 'estimate', documentNumber: 1,
  businessName: 'Example Business', businessAddress: null, businessPhone: null,
  businessEmail: null, businessWebsite: null, businessLicense: null,
  customerName: 'Customer', customerPhone: null, customerEmail: null,
  serviceAddress: null, shortDescription: 'Repair', longDescription: null,
  lines: [], subtotalCents: 0, taxRateBps: 0, taxCents: 0, totalCents: 0,
  currency: 'USD', issueDate: '2026-10-08', validUntil: null, dueDate: null,
  paymentTerms: null,
};
const doc = {
  payload,
  id: 'doc-1',
  documentType: 'estimate',
  documentNumber: 1,
  issueDate: '2026-10-06',
  archived: false,
  linkEnabled: true,
  controlRevision: 3,
  rendererVersion: 1,
} as FinancialDocumentRecord;
const props = {
  client: {} as never,
  ownerId: 'owner-1',
  jobId: 'job-1',
  workStatus: 'inProgress',
  typography,
  onEditDetails: jest.fn(),
};
describe('InvoicingJobControls', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
    void AsyncStorage.clear();
    // Complete animations synchronously; Jest has no native animation host.
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: (callback) => {
        if (typeof config.toValue === 'number') value.setValue(config.toValue);
        callback?.({ finished: true });
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }) as unknown as Animated.CompositeAnimation);
    mockList.mockResolvedValue([doc]);
    mockFinalize.mockResolvedValue(doc);
    mockCreate.mockResolvedValue(doc);
    mockCreateAndSelect.mockResolvedValue(doc);
    mockPrintToFile.mockResolvedValue({ uri: 'file:///generated.pdf' });
    mockPdfSharingAvailable.mockResolvedValue(true);
    mockPreview.mockResolvedValue({
      payload,
      gaps: ['labor'],
      rendererVersion: 1,
    } as DocumentPreview);
  });

  it('opens the saved preview from View and omits archived documents', async () => {
    mockList.mockResolvedValue([
      doc,
      { ...doc, id: 'doc-2', documentNumber: 2, archived: true },
    ]);
    const onManageDocs = jest.fn();
    const screen = render(
      <InvoicingJobControls
        {...props}
        mode="view"
        onManageDocs={onManageDocs}
      />,
    );
    fireEvent.press(await screen.findByLabelText(/^Preview Estimate #00001,/));
    expect(onManageDocs).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('SHARE ESTIMATE')).toBeTruthy();
    expect(screen.queryByText('Estimate #00002')).toBeNull();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('refreshes saved payment status before rendering a preview', async () => {
    const paid = { ...doc, paymentProjection: 'paid' } as FinancialDocumentRecord;
    const unpaid = { ...doc, paymentProjection: 'unpaid' } as FinancialDocumentRecord;
    mockList.mockResolvedValue([paid]);
    const screen = render(<InvoicingJobControls {...props} mode="view" />);
    const row = await screen.findByLabelText(/^Preview Estimate #00001,/);
    mockList.mockResolvedValue([unpaid]);
    fireEvent.press(row);

    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('unpaid'));
  });

  it('refreshes an open saved preview when the Job payment status changes', async () => {
    const paid = { ...doc, paymentProjection: 'paid' } as FinancialDocumentRecord;
    const unpaid = { ...doc, paymentProjection: 'unpaid' } as FinancialDocumentRecord;
    mockList.mockResolvedValue([paid]);
    const screen = render(<InvoicingJobControls {...props} mode="view" workStatus="paid" />);
    fireEvent.press(await screen.findByLabelText(/^Preview Estimate #00001,/));
    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('paid'));

    mockList.mockResolvedValue([unpaid]);
    screen.rerender(<InvoicingJobControls {...props} mode="view" workStatus="inProgress" />);

    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('unpaid'));
  });

  it('does not render the cached document when its fresh owner read fails', async () => {
    const screen = render(<InvoicingJobControls {...props} mode="view" />);
    const row = await screen.findByLabelText(/^Preview Estimate #00001,/);
    mockList.mockRejectedValueOnce(new Error('offline'));

    fireEvent.press(row);

    await waitFor(() => expect(screen.getByText('Offline — payment status may be out of date.')).toBeTruthy());
    expect(screen.queryByLabelText('SHARE ESTIMATE')).toBeNull();
    expect(screen.queryByText('paid')).toBeNull();
  });

  it('renders the freshly read payment status into a requested PDF', async () => {
    const paid = { ...doc, paymentProjection: 'paid' } as FinancialDocumentRecord;
    const unpaid = { ...doc, paymentProjection: 'unpaid' } as FinancialDocumentRecord;
    mockList.mockResolvedValue([paid]);
    const screen = render(<InvoicingJobControls {...props} mode="edit" />);
    fireEvent.press(await screen.findByLabelText('Preview and Share'));
    expect(await screen.findByLabelText('SHARE ESTIMATE')).toBeTruthy();
    mockList.mockResolvedValue([unpaid]);
    fireEvent.press(screen.getByLabelText('SHARE ESTIMATE'));
    fireEvent.press(await screen.findByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(mockPrintToFile).toHaveBeenCalled());
    expect(mockPrintToFile.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ html: 'unpaid' }));
  });

  it('does not generate a PDF when its fresh owner read fails', async () => {
    mockList.mockResolvedValue([doc]);
    const screen = render(<InvoicingJobControls {...props} mode="edit" />);
    fireEvent.press(await screen.findByLabelText('Preview and Share'));
    fireEvent.press(await screen.findByLabelText('SHARE ESTIMATE'));
    await screen.findByRole('button', { name: 'Download PDF' });
    mockList.mockRejectedValueOnce(new Error('offline'));
    fireEvent.press(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(screen.getByText('Offline — payment status may be out of date.')).toBeTruthy());
    expect(mockPrintToFile).not.toHaveBeenCalled();
  });

  it('refreshes an open saved preview when the app returns to the foreground', async () => {
    const appStateListener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') appStateListener.mockImplementation(listener as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    mockList.mockResolvedValue([{ ...doc, paymentProjection: 'paid' } as FinancialDocumentRecord]);
    const screen = render(<InvoicingJobControls {...props} mode="view" />);
    fireEvent.press(await screen.findByLabelText(/^Preview Estimate #00001,/));
    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('paid'));

    mockList.mockResolvedValue([{ ...doc, paymentProjection: 'unpaid' } as FinancialDocumentRecord]);
    const readsBeforeResume = mockList.mock.calls.length;
    act(() => appStateListener('active'));

    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(readsBeforeResume));
    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('unpaid'));
  });

  it('replays an existing durable key when another control already owns the request slot', async () => {
    mockPreview.mockResolvedValue({
      payload,
      gaps: [],
      rendererVersion: 1,
      fingerprint: 'new-preview-fingerprint',
    } as DocumentPreview);
    mockList.mockResolvedValue([]);
    const screen = render(<InvoicingJobControls {...props} mode="edit" />);
    fireEvent.press(await screen.findByLabelText('Create Estimate'));
    const button = await screen.findByRole('button', { name: 'CREATE & SHARE ESTIMATE' });
    await AsyncStorage.setItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
      JSON.stringify({
        kind: 'create', requestKey: 'other-control-key', jobId: 'job-1', type: 'estimate',
        fingerprint: 'original-fingerprint', timezone: 'America/Chicago',
        confirmedPaidTotalCents: null,
      }),
    );

    await act(async () => { fireEvent.press(button); });
    expect(await AsyncStorage.getItem('fieldsolo.financial-document-intent.v1:owner-1:job-1')).toContain('other-control-key');
    expect(mockCreate).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(button); });

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ requestKey: 'other-control-key', fingerprint: 'original-fingerprint' }),
    ));
    expect(mockCreate.mock.calls[0]?.[1]).not.toEqual(expect.objectContaining({ fingerprint: 'new-preview-fingerprint' }));
  });

  it('replays the retained creation key after remount before allowing another request', async () => {
    await AsyncStorage.setItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
      JSON.stringify({
        kind: 'create', requestKey: 'retained-key', jobId: 'job-1', type: 'estimate',
        fingerprint: 'retained-fingerprint', timezone: 'America/Chicago',
        confirmedPaidTotalCents: null,
      }),
    );

    render(<InvoicingJobControls {...props} mode="view" />);

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ requestKey: 'retained-key', fingerprint: 'retained-fingerprint' }),
    ));
    await waitFor(() => expect(AsyncStorage.getItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
    )).resolves.toBeNull());
  });

  it('retains and retries an unknown-outcome request after another remount', async () => {
    await AsyncStorage.setItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
      JSON.stringify({
        kind: 'create', requestKey: 'unknown-key', jobId: 'job-1', type: 'estimate',
        fingerprint: 'same-fingerprint', timezone: 'America/Chicago',
        confirmedPaidTotalCents: null,
      }),
    );
    mockCreate.mockRejectedValueOnce(new Error('network_timeout'));

    const first = render(<InvoicingJobControls {...props} mode="view" />);
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(await AsyncStorage.getItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
    )).toContain('unknown-key');
    first.unmount();

    render(<InvoicingJobControls {...props} mode="view" />);
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
    expect(mockCreate.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      requestKey: 'unknown-key',
      fingerprint: 'same-fingerprint',
    }));
    await waitFor(() => expect(AsyncStorage.getItem(
      'fieldsolo.financial-document-intent.v1:owner-1:job-1',
    )).resolves.toBeNull());
  });

  it('restarts intent hydration after focus changes interrupt storage loading', async () => {
    let releaseFirstRead!: () => void;
    const firstRead = new Promise<void>((resolve) => { releaseFirstRead = resolve; });
    let intentReads = 0;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async () => {
      intentReads += 1;
      if (intentReads === 1) await firstRead;
      return null;
    });
    mockPreview.mockResolvedValue({
      payload,
      gaps: [],
      rendererVersion: 1,
      fingerprint: 'focus-fingerprint',
    } as DocumentPreview);
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="edit" active />,
    );

    screen.rerender(<InvoicingJobControls {...props} ref={ref} mode="edit" active={false} />);
    screen.rerender(<InvoicingJobControls {...props} ref={ref} mode="edit" active />);
    releaseFirstRead();
    await waitFor(() => expect(intentReads).toBeGreaterThanOrEqual(2));

    await act(async () => { ref.current?.openPreview(); });
    await waitFor(() => expect(mockPreview).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'CREATE & SHARE ESTIMATE' });
    fireEvent.press(screen.getByRole('button', { name: 'CREATE & SHARE ESTIMATE' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  });

  it('stages archive and link changes until the Job Edit Done action saves them', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    mockSetControls.mockResolvedValue({ ...doc, archived: true, linkEnabled: false });
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="edit" />,
    );
    const archive = await screen.findByRole('checkbox', {
      name: 'Archive & Disable Link',
    });
    const preview = screen.getByRole('button', { name: 'Preview and Share' });
    expect(preview.props.disabled).not.toBe(true);
    fireEvent.press(archive);

    expect(screen.getByRole('checkbox', { name: 'Archive & Disable Link' }).props.accessibilityState)
      .toMatchObject({ checked: true });
    expect(
      screen.getByRole('button', { name: 'Un-Archive to Preview' }).props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(screen.queryByText('Saving document settings…')).toBeNull();
    expect(mockSetControls).not.toHaveBeenCalled();

    let pending: ReturnType<InvoicingJobControlsHandle['getPendingPreferences']> = null;
    await act(async () => {
      pending = ref.current?.getPendingPreferences() ?? null;
    });
    expect(pending).toEqual({
      revenueDocumentId: null,
      expectedRevenueDocumentId: null,
      controls: [{
        documentId: 'doc-1',
        archived: true,
        linkEnabled: false,
        expectedRevision: 3,
      }],
      currentTotalCents: null,
    });
    expect(mockSetControls).not.toHaveBeenCalled();
  });

  it('opens the saved preview when the document name and date row is tapped in Job Edit', async () => {
    const screen = render(
      <InvoicingJobControls {...props} mode="edit" />,
    );

    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Preview Estimate #00001, 2026-10-06',
      }),
    );

    expect(await screen.findByLabelText('SHARE ESTIMATE')).toBeTruthy();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('opens a preview through the FAB handle and dismisses it before Job editing', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const onEditDetails = jest.fn();
    const screen = render(
      <InvoicingJobControls
        {...props}
        ref={ref}
        mode="view"
        onEditDetails={onEditDetails}
      />,
    );
    await screen.findByLabelText(/^Preview Estimate #00001,/);
    await act(async () => {
      ref.current?.openPreview();
    });
    fireEvent.press(await screen.findByRole('button', {
      name: 'Job Details. Missing: Labor & Services.',
    }));
    expect(onEditDetails).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Estimate' })).toBeNull(),
    );
  });

  it('scrolls the document selector with the height-sized invoice', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="view" />);
    await screen.findByLabelText(/^Preview Estimate #00001,/);
    await act(async () => { ref.current?.openPreview(); });
    const scroll = screen.getByTestId('document-preview-scroll');
    expect(within(scroll).getByRole('button', { name: 'Estimate' })).toBeTruthy();
    expect(within(scroll).queryByLabelText('Close preview')).toBeNull();
    expect(screen.getByLabelText('Close preview')).toBeTruthy();
    const html = await screen.findByTestId('document-preview-html');
    expect(html.props.scrollEnabled).toBe(false);
    fireEvent(html, 'message', { nativeEvent: { data: JSON.stringify({
      type: 'preview-height', height: 1234,
    }) } });
    expect(StyleSheet.flatten(screen.getByTestId('document-preview-html').props.style).height).toBe(1234);
  });

  it('keeps the displayed type selected when loading another type fails', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="view" />,
    );
    await screen.findByLabelText(/^Preview Estimate #00001,/);
    await act(async () => {
      ref.current?.openPreview();
    });
    mockPreview.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Invoice' }));
    });
    expect(
      screen.getByRole('button', { name: 'Estimate' }).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Invoice' }).props.accessibilityState
        .selected,
    ).toBe(false);
  });

  it('routes a missing Business name to Business Info and refreshes the preview on return', async () => {
    mockPreview.mockResolvedValue({
      payload,
      gaps: ['business_name'],
      rendererVersion: 1,
    } as DocumentPreview);
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="view" />,
    );
    await screen.findByLabelText(/^Preview Estimate #00001,/);
    await act(async () => {
      ref.current?.openPreview();
    });
    fireEvent.press(await screen.findByRole('button', {
      name: 'Business Details. Missing: Business name.',
    }));
    fireEvent.press(await screen.findByText('Business info form'));
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
    expect(props.onEditDetails).not.toHaveBeenCalled();
  });

  it('reviews the selected invoice without building a new preview and confirms its saved total', async () => {
    const invoice = {
      ...doc,
      documentType: 'invoice',
      isRevenueSource: true,
      payload: { ...payload, documentType: 'invoice', subtotalCents: 60000, taxCents: 3000, totalCents: 63000 },
    } as FinancialDocumentRecord;
    mockList.mockResolvedValue([invoice]);
    mockPreview.mockRejectedValue(new Error('should not preview an existing source'));
    const onFinalized = jest.fn();
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="view" onFinalized={onFinalized} />,
    );

    await act(async () => { ref.current?.openFinalization('paid'); });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(screen.queryByText('Review Invoice')).toBeNull();
    expect(screen.queryByLabelText('Document type')).toBeNull();
    expect(screen.queryByLabelText('SHARE INVOICE')).toBeNull();
    expect(screen.getAllByText('Invoice #00001').length).toBeGreaterThan(0);
    const confirm = screen.getByRole('button', { name: 'CONFIRM $630.00 PAID' });
    expect(StyleSheet.flatten(confirm.props.style)).toMatchObject({
      backgroundColor: color('Semantic/Status/Success/Text'),
    });
    await act(async () => { fireEvent.press(confirm); });

    expect(mockFinalize).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        jobId: 'job-1',
        status: 'paid',
        documentId: 'doc-1',
        confirmedPaidTotalCents: 63000,
      }),
    );
    expect(onFinalized).toHaveBeenCalledWith('paid');
  });

  it('creates an invoice and completes the Job from the final review without sharing', async () => {
    mockList.mockResolvedValue([]);
    mockPreview.mockResolvedValue({
      payload: { ...payload, documentType: 'invoice', subtotalCents: 10000, taxCents: 0, totalCents: 10000 },
      gaps: [],
      rendererVersion: 1,
      fingerprint: 'reviewed-fingerprint',
    } as DocumentPreview);
    const onFinalized = jest.fn();
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="view" onFinalized={onFinalized} />,
    );

    await act(async () => { ref.current?.openFinalization('completed'); });
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(screen.queryByText('Review Invoice')).toBeNull();
    expect(screen.queryByLabelText('Document type')).toBeNull();
    expect(screen.getByRole('button', { name: 'COMPLETE & CREATE INVOICE' })).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'COMPLETE & CREATE INVOICE' }));
    });
    expect(mockFinalize).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        jobId: 'job-1',
        status: 'completed',
        documentId: null,
        fingerprint: 'reviewed-fingerprint',
      }),
    );
    expect(onFinalized).toHaveBeenCalledWith('completed');
  });

  it('cancels Paid review when the existing preview is closed without saving', async () => {
    mockList.mockResolvedValue([]);
    mockPreview.mockResolvedValue({
      payload: { ...payload, documentType: 'invoice', totalCents: 10000 },
      gaps: [], rendererVersion: 1, fingerprint: 'reviewed-fingerprint',
    } as DocumentPreview);
    const onFinalizationClosed = jest.fn();
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(
      <InvoicingJobControls {...props} ref={ref} mode="view" onFinalizationClosed={onFinalizationClosed} />,
    );

    await act(async () => { ref.current?.openFinalization('paid'); });
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CREATE INVOICE & MARK PAID' })).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close preview'));

    expect(mockFinalize).not.toHaveBeenCalled();
    expect(onFinalizationClosed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('document-preview-scroll')).toBeNull());
  });

  it('does not open an edit preview if saving outstanding edits is cancelled', async () => {
    const screen = render(
      <InvoicingJobControls
        {...props}
        mode="edit"
        beforeOpen={async () => false}
      />,
    );
    await screen.findByLabelText('Create Estimate');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Create Estimate'));
    });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Estimate' })).toBeNull();
  });

  it('uses compact Text, Email, and Share shortcuts with formatted customer details', async () => {
    const shareableDoc = {
      ...doc,
      payload: {
        ...payload,
        customerPhone: '3125550198',
        customerEmail: 'customer@example.com',
      },
    } as FinancialDocumentRecord;
    mockList.mockResolvedValue([shareableDoc]);
    const screen = render(<InvoicingJobControls {...props} mode="edit" />);

    fireEvent.press(await screen.findByLabelText('Preview and Share'));
    fireEvent.press(await screen.findByLabelText('SHARE ESTIMATE'));

    expect(await screen.findByRole('button', { name: 'Text Customer' })).toBeTruthy();
    const shareTitle = screen.getByRole('header', { name: 'Share Estimate' });
    expect(StyleSheet.flatten(shareTitle.props.style)).toMatchObject({
      ...typography.titleH3,
      textAlign: 'center',
    });
    expect(screen.queryByLabelText('Back to preview')).toBeNull();
    expect(screen.getByRole('button', { name: 'Email Customer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share document' })).toBeTruthy();
    expect(screen.queryByText('Customer · (312) 555-0198 · customer@example.com')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in browser' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share document' })).toBeTruthy();
  });
});
