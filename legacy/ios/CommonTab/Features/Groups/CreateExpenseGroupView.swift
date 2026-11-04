import SwiftUI

struct CreateExpenseGroupView: View {
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
