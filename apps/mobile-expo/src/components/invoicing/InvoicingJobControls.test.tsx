import React, { createRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

jest.mock('@fieldsolo/api-client', () => ({
  ...jest.requireActual<object>('@fieldsolo/api-client'),
  listFinancialDocuments: (...args: unknown[]) => mockList(...args),
  previewFinancialDocument: (...args: unknown[]) => mockPreview(...args),
  setFinancialDocumentControls: (...args: unknown[]) =>
    mockSetControls(...args),
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
const timing = Animated.timing;

describe('InvoicingJobControls', () => {
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
    // Jest has no native animation host to send the completion callback.
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) =>
      timing(value, { ...config, useNativeDriver: false }),
    );
    mockList.mockResolvedValue([doc]);
    mockPreview.mockResolvedValue({
      payload,
      gaps: ['labor'],
      rendererVersion: 1,
    } as DocumentPreview);
  });

  it('opens Docs editing from View and omits archived documents', async () => {
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
    fireEvent.press(await screen.findByLabelText('Edit Estimate #00001'));
    expect(onManageDocs).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Estimate #00002')).toBeNull();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('keeps document controls disabled while a revision update is pending', async () => {
    let resolveUpdate!: (value: FinancialDocumentRecord) => void;
    mockSetControls.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const screen = render(<InvoicingJobControls {...props} mode="edit" />);
    const sharedLink = await screen.findByRole('switch', {
      name: 'Shared link',
    });
    fireEvent(sharedLink, 'valueChange', false);
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Archived' }).props.disabled,
      ).toBe(true),
    );
    expect(mockSetControls).toHaveBeenCalledWith(
      {},
      {
        documentId: 'doc-1',
        archived: false,
        linkEnabled: false,
        expectedRevision: 3,
      },
    );
    await act(async () => {
      resolveUpdate({ ...doc, linkEnabled: false });
    });
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Archived' }).props.disabled,
      ).toBe(false),
    );
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
    await screen.findByLabelText('Edit Estimate #00001');
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
    await screen.findByLabelText('Edit Estimate #00001');
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
    await screen.findByLabelText('Edit Estimate #00001');
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
    await screen.findByLabelText('Edit Estimate #00001');
    await act(async () => {
      ref.current?.openPreview();
    });
    fireEvent.press(await screen.findByText('Edit business info'));
    fireEvent.press(await screen.findByText('Business info form'));
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(2));
    expect(props.onEditDetails).not.toHaveBeenCalled();
  });

  it('does not open an edit preview if saving outstanding edits is cancelled', async () => {
    const screen = render(
      <InvoicingJobControls
        {...props}
        mode="edit"
        beforeOpen={async () => false}
      />,
    );
    await screen.findByLabelText('Preview Estimate #00001');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Generate new document'));
    });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Estimate' })).toBeNull();
  });
});
