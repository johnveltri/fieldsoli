import React, { createRef, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Animated, AppState, Modal, Share, StyleSheet } from 'react-native';
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
const mockSendSms = jest.fn<(...args: unknown[]) => Promise<unknown>>();
let mockShareSheetClosed: (() => void) | undefined;

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
jest.mock('expo-sms', () => ({ isAvailableAsync: async () => true, sendSMSAsync: (...args: unknown[]) => mockSendSms(...args) }));
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
  BottomSheetShell: ({ children, onClosed }: { children: React.ReactNode; onClosed: () => void }) => { mockShareSheetClosed = onClosed; return children; },
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
    mockSendSms.mockResolvedValue({ result: 'cancelled' });
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

  it('shows a prepared saved document during revalidation and preserves its painted source when unchanged', async () => {
    mockList.mockResolvedValue([doc]);
    const screen = render(<InvoicingJobControls {...props} mode="view" />);
    const row = await screen.findByLabelText(/^Preview Estimate #00001,/);
    let resolveRefresh!: (value: FinancialDocumentRecord[]) => void;
    mockList.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    fireEvent.press(row);
    const web = await screen.findByTestId('document-preview-html');
    const source = web.props.source;
    const token = Number(web.props.injectedJavaScript.match(/previewToken: (\d+)/)[1]);
    expect(screen.queryByTestId('document-preview-data-loading')).toBeNull();
    expect(screen.getByLabelText('SHARE ESTIMATE').props.accessibilityState.disabled).toBe(true);
    const readCount = mockList.mock.calls.length;
    fireEvent.press(screen.getByLabelText('SHARE ESTIMATE'));
    expect(mockList).toHaveBeenCalledTimes(readCount);
    expect(screen.getAllByText('Loading document preview…')).toHaveLength(1);
    fireEvent(web, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-ready', previewToken: token }) } });
    expect(screen.queryByText('Loading document preview…')).toBeNull();
    await act(async () => resolveRefresh([{ ...doc }]));
    expect(screen.getByTestId('document-preview-html').props.source).toBe(source);
    expect(screen.getByLabelText('SHARE ESTIMATE').props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('Loading document preview…')).toBeNull();
  });

  it('uses one loading presentation through data and renderer preparation', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    let resolvePreview!: (value: DocumentPreview) => void;
    mockPreview.mockImplementationOnce(() => new Promise((resolve) => { resolvePreview = resolve; }));
    act(() => ref.current?.openPreview());
    expect(screen.getAllByText('Loading document preview…')).toHaveLength(1);
    expect(screen.queryByText('Loading…')).toBeNull();
    await act(async () => resolvePreview({ payload, gaps: [], rendererVersion: 1 } as DocumentPreview));
    await screen.findByTestId('document-preview-html');
    expect(screen.getAllByText('Loading document preview…')).toHaveLength(1);
    expect(screen.queryByText('Loading…')).toBeNull();
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
  it.each([['paid', 'invoice'], ['inProgress', 'estimate']])('opens FAB previews on %s jobs without changing financial state', async (workStatus, type) => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" workStatus={workStatus} />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => { ref.current?.openPreview(); });
    expect(mockPreview).toHaveBeenLastCalledWith({}, expect.objectContaining({ type }));
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(screen.queryByText('Documents')).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateAndSelect).not.toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('reuses the prepared Job preview when the FAB opens', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const revision = {};
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" previewRevision={revision} />);
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1));
    await act(async () => { ref.current?.openPreview(); });
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(mockPreview).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateAndSelect).not.toHaveBeenCalled();
  });

  it('keeps the loader visible until first paint and resets it after a renderer restart', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await act(async () => { ref.current?.openPreview(); });
    const web = await screen.findByTestId('document-preview-html');
    expect(screen.getByTestId('document-preview-paint-loading')).toBeTruthy();
    expect(StyleSheet.flatten(web.props.style).opacity).toBe(0);
    fireEvent(web, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-height', height: 700 }) } });
    expect(screen.getByTestId('document-preview-paint-loading')).toBeTruthy();
    fireEvent(web, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-ready', previewToken: Number(web.props.injectedJavaScript.match(/previewToken: (\d+)/)[1]) }) } });
    expect(screen.queryByTestId('document-preview-paint-loading')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('document-preview-html').props.style).opacity).toBe(1);
    fireEvent(screen.getByTestId('document-preview-html'), 'onContentProcessDidTerminate');
    expect(screen.getByTestId('document-preview-paint-loading')).toBeTruthy();
  });

  it('ignores ready messages from a previous document source', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await act(async () => { ref.current?.openPreview(); });
    const previous = await screen.findByTestId('document-preview-html');
    const previousToken = Number(previous.props.injectedJavaScript.match(/previewToken: (\d+)/)[1]);
    mockPreview.mockResolvedValueOnce({ payload: { ...payload, documentType: 'invoice' }, gaps: [], rendererVersion: 1, paymentProjection: 'paid' } as DocumentPreview);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Invoice' })));
    const current = screen.getByTestId('document-preview-html');
    const currentToken = Number(current.props.injectedJavaScript.match(/previewToken: (\d+)/)[1]);
    expect(currentToken).not.toBe(previousToken);
    fireEvent(current, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-ready', previewToken: previousToken }) } });
    expect(screen.getByTestId('document-preview-paint-loading')).toBeTruthy();
    fireEvent(current, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-ready', previewToken: currentToken }) } });
    expect(screen.queryByTestId('document-preview-paint-loading')).toBeNull();
  });

  it('offers Retry when the renderer never reports first paint', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await act(async () => { ref.current?.openPreview(); });
    await screen.findByTestId('document-preview-html');
    jest.useFakeTimers();
    try {
      fireEvent(screen.getByTestId('document-preview-html'), 'onContentProcessDidTerminate');
      await act(async () => { jest.advanceTimersByTime(15_000); });
      expect(screen.getByLabelText('Retry document preview')).toBeTruthy();
      expect(screen.queryByTestId('document-preview-html')).toBeNull();
      fireEvent.press(screen.getByLabelText('Retry document preview'));
      await act(async () => {});
      expect(screen.getByTestId('document-preview-html')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes the selected unsaved type after app switching and recovers a failed read inline', async () => {
    const listener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener.mockImplementation(callback as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => { ref.current?.openPreview(); });
    mockPreview.mockResolvedValue({ payload: { ...payload, documentType: 'invoice' }, gaps: [], rendererVersion: 1 } as DocumentPreview);
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Invoice' })));
    await screen.findByLabelText('CREATE & SHARE INVOICE');
    mockPreview.mockRejectedValueOnce(new Error('offline'));
    act(() => listener('background'));
    act(() => listener('active'));
    const retry = await screen.findByLabelText('Retry document preview');
    expect(screen.queryByLabelText('CREATE & SHARE INVOICE')).toBeNull();
    fireEvent.press(retry);
    await waitFor(() => expect(screen.queryByLabelText('Retry document preview')).toBeNull());
    expect(mockPreview).toHaveBeenLastCalledWith({}, expect.objectContaining({ type: 'invoice' }));
    expect(screen.getByLabelText('Close preview')).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('ignores a superseded preview response after foreground refresh', async () => {
    const listener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener.mockImplementation(callback as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    let resolveOld!: (value: DocumentPreview) => void;
    mockPreview.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    act(() => ref.current?.openPreview());
    mockPreview.mockResolvedValueOnce({ payload, gaps: [], rendererVersion: 1, paymentProjection: 'paid' } as DocumentPreview);
    act(() => listener('active'));
    await waitFor(() => expect(screen.getByTestId('document-preview-html').props.source.html).toBe('paid'));
    await act(async () => resolveOld({ payload, gaps: [], rendererVersion: 1, paymentProjection: 'unpaid' } as DocumentPreview));
    expect(screen.getByTestId('document-preview-html').props.source.html).toBe('paid');
  });

  it('retries a saved document identity after a WebView error without creating another document', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    act(() => ref.current?.openDocument(doc.id));
    const html = await screen.findByTestId('document-preview-html');
    fireEvent(html, 'onError');
    fireEvent.press(await screen.findByLabelText('Retry document preview'));
    expect(await screen.findByLabelText('SHARE ESTIMATE')).toBeTruthy();
    expect(mockPreview).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('allows closing a pending read and ignores its late completion', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    let resolveRead!: (value: DocumentPreview) => void;
    mockPreview.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    act(() => ref.current?.openPreview());
    fireEvent.press(await screen.findByLabelText('Close preview'));
    await act(async () => resolveRead({ payload, gaps: [], rendererVersion: 1 } as DocumentPreview));
    expect(screen.queryByTestId('document-preview-scroll')).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('recovers a finalization renderer error on Retry', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => ref.current?.openFinalization('completed'));
    fireEvent(await screen.findByTestId('document-preview-html'), 'onError');
    fireEvent.press(await screen.findByLabelText('Retry document preview'));
    expect(await screen.findByTestId('document-preview-html')).toBeTruthy();
    expect(screen.queryByLabelText('Retry document preview')).toBeNull();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('refreshes the visible Documents list after a FAB estimate is created', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    function Harness() {
      const [revision, setRevision] = useState(0);
      const changed = useCallback(() => setRevision((value) => value + 1), []);
      return <>
        <InvoicingJobControls {...props} mode="view" refreshKey={revision} onPreviewDocument={(id) => ref.current?.openDocument(id)} />
        <InvoicingJobControls {...props} ref={ref} mode="launcher" refreshKey={revision} onDocumentsChanged={changed} />
      </>;
    }
    mockList.mockResolvedValue([]);
    mockPreview.mockResolvedValue({ payload, gaps: [], rendererVersion: 1, fingerprint: 'new-estimate' } as DocumentPreview);
    mockCreate.mockImplementationOnce(async () => { mockList.mockResolvedValue([doc]); return doc; });
    const screen = render(<Harness />);
    await screen.findByText('No documents yet');
    await act(async () => ref.current?.openPreview());
    fireEvent.press(await screen.findByLabelText('CREATE & SHARE ESTIMATE'));
    expect(await screen.findByLabelText(/^Preview Estimate #00001,/)).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('keeps the painted preview mounted behind native sharing and after cancellation', async () => {
    const listener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener.mockImplementation(callback as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    let finishShare!: () => void;
    const nativeShare = jest.spyOn(Share, 'share').mockImplementation(() => new Promise((resolve) => {
      finishShare = () => resolve({ action: Share.dismissedAction });
    }));
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => ref.current?.openDocument(doc.id));
    const web = await screen.findByTestId('document-preview-html');
    const source = web.props.source;
    const token = Number(web.props.injectedJavaScript.match(/previewToken: (\d+)/)[1]);
    fireEvent(web, 'onMessage', { nativeEvent: { data: JSON.stringify({ type: 'preview-ready', previewToken: token }) } });
    fireEvent.press(await screen.findByLabelText('SHARE ESTIMATE'));
    await screen.findByRole('button', { name: 'Share document' });
    const shareModal = screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.statusBarTranslucent)!;
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Share document' })));
    act(() => mockShareSheetClosed?.());
    await act(async () => shareModal.props.onDismiss());
    await waitFor(() => expect(nativeShare).toHaveBeenCalledTimes(1));
    const assertPreviewPreserved = () => {
      expect(screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.onShow)!.props.visible).toBe(true);
      expect(screen.getByTestId('document-preview-html').props.source).toBe(source);
      expect(screen.getByTestId('document-preview-html').props.injectedJavaScript).toBe(web.props.injectedJavaScript);
      expect(screen.queryByText('Loading document preview…')).toBeNull();
    };
    assertPreviewPreserved();
    const readsDuringShare = mockList.mock.calls.length;
    act(() => listener('inactive'));
    act(() => listener('active'));
    expect(mockList).toHaveBeenCalledTimes(readsDuringShare);
    assertPreviewPreserved();
    await act(async () => finishShare());
    assertPreviewPreserved();
    // Some native callbacks arrive after Share.share resolves; revalidate quietly.
    await act(async () => listener('active'));
    assertPreviewPreserved();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each(['dismissed', 'failed'])('cancels or recovers handoff preparation when %s', async (outcome) => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const nativeShare = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => ref.current?.openDocument(doc.id));
    fireEvent.press(await screen.findByLabelText('SHARE ESTIMATE'));
    await screen.findByRole('button', { name: 'Share document' });
    const shareModal = screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.statusBarTranslucent)!;
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Share document' })));
    let finishRead!: () => void;
    mockList.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finishRead = () => outcome === 'failed' ? reject(new Error('offline')) : resolve([doc]);
    }));
    act(() => mockShareSheetClosed?.());
    act(() => shareModal.props.onDismiss());
    if (outcome === 'dismissed') fireEvent.press(screen.getByLabelText('Close preview'));
    await act(async () => finishRead());
    expect(nativeShare).not.toHaveBeenCalled();
    if (outcome === 'dismissed') {
      expect(screen.UNSAFE_getAllByType(Modal).find((modal) => modal.props.onShow)!.props.visible).toBe(false);
    } else {
      expect(screen.getByLabelText('Retry document preview')).toBeTruthy();
      expect(screen.queryByLabelText('SHARE ESTIMATE')).toBeNull();
    }
  });

  it.each([['(419) 708-4470', ['+14197084470']], ['Buddy name', []], ['', []], [null, []]])('passes only snapshot phone recipients to the native composer: %s', async (phone, recipients) => {
    const ref = createRef<InvoicingJobControlsHandle>();
    mockList.mockResolvedValue([{ ...doc, payload: { ...payload, customerPhone: phone, totalCents: 123456 } } as FinancialDocumentRecord]);
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    act(() => ref.current?.openDocument(doc.id));
    fireEvent.press(await screen.findByLabelText('SHARE ESTIMATE'));
    await screen.findByRole('button', { name: phone ? 'Text Customer' : 'Text' });
    const modals = screen.UNSAFE_getAllByType(Modal);
    const previewModal = modals.find((modal) => modal.props.onShow)!;
    const shareModal = modals.find((modal) => modal.props.statusBarTranslucent)!;
    await act(async () => fireEvent.press(screen.getByRole('button', { name: phone ? 'Text Customer' : 'Text' })));
    act(() => mockShareSheetClosed?.());
    act(() => shareModal.props.onDismiss());
    expect(previewModal.props.visible).toBe(true);
    await waitFor(() => expect(mockSendSms).toHaveBeenCalledWith(recipients, expect.stringContaining('Estimate for $1,234.56 from Example Business')));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('settles a hung preview read into Retry without requiring close and reopen', async () => {
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.useFakeTimers();
    try {
      mockPreview.mockImplementationOnce(() => new Promise(() => undefined));
      act(() => ref.current?.openPreview());
      await act(async () => { jest.advanceTimersByTime(15000); });
      expect(screen.getByLabelText('Retry document preview')).toBeTruthy();
      fireEvent.press(screen.getByLabelText('Retry document preview'));
      await act(async () => undefined);
      expect(screen.queryByLabelText('Retry document preview')).toBeNull();
      expect(screen.getByTestId('document-preview-html')).toBeTruthy();
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps finalization confirmation blocked when a foreground refresh fails', async () => {
    const listener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener.mockImplementation(callback as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockList.mockResolvedValue([{ ...doc, isRevenueSource: true } as FinancialDocumentRecord]);
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => ref.current?.openFinalization('paid'));
    await screen.findByLabelText('CONFIRM $0.00 PAID');
    mockList.mockRejectedValueOnce(new Error('offline'));
    act(() => listener('active'));
    expect(await screen.findByLabelText('Retry document preview')).toBeTruthy();
    expect(screen.queryByLabelText('CONFIRM $0.00 PAID')).toBeNull();
    fireEvent.press(screen.getByLabelText('Retry document preview'));
    expect(await screen.findByLabelText('CONFIRM $0.00 PAID')).toBeTruthy();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it('does not reopen a finalization dismissed during a foreground read', async () => {
    const listener = jest.fn<(state: string) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      listener.mockImplementation(callback as (state: string) => void);
      return { remove: jest.fn() } as never;
    });
    mockList.mockResolvedValue([{ ...doc, isRevenueSource: true } as FinancialDocumentRecord]);
    const ref = createRef<InvoicingJobControlsHandle>();
    const screen = render(<InvoicingJobControls {...props} ref={ref} mode="launcher" />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    await act(async () => ref.current?.openFinalization('paid'));
    await screen.findByLabelText('CONFIRM $0.00 PAID');
    let resolveRead!: (value: FinancialDocumentRecord[]) => void;
    mockList.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    act(() => listener('active'));
    fireEvent.press(screen.getByLabelText('Close preview'));
    await act(async () => resolveRead([doc]));
    expect(screen.queryByTestId('document-preview-scroll')).toBeNull();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

});
