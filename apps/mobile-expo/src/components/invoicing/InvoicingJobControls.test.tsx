import React, { createRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
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

jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
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
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn() }));
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
  renderDocument: () => '<html></html>',
  renderDocumentPreview: () => '<html></html>',
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
  jobId: 'job-1',
  workStatus: 'inProgress',
  typography,
  onEditDetails: jest.fn(),
};
describe('InvoicingJobControls', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
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
    fireEvent.press(await screen.findByText('Edit Job details'));
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
    fireEvent.press(await screen.findByText('Edit business info'));
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
