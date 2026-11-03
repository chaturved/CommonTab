import SwiftUI

struct SettingsView: View {
    @AppStorage("settings.tipOne") private var tipOne = 15
    @AppStorage("settings.tipTwo") private var tipTwo = 18
    @AppStorage("settings.tipThree") private var tipThree = 20
    @AppStorage("settings.selectedTip") private var selectedTip = 0
    @AppStorage("settings.customTip") private var customTip = "18"
    @AppStorage("settings.darkAppearance") private var darkAppearance = false
    @AppStorage("settings.converterEnabled") private var converterEnabled = false
    @AppStorage("settings.targetCurrency") private var targetCurrency = "EUR"
    @AppStorage("settings.serverURL") private var serverURL = "http://localhost:8000"
    @AppStorage("analytics.enabled") private var analyticsEnabled = false

    private var customTipIsValid: Bool {
        guard let percentage = MoneyInputParser.parse(customTip) else { return false }
        return (0...100).contains(percentage)
    }

    private let currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"]

    var body: some View {
        Form {
            Section("Tip presets") {
                Stepper("First: \(tipOne)%", value: $tipOne, in: 0...100)
                Stepper("Second: \(tipTwo)%", value: $tipTwo, in: 0...100)
                Stepper("Third: \(tipThree)%", value: $tipThree, in: 0...100)

                Picker("Default tip", selection: $selectedTip) {
                    Text("First").tag(0)
                    Text("Second").tag(1)
                    Text("Third").tag(2)
                    Text("Other").tag(3)
                }
                if selectedTip == 3 {
                    HStack {
                        TextField("Custom tip", text: $customTip)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("settingsCustomTipPercentage")
                        Text("%")
                            .foregroundStyle(.secondary)
                    }
                    if !customTipIsValid {
                        Text("Enter a tip percentage from 0 to 100.")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }

            Section("Appearance") {
                Toggle("Dark appearance", isOn: $darkAppearance)
            }

            Section("Currency conversion") {
                Toggle("Show conversion", isOn: $converterEnabled)
                if converterEnabled {
                    Picker("Convert to", selection: $targetCurrency) {
                        ForEach(currencies, id: \.self) { currency in
                            Text(currency).tag(currency)
                        }
                    }
                    Text("Reference rates are estimates and may be updated after the latest business day.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Shared bill server") {
                TextField("Server URL", text: $serverURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Text("Use your HTTPS API address to share across devices. Localhost works for development on the same machine.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Section("Product analytics") {
                Toggle("Share anonymous usage counts", isOn: $analyticsEnabled)
                Text("When enabled, CommonTab sends only an event name and A/B variant to your configured server. It never sends receipt photos, bill amounts, names, or an install ID for analytics.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Settings")
    }
}
