import SwiftUI

struct ExpenseHomeView: View {
    private let store = ExpenseStore()
    @State private var groups: [ExpenseGroup] = []
    @State private var expenses: [SavedExpense] = []
    @State private var outstandingByGroup: [UUID: Int64] = [:]
    @State private var showingAddExpense = false
    @State private var showingCreateGroup = false
    @State private var errorMessage: String?

    private var groupsWithOpenBalances: Int {
        outstandingByGroup.values.filter { $0 > 0 }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                overviewCard
                quickLinks
                groupsSection
                recentExpensesSection
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .background(CommonTabStyle.background)
        .navigationTitle("CommonTab")
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

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            Label("YOUR OVERVIEW", systemImage: "circle.grid.cross")
                .font(.caption.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(CommonTabStyle.mint)

            VStack(alignment: .leading, spacing: 5) {
                Text(groupsWithOpenBalances == 0 ? "All caught up" : "\(groupsWithOpenBalances) groups to settle")
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    .contentTransition(.numericText())
                Text(groupsWithOpenBalances == 0
                     ? "Keep the details of every shared tab in one place."
                     : "See who owes what in each group below.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.82))
            }
            .foregroundStyle(.white)

            HStack(spacing: 20) {
                Label("\(groups.count) groups", systemImage: "person.2.fill")
                Label("\(expenses.count) expenses", systemImage: "receipt.fill")
            }
            .font(.caption.weight(.medium))
            .foregroundStyle(.white.opacity(0.86))

            Button {
                showingAddExpense = true
            } label: {
                Label("Add expense", systemImage: "plus")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
            .foregroundStyle(CommonTabStyle.deepInk)
            .background(.white, in: RoundedRectangle(cornerRadius: 14))
            .accessibilityIdentifier("addExpenseFromHome")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(22)
        .background(
            LinearGradient(colors: [CommonTabStyle.ink, CommonTabStyle.deepInk],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 26)
        )
    }

    private var quickLinks: some View {
        HStack(spacing: 12) {
            NavigationLink {
                GroupExpensesView()
            } label: {
                quickLink(title: "Shared online", subtitle: "Across devices", symbol: "person.2.wave.2.fill")
            }
            .accessibilityIdentifier("openSharedExpenses")

            NavigationLink {
                CalculatorView()
            } label: {
                quickLink(title: "Calculator", subtitle: "Tips & items", symbol: "divide.circle.fill")
            }
            .accessibilityIdentifier("openCalculator")
        }
        .buttonStyle(.plain)
    }

    private func quickLink(title: String, subtitle: String, symbol: String) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 10) {
                SymbolTile(symbol: symbol, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .lineLimit(1)
            }
        }
    }

    private var groupsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                SectionHeading("Groups", subtitle: "Saved on this device")
                Button {
                    showingCreateGroup = true
                } label: {
                    Label("Create group", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                }
                .accessibilityIdentifier("createGroupFromHome")
            }

            if groups.isEmpty {
                SurfaceCard {
                    HStack(spacing: 14) {
                        SymbolTile(symbol: "person.3.fill", size: 52)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Start a group")
                                .font(.headline)
                            Text("Add people and track shared costs together.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
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
                                    Text(groupSummary(for: group))
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
                    .accessibilityIdentifier("homeGroup_\(group.id.uuidString)")
                }
            }
        }
    }

    private var recentExpensesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                SectionHeading("Recent expenses")
                NavigationLink {
                    ExpenseLibraryView()
                } label: {
                    Text("See all")
                        .font(.subheadline.weight(.semibold))
                }
                .accessibilityIdentifier("openExpenseLibrary")
            }

            SurfaceCard {
                if expenses.isEmpty {
                    HStack(spacing: 14) {
                        SymbolTile(symbol: "receipt", size: 52)
                        Text("Your expenses will appear here.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    VStack(spacing: 13) {
                        ForEach(Array(expenses.prefix(5).enumerated()), id: \.element.id) { index, expense in
                            if index > 0 { Divider() }
                            NavigationLink {
                                ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                            } label: {
                                ExpenseSummaryRow(expense: expense, context: expenseContext(expense))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
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
