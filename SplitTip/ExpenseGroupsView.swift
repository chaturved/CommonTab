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

private struct CreateExpenseGroupView: View {
    let store: ExpenseStore
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var currencyCode = Locale.current.currency?.identifier ?? "USD"
    @State private var memberNames = ["You", "Friend"]
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Group") {
                    TextField("Group name", text: $name)
                        .accessibilityIdentifier("groupName")
                    TextField("Currency", text: $currencyCode)
                        .textInputAutocapitalization(.characters)
                        .accessibilityIdentifier("groupCurrency")
                }
                Section("Members") {
                    ForEach(memberNames.indices, id: \.self) { index in
                        TextField("Member \(index + 1)", text: $memberNames[index])
                            .accessibilityIdentifier("groupMember_\(index)")
                    }
                    if memberNames.count < 20 {
                        Button("Add member") { memberNames.append("") }
                    }
                }
            }
            .navigationTitle("New group")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("saveGroup")
                }
            }
            .alert("Could not create group", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        }
    }

    private func create() {
        do {
            try store.createGroup(
                name: name,
                currencyCode: currencyCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                memberNames: memberNames
            )
            onSaved()
            dismiss()
        } catch { errorMessage = "Give the group a name, a valid currency, and at least two distinct members." }
    }
}

struct ExpenseGroupDetailView: View {
    let store: ExpenseStore
    let groupID: UUID
    @State private var group: ExpenseGroup?
    @State private var expenses: [SavedExpense] = []
    @State private var showingExpense = false
    @State private var editingExpense: SavedExpense?
    @State private var showingSettlement = false
    @State private var showingAddMember = false
    @State private var newMemberName = ""
    @State private var errorMessage: String?

    private var groupExpenses: [SavedExpense] {
        expenses.filter { $0.split?.groupID == groupID }
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
                Section("Expenses") {
                    if groupExpenses.isEmpty {
                        Text("No shared expenses yet.").foregroundStyle(.secondary)
                    }
                    ForEach(groupExpenses) { expense in
                        Button {
                            editingExpense = expense
                        } label: {
                            HStack {
                                Text(expense.merchant)
                                Spacer()
                                Text(expense.amount.formatted(.currency(code: group.currencyCode)))
                            }
                            .foregroundStyle(.primary)
                        }
                    }
                    Button("Add shared expense") { showingExpense = true }
                        .accessibilityIdentifier("addGroupExpense")
                }
                Section("Settlements") {
                    ForEach(group.settlements) { settlement in
                        let from = group.members.first { $0.id == settlement.fromID }?.name ?? "Member"
                        let to = group.members.first { $0.id == settlement.toID }?.name ?? "Member"
                        Text("\(from) paid \(to) · \(CurrencyUnits.amount(settlement.minorUnits, currencyCode: group.currencyCode).formatted(.currency(code: group.currencyCode)))")
                    }
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
        .sheet(item: $editingExpense) { expense in
            ExpenseEditorView(store: store, expense: expense, onSaved: reload)
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

private struct RecordSettlementView: View {
    let store: ExpenseStore
    let group: ExpenseGroup
    let balances: [GroupBalance]
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var fromID: UUID
    @State private var toID: UUID
    @State private var amountText = ""
    @State private var errorMessage: String?

    init(store: ExpenseStore, group: ExpenseGroup, balances: [GroupBalance], onSaved: @escaping () -> Void) {
        self.store = store
        self.group = group
        self.balances = balances
        self.onSaved = onSaved
        _fromID = State(initialValue: balances.first(where: { $0.minorUnits < 0 })?.member.id ?? group.members[0].id)
        _toID = State(initialValue: balances.first(where: { $0.minorUnits > 0 })?.member.id ?? group.members[1].id)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Paid by", selection: $fromID) {
                    ForEach(group.members) { member in Text(member.name).tag(member.id) }
                }
                Picker("Paid to", selection: $toID) {
                    ForEach(group.members) { member in Text(member.name).tag(member.id) }
                }
                TextField("Amount", text: $amountText)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("settlementAmount")
                Text("Record money that has already changed hands. This does not transfer funds.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .navigationTitle("Record settlement")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.accessibilityIdentifier("saveSettlement")
                }
            }
            .alert("Could not record settlement", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        guard let amount = MoneyInputParser.parse(amountText) else {
            errorMessage = "Enter a valid amount."
            return
        }
        do {
            try store.recordSettlement(groupID: group.id, fromID: fromID, toID: toID, amount: amount)
            onSaved()
            dismiss()
        } catch { errorMessage = "Choose someone who owes, someone who is owed, and an amount within their balances." }
    }
}
