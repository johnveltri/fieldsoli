package expo.modules.fieldsoli.passwordautofill

import android.os.Build
import android.view.autofill.AutofillManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FieldSoliPasswordAutofillModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FieldSoliPasswordAutofill")

    AsyncFunction("commit") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.currentActivity?.getSystemService(AutofillManager::class.java)?.commit()
      }
    }
  }
}
