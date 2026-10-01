import SwiftUI

private enum GroupActivityEntry: Identifiable {
    case expense(SavedExpense)
    case settlement(GroupSettlement)

    var id: String {
        switch self {
        case .expense(let expense): "expense-\(expense.id)"
        case .settlement(let settlement): "settlement-\(settlement.id)"
        }
    }

    var date: Date {
        switch self {
        case .expense(let expense): expense.date
        case .settlement(let settlement): settlement.date
        }
    }
}

struct ExpenseGroupDetailView: View {
    let store: ExpenseStore
    let groupID: UUID
    @State private var group: ExpenseGroup?
    @State private var expenses: [SavedExpense] = []
    @State private var showingExpense = false
    @State private var showingSettlement = false
    @State private var showingAddMember = false
    @State private var newMemberName = ""
    @State private var errorMessage: String?

    private var groupExpenses: [SavedExpense] {
        expenses.filter { $0.split?.groupID == groupID }
    }

    private var activity: [GroupActivityEntry] {
        let expenses = groupExpenses.map(GroupActivityEntry.expense)
        let settlements = group?.settlements.map(GroupActivityEntry.settlement) ?? []
        return (expenses + settlements).sorted { $0.date > $1.date }
    }

    private var balances: [GroupBalance] {
        guard let group else { return [] }
        return (try? GroupLedger.balances(group: group, expenses: expenses)) ?? []
    }

    private var openMinorUnits: Int64 {
        balances.reduce(0) { $0 + max(0, $1.minorUnits) }
    }

    private var canSettle: Bool {
        balances.contains(where: { $0.minorUnits < 0 }) && balances.contains(where: { $0.minorUnits > 0 })
    }

    var body: some View {
        ScrollView {
            if let group {
                VStack(alignment: .leading, spacing: 24) {
                    balanceHeader(for: group)
                    actions
                    balanceSection(for: group)
                    activitySection(for: group)
                    membersSection(for: group)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 28)
            } else {
                ContentUnavailableView("Group unavailable", systemImage: "person.2.slash",
                                       description: Text("This group could not be loaded."))
                    .padding(.top, 40)
            }
        }
        .background(CommonTabStyle.background)
        .navigationTitle(group?.name ?? "Group")
        .onAppear(perform: reload)
        .refreshable { reload() }
        .sheet(isPresented: $showingExpense) {
            ExpenseEditorView(store: store, expense: nil, preferredGroupID: groupID, onSaved: reload)
        }
        .sheet(isPresented: $showingSettlement) {
            if let group {
                RecordSettlementView(store: store, group: group, balances: balances, onSaved: reload)
            }
        }
        .alert("Add member", isPresented: $showingAddMember) {
            TextField("Name", text: $newMemberName)
            Button("Add") { addMember() }
            Button("Cancel", role: .cancel) { newMemberName = "" }
        } message: { Text("Enter a name for this group member.") }
        .alert("Group error", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func balanceHeader(for group: ExpenseGroup) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            Label("ON THIS DEVICE", systemImage: "iphone")
                .font(.caption.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(CommonTabStyle.mint)
            VStack(alignment: .leading, spacing: 5) {
                Text(openMinorUnits == 0 ? "All settled" : "Open to settle")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.82))
                Text(CurrencyUnits.amount(openMinorUnits, currencyCode: group.currencyCode)
                    .formatted(.currency(code: group.currencyCode)))
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    .minimumScaleFactor(0.75)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                Text("Across \(group.members.count) members")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.82))
            }
            .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(22)
        .background(
            LinearGradient(colors: [CommonTabStyle.ink, CommonTabStyle.deepInk],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 26)
        )
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Button {
                showingExpense = true
            } label: {
                Label("Add shared expense", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityIdentifier("addGroupExpense")

            Button("Record settlement", systemImage: "checkmark.circle") {
                showingSettlement = true
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .frame(maxWidth: .infinity)
            .disabled(!canSettle)
        }
    }

    private func balanceSection(for group: ExpenseGroup) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading("Balances", subtitle: "A positive balance means this person is owed.")
            SurfaceCard {
                VStack(spacing: 13) {
                    ForEach(Array(balances.enumerated()), id: \.element.member.id) { index, balance in
                        if index > 0 { Divider() }
                        HStack(spacing: 12) {
                            SymbolTile(symbol: "person.fill", size: 40)
                            Text(balance.member.name)
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 8)
                            Text(balanceText(balance.minorUnits, currencyCode: group.currencyCode))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(balance.minorUnits < 0 ? Color.orange : Color.primary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                    }
                }
            }
        }
    }

    private func activitySection(for group: ExpenseGroup) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading("Activity")
            SurfaceCard {
                if activity.isEmpty {
                    HStack(spacing: 14) {
                        SymbolTile(symbol: "receipt", size: 48)
                        Text("No shared activity yet.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    VStack(spacing: 13) {
                        ForEach(Array(activity.enumerated()), id: \.element.id) { index, entry in
                            if index > 0 { Divider() }
                            switch entry {
                            case .expense(let expense):
                                NavigationLink {
                                    ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                                } label: {
                                    ExpenseSummaryRow(
                                        expense: expense,
                                        context: expense.date.formatted(date: .abbreviated, time: .omitted)
                                    )
                                }
                                .buttonStyle(.plain)
                            case .settlement(let settlement):
                                let from = group.members.first { $0.id == settlement.fromID }?.name ?? "Member"
                                let to = group.members.first { $0.id == settlement.toID }?.name ?? "Member"
                                HStack(spacing: 12) {
                                    SymbolTile(symbol: "checkmark.arrow.trianglehead.counterclockwise", size: 42)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("\(from) paid \(to)")
                                            .font(.subheadline.weight(.semibold))
                                        Text(settlement.date.formatted(date: .abbreviated, time: .omitted))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 8)
                                    Text(CurrencyUnits.amount(settlement.minorUnits, currencyCode: group.currencyCode)
                                        .formatted(.currency(code: group.currencyCode)))
                                        .font(.subheadline.weight(.semibold))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func membersSection(for group: ExpenseGroup) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeading("Members")
                Button("Add member", systemImage: "person.badge.plus") {
                    showingAddMember = true
                }
                .font(.subheadline.weight(.semibold))
            }
            SurfaceCard {
                VStack(alignment: .leading, spacing: 13) {
                    ForEach(Array(group.members.enumerated()), id: \.element.id) { index, member in
                        if index > 0 { Divider() }
                        Label(member.name, systemImage: "person.crop.circle")
                            .font(.subheadline)
                    }
                }
            }
        }
    }

    private func balanceText(_ units: Int64, currencyCode: String) -> String {
        let amount = CurrencyUnits.amount(abs(units), currencyCode: currencyCode)
            .formatted(.currency(code: currencyCode))
        return units < 0 ? "Owes \(amount)" : units > 0 ? "Owed \(amount)" : "Settled"
    }

    private func reload() {
        do {
            group = try store.loadGroups().first { $0.id == groupID }
            expenses = try store.load()
            if let group { _ = try GroupLedger.balances(group: group, expenses: expenses) }
        } catch { errorMessage = "Could not read this group: \(error.localizedDescription)" }
    }

    private func addMember() {
        do {
            try store.addMember(named: newMemberName, to: groupID)
            newMemberName = ""
            reload()
        } catch { errorMessage = "Enter a distinct member name (up to 80 characters)." }
    }
}
