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
            TabView {
                Tab("Overview", systemImage: "square.grid.2x2.fill") {
                    NavigationStack { ExpenseHomeView() }
                }

                Tab("Groups", systemImage: "person.2.fill") {
                    NavigationStack { ExpenseGroupsView(store: ExpenseStore()) }
                }

                Tab("Expenses", systemImage: "receipt.fill") {
                    NavigationStack { ExpenseLibraryView() }
                }

                Tab("Tools", systemImage: "wrench.and.screwdriver.fill") {
                    NavigationStack { ToolsView() }
                }
            }
            .tint(.accentColor)
            .preferredColorScheme(darkAppearance ? .dark : nil)
        }
    }
}
