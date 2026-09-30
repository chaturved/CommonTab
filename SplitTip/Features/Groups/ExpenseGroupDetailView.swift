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

    var body: some View {
        List {
            if let group {
                Section("Balances") {
                    ForEach(balances, id: \.member.id) { balance in
                        HStack {
                            Text(balance.member.name)
                            Spacer()
                            Text(balanceText(balance.minorUnits, currencyCode: group.currencyCode))
                                .foregroundStyle(balance.minorUnits < 0 ? .red : .primary)
                        }
                    }
                }
                Section("Members") {
                    ForEach(group.members) { member in Text(member.name) }
                    Button("Add member") { showingAddMember = true }
                }
                Section("Activity") {
                    if activity.isEmpty {
                        Text("No shared activity yet.").foregroundStyle(.secondary)
                    }
                    ForEach(activity) { entry in
                        switch entry {
                        case .expense(let expense):
                            NavigationLink {
                                ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(expense.merchant)
                                        Text(expense.date.formatted(date: .abbreviated, time: .omitted))
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(expense.amount.formatted(.currency(code: group.currencyCode)))
                                }
                            }
                        case .settlement(let settlement):
                            let from = group.members.first { $0.id == settlement.fromID }?.name ?? "Member"
                            let to = group.members.first { $0.id == settlement.toID }?.name ?? "Member"
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(from) paid \(to)")
                                Text("\(CurrencyUnits.amount(settlement.minorUnits, currencyCode: group.currencyCode).formatted(.currency(code: group.currencyCode))) · \(settlement.date.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Button("Add shared expense") { showingExpense = true }
                        .accessibilityIdentifier("addGroupExpense")
                    Button("Record settlement") { showingSettlement = true }
                        .disabled(!balances.contains(where: { $0.minorUnits < 0 }) ||
                                  !balances.contains(where: { $0.minorUnits > 0 }))
                }
            }
        }
        .navigationTitle(group?.name ?? "Group")
        .onAppear(perform: reload)
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
