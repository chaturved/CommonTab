import SwiftUI

@main
struct SplitTipApp: App {
    @AppStorage("settings.darkAppearance") private var darkAppearance = false

    init() {
        if ProcessInfo.processInfo.environment["SPLITTIP_UI_TEST_RESET_STATE"] == "1" {
            AccountCredentialStore.clear()
        }
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ExpenseHomeView()
            }
            .preferredColorScheme(darkAppearance ? .dark : nil)
        }
    }
}
