import SwiftUI

struct ToolsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeading("Make the numbers easy", subtitle: "Helpful tools for the moments around a shared expense.")
                    .padding(.top, 10)

                NavigationLink {
                    CalculatorView()
                } label: {
                    SurfaceCard {
                        HStack(spacing: 14) {
                            SymbolTile(symbol: "divide.circle.fill", size: 52)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Tip & split calculator")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text("Split a restaurant bill by person or item")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .buttonStyle(.plain)

                NavigationLink {
                    SettingsView()
                } label: {
                    SurfaceCard {
                        HStack(spacing: 14) {
                            SymbolTile(symbol: "gearshape.fill", size: 52)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Settings")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text("Appearance, currency and API connection")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .padding(20)
        }
        .background(CommonTabStyle.background)
        .navigationTitle("Tools")
    }
}
