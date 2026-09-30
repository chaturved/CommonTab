import SwiftUI

struct RecordSettlementView: View {
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
