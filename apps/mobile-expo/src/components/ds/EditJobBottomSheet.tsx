import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TextStyles } from '../../theme/nativeTokens';
import { fg, border, space } from '../../theme/nativeTokens';
import { color } from '@fieldsolo/design-system/lib/tokens';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export type EditJobBottomSheetValues = {
  shortDescription: string;
  longDescription: string;
  customerName: string;
  serviceAddress: string;
  revenue: string;
};

type EditJobBottomSheetProps = {
  typography: TextStyles;
  values?: Partial<EditJobBottomSheetValues>;
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

export function EditJobBottomSheet({
  typography,
  values,
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
  const [customerName, setCustomerName] = useState(v.customerName);
  const [serviceAddress, setServiceAddress] = useState(v.serviceAddress);
  const [revenue, setRevenue] = useState(v.revenue);
  const shortDescriptionRef = useRef<TextInput>(null);
  const customerNameRef = useRef<TextInput>(null);
  const serviceAddressRef = useRef<TextInput>(null);
  const revenueRef = useRef<TextInput>(null);

  useEffect(() => {
    setShortDescription(v.shortDescription);
    setLongDescription(v.longDescription);
    setCustomerName(v.customerName);
    setServiceAddress(v.serviceAddress);
    setRevenue(v.revenue);
  }, [v.customerName, v.shortDescription, v.longDescription, v.revenue, v.serviceAddress, visible]);

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
            <TextInput
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
            <TextInput
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
          <InputShell>
            <TextInput
              ref={customerNameRef}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer name"
              placeholderTextColor={fg.secondary}
              editable
              showSoftInputOnFocus
              style={[typography.body, styles.inputText]}
            />
          </InputShell>
          <InputShell>
            <TextInput
              ref={serviceAddressRef}
              value={serviceAddress}
              onChangeText={setServiceAddress}
              placeholder="Service address"
              placeholderTextColor={fg.secondary}
              editable
              showSoftInputOnFocus
              style={[typography.body, styles.inputText]}
            />
          </InputShell>
          <InputShell>
            <View style={styles.revenueRow}>
              <Text style={[typography.bodyBold, { color: fg.primary }]}>$</Text>
              <TextInput
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
          onPrimaryPress={() =>
            onSavePress?.({
              shortDescription,
              longDescription,
              customerName,
              serviceAddress,
              revenue,
            })
          }
          onDeletePress={onDeletePress}
        />
      </View>
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
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  descriptionShell: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: border.subtle,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 9,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  inputText: {
    color: fg.primary,
    padding: 0,
    width: '100%',
  },
  titleInput: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexShrink: 1,
    minHeight: 25,
    height: undefined,
    textAlignVertical: 'top',
  },
  descriptionInput: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexShrink: 1,
    minHeight: 66,
    height: undefined,
    textAlignVertical: 'top',
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  revenueInput: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
