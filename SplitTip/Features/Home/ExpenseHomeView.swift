import SwiftUI

struct ExpenseHomeView: View {
    private let store = ExpenseStore()
    @State private var groups: [ExpenseGroup] = []
    @State private var expenses: [SavedExpense] = []
    @State private var outstandingByGroup: [UUID: Int64] = [:]
    @State private var showingAddExpense = false
    @State private var showingCreateGroup = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section("Across devices") {
                NavigationLink {
                    SharedExpensesView()
                } label: {
                    Label("Shared expenses", systemImage: "person.2")
                }
                .accessibilityIdentifier("openSharedExpenses")
            }

            Section {
                Button {
                    showingAddExpense = true
                } label: {
                    Label("Add expense", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 4)
                }
                .accessibilityIdentifier("addExpenseFromHome")
            }

            Section("Groups on this device") {
                if groups.isEmpty {
                    Text("Create a group to track shared expenses and balances.")
                        .foregroundStyle(.secondary)
                }
                ForEach(groups) { group in
                    NavigationLink {
                        ExpenseGroupDetailView(store: store, groupID: group.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.name).font(.headline)
                            Text(groupSummary(for: group))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityIdentifier("homeGroup_\(group.id.uuidString)")
                }
                Button {
                    showingCreateGroup = true
                } label: {
                    Label("Create group", systemImage: "person.3.sequence.fill")
                }
                .accessibilityIdentifier("createGroupFromHome")
            }

            Section("Recent activity") {
                if expenses.isEmpty {
                    Text("Your recent expenses will appear here.")
                        .foregroundStyle(.secondary)
                }
                ForEach(expenses.prefix(5)) { expense in
                    NavigationLink {
                        ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(expense.merchant).foregroundStyle(.primary)
                                Text(expenseContext(expense))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(expense.amount.formatted(.currency(code: expense.currencyCode)))
                                .foregroundStyle(.primary)
                        }
                    }
                }
                NavigationLink {
                    ExpenseLibraryView()
                } label: {
                    Label("View all expenses", systemImage: "list.bullet")
                }
                .accessibilityIdentifier("openExpenseLibrary")
            }

            Section("Tools") {
                NavigationLink {
                    CalculatorView()
                } label: {
                    Label("Tip and itemized calculator", systemImage: "divide.circle")
                }
                .accessibilityIdentifier("openCalculator")
            }
        }
        .navigationTitle("SplitTip")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                .accessibilityIdentifier("openSettings")
            }
        }
        .onAppear(perform: reload)
        .refreshable { reload() }
        .sheet(isPresented: $showingAddExpense) {
            ExpenseEditorView(store: store, expense: nil, onSaved: reload)
        }
        .sheet(isPresented: $showingCreateGroup) {
            CreateExpenseGroupView(store: store, onSaved: reload)
        }
        .alert("Could not load expenses", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func groupSummary(for group: ExpenseGroup) -> String {
        let outstanding = outstandingByGroup[group.id] ?? 0
        let balance = outstanding == 0 ? "Settled" :
            "\(CurrencyUnits.amount(outstanding, currencyCode: group.currencyCode).formatted(.currency(code: group.currencyCode))) outstanding"
        return "\(group.members.count) members · \(balance)"
    }

    private func expenseContext(_ expense: SavedExpense) -> String {
        let location = groups.first(where: { $0.id == expense.split?.groupID })?.name ?? "Personal"
        return "\(location) · \(expense.date.formatted(date: .abbreviated, time: .omitted))"
    }

    private func reload() {
        do {
            let loadedGroups = try store.loadGroups()
            let loadedExpenses = try store.load()
            var outstanding: [UUID: Int64] = [:]
            for group in loadedGroups {
                let balances = try GroupLedger.balances(group: group, expenses: loadedExpenses)
                outstanding[group.id] = balances.reduce(0) { $0 + max(0, $1.minorUnits) }
            }
            groups = loadedGroups
            expenses = loadedExpenses
            outstandingByGroup = outstanding
            errorMessage = nil
        } catch {
            errorMessage = "Could not read saved expenses and groups: \(error.localizedDescription)"
        }
    }
}
