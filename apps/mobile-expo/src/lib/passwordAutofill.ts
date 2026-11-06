import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Finish the single-Activity Android autofill session after credentials succeed. */
export async function commitPasswordAutofill(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const native = requireOptionalNativeModule<{ commit(): Promise<void> }>(
      'FieldSoliPasswordAutofill',
    );
    await native?.commit();
  } catch {
    // Password-manager prompts must not turn a successful auth request into an error.
  }
}
