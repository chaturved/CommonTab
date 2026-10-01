import SwiftUI

@main
struct CommonTabApp: App {
    @AppStorage("settings.darkAppearance") private var darkAppearance = false

    init() {
        if ProcessInfo.processInfo.environment["COMMONTAB_UI_TEST_RESET_STATE"] == "1" {
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
