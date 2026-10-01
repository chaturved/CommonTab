import SwiftUI

struct ExpenseGroupsView: View {
    let store: ExpenseStore
    @State private var groups: [ExpenseGroup] = []
    @State private var showingCreate = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeading("Share together", subtitle: "Keep each trip, household or plan in its own group.")
                    .padding(.top, 10)

                NavigationLink {
                    GroupExpensesView()
                } label: {
                    SurfaceCard {
                        HStack(spacing: 14) {
                            SymbolTile(symbol: "globe", size: 52)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Shared online")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text("Groups that everyone can access")
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

                VStack(alignment: .leading, spacing: 12) {
                    SectionHeading("On this device", subtitle: "These groups stay on your iPhone.")

                    if groups.isEmpty {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 12) {
                                SymbolTile(symbol: "person.3.fill", size: 52)
                                Text("No groups yet")
                                    .font(.headline)
                                Text("Create a group to track balances with friends.")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Button("Create group", systemImage: "plus") { showingCreate = true }
                                    .buttonStyle(.borderedProminent)
                            }
                        }
                    } else {
                        ForEach(groups) { group in
                            NavigationLink {
                                ExpenseGroupDetailView(store: store, groupID: group.id)
                            } label: {
                                SurfaceCard {
                                    HStack(spacing: 14) {
                                        SymbolTile(symbol: "person.2.fill", size: 52)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(group.name)
                                                .font(.headline)
                                                .foregroundStyle(.primary)
                                            Text("\(group.members.count) members · \(group.currencyCode)")
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
                    }
                }
            }
            .padding(20)
        }
        .background(CommonTabStyle.background)
        .navigationTitle("Groups")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingCreate = true } label: { Label("Create group", systemImage: "plus") }
                    .accessibilityIdentifier("createGroup")
            }
        }
        .onAppear(perform: reload)
        .refreshable { reload() }
        .sheet(isPresented: $showingCreate) {
            CreateExpenseGroupView(store: store, onSaved: reload)
        }
        .alert("Could not load groups", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func reload() {
        do { groups = try store.loadGroups() }
        catch { errorMessage = error.localizedDescription }
    }
}
