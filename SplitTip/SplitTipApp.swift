import SwiftUI

@main
struct SplitTipApp: App {
    @AppStorage("settings.darkAppearance") private var darkAppearance = false

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                CalculatorView()
            }
            .preferredColorScheme(darkAppearance ? .dark : nil)
        }
    }
}
