import AdServices
import ExpoModulesCore
import Foundation

public class FieldSoliAppleAdsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FieldSoliAppleAds")

    // JS invokes this only after optional analytics consent. Never log the token.
    AsyncFunction("getAttributionToken") { () -> String? in
      #if targetEnvironment(simulator) || DEBUG
      return nil
      #else
      // Sandbox receipts include TestFlight; development must not pollute acquisition.
      if Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" {
        return nil
      }
      return try AAAttribution.attributionToken()
      #endif
    }
  }
}
