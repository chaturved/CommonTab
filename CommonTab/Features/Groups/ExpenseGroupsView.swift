import SwiftUI

struct ExpenseGroupsView: View {
    let store: ExpenseStore
    @State private var groups: [ExpenseGroup] = []
    @State private var showingCreate = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            if groups.isEmpty {
                ContentUnavailableView("No groups", systemImage: "person.3",
                                       description: Text("Create a group to track shared expenses and balances."))
            } else {
                ForEach(groups) { group in
                    NavigationLink {
                        ExpenseGroupDetailView(store: store, groupID: group.id)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(group.name)
                            Text("\(group.members.count) members · \(group.currencyCode)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Groups")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingCreate = true } label: { Label("Create group", systemImage: "plus") }
                    .accessibilityIdentifier("createGroup")
            }
        }
        .onAppear(perform: reload)
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
