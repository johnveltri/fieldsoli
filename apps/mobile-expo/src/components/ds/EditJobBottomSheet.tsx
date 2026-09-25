import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TextStyles } from '../../theme/nativeTokens';
import { DsTextInput } from './DsTextInput';
import { fg, border, space } from '../../theme/nativeTokens';
import { color } from '@fieldsolo/design-system/lib/tokens';
import type { FieldSoloSupabaseClient } from '@fieldsolo/api-client';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BottomSheetShell } from './BottomSheetShell';
import { SheetPrimaryDeleteActions } from './SheetPrimaryDeleteActions';
import { screenHeaderA11y } from '../../lib/accessibility';
import { JOB_SHORT_DESCRIPTION_MAX_LENGTH } from '@fieldsolo/shared-types';
import { CustomerFieldsBlock } from './customer/CustomerFieldsBlock';
import type { CustomerDraft } from './customer/types';

export type EditJobBottomSheetValues = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string | null;
  serviceAddress: string;
  revenue: string;
};

type EditJobBottomSheetProps = {
  typography: TextStyles;
  values?: Partial<EditJobBottomSheetValues>;
  supabase: FieldSoloSupabaseClient;
  visible: boolean;
  /** Shown under the revenue field (e.g. mark-complete wizard). */
  revenueError?: string;
  onClose?: () => void;
  onClosed?: () => void;
  onSavePress?: (values: EditJobBottomSheetValues) => void;
  onDeletePress?: () => void;
  /** @default true */
  registerInGlobalStack?: boolean;
};

function revenueTextIsZero(text: string): boolean {
  const trimmed = text.trim().replace(/[$,\s]/g, '');
  if (trimmed.length === 0) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n === 0;
}

const DEFAULT_VALUES: EditJobBottomSheetValues = {
  shortDescription: 'Bathroom Remodel Phase 1',
  longDescription: '',
  customerName: 'Andrew G',
  customerPhone: '',
  customerEmail: '',
  customerId: null,
  serviceAddress: '123 Main Street, Perrysburg, OH 43551',
  revenue: '5,678.87',
};

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M12.5 15L7.5 10L12.5 5"
        stroke={fg.secondary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function InputShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <View style={styles.inputShell}>
      {children}
    </View>
  );
}

function valuesToCustomerDraft(values: EditJobBottomSheetValues): CustomerDraft {
  return {
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    customerEmail: values.customerEmail,
    customerId: values.customerId,
    serviceAddress: values.serviceAddress,
  };
}

export function EditJobBottomSheet({
  typography,
  values,
  supabase,
  visible,
  revenueError,
  onClose,
  onClosed,
  onSavePress,
  onDeletePress,
  registerInGlobalStack = true,
}: EditJobBottomSheetProps) {
  const v = { ...DEFAULT_VALUES, ...values };
  const [shortDescription, setShortDescription] = useState(v.shortDescription);
  const [longDescription, setLongDescription] = useState(v.longDescription);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>(valuesToCustomerDraft(v));
  const [revenue, setRevenue] = useState(v.revenue);
  const shortDescriptionRef = useRef<TextInput>(null);
  const revenueRef = useRef<TextInput>(null);

  useEffect(() => {
    setShortDescription(v.shortDescription);
    setLongDescription(v.longDescription);
    setCustomerDraft(valuesToCustomerDraft(v));
    setRevenue(v.revenue);
  }, [
    v.customerEmail,
    v.customerId,
    v.customerName,
    v.customerPhone,
    v.shortDescription,
    v.longDescription,
    v.revenue,
    v.serviceAddress,
    visible,
  ]);

  const saveValues = (): EditJobBottomSheetValues => ({
    shortDescription,
    longDescription,
    customerName: customerDraft.customerName,
    customerPhone: customerDraft.customerPhone,
    customerEmail: customerDraft.customerEmail,
    customerId: customerDraft.customerId,
    serviceAddress: customerDraft.serviceAddress,
    revenue,
  });

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      accessibilityTitle="Edit Job"
      registerInGlobalStack={registerInGlobalStack}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onClose}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <BackIcon />
          <Text style={[typography.bodyBold, { color: fg.secondary }]}>Back</Text>
        </Pressable>

        <Text {...screenHeaderA11y()} style={[typography.titleH3, { color: fg.primary }]}>
          Edit Job
        </Text>

        <View style={styles.fields}>
          <View style={styles.titleShell}>
            <DsTextInput
              ref={shortDescriptionRef}
              value={shortDescription}
              onChangeText={(t) =>
                setShortDescription(t.slice(0, JOB_SHORT_DESCRIPTION_MAX_LENGTH))
              }
              placeholder="Short description"
              placeholderTextColor={fg.secondary}
              editable
              showSoftInputOnFocus
              maxLength={JOB_SHORT_DESCRIPTION_MAX_LENGTH}
              multiline
              blurOnSubmit={false}
              submitBehavior="newline"
              textAlignVertical="top"
              scrollEnabled={false}
              style={[typography.titleH3, styles.inputText, styles.titleInput]}
            />
          </View>
          <View style={styles.descriptionShell}>
            <DsTextInput
              value={longDescription}
              onChangeText={setLongDescription}
              placeholder="Description"
              placeholderTextColor={fg.secondary}
              editable
              showSoftInputOnFocus
              multiline
              blurOnSubmit={false}
              submitBehavior="newline"
              textAlignVertical="top"
              scrollEnabled={false}
              style={[typography.body, styles.inputText, styles.descriptionInput]}
            />
          </View>
          <CustomerFieldsBlock
            typography={typography}
            iconColor={fg.secondary}
            draft={customerDraft}
            onChange={(patch) => setCustomerDraft((prev) => ({ ...prev, ...patch }))}
            surface="job_edit"
            supabase={supabase}
          />
          <InputShell>
            <View style={styles.revenueRow}>
              <Text style={[typography.bodyBold, { color: fg.primary }]}>$</Text>
              <DsTextInput
                ref={revenueRef}
                value={revenue}
                onChangeText={setRevenue}
                onFocus={() => {
                  if (revenueTextIsZero(revenue)) {
                    setRevenue('');
                  }
                }}
                placeholder="Revenue"
                placeholderTextColor={fg.secondary}
                keyboardType="numeric"
                editable
                showSoftInputOnFocus
                style={[typography.body, styles.inputText, styles.revenueInput]}
              />
            </View>
          </InputShell>
          {revenueError ? (
            <Text style={[typography.bodySmall, { color: color('Semantic/Status/Error/Text') }]}>
              {revenueError}
            </Text>
          ) : null}
        </View>

        <SheetPrimaryDeleteActions
          typography={typography}
          primaryLabel="SAVE CHANGES"
          onPrimaryPress={() => onSavePress?.(saveValues())}
          onDeletePress={onDeletePress}
        />
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space('Spacing/12'),
    width: '100%',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
    alignSelf: 'flex-start',
  },
  fields: {
    gap: space('Spacing/8'),
    marginTop: space('Spacing/4'),
    marginBottom: space('Spacing/8'),
  },
  inputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  titleShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  descriptionShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  inputText: {
    color: fg.primary,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  titleInput: {
    minHeight: 28,
  },
  descriptionInput: {
    minHeight: 44,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space('Spacing/4'),
  },
  revenueInput: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
