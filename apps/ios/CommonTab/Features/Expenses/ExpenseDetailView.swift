import SwiftUI
import UIKit

struct ExpenseDetailView: View {
    let store: ExpenseStore
    let onUpdated: () -> Void
    @State private var expense: SavedExpense
    @State private var group: ExpenseGroup?
    @State private var receiptData: Data?
    @State private var showingEditor = false
    @State private var errorMessage: String?

    init(store: ExpenseStore, expense: SavedExpense, onUpdated: @escaping () -> Void) {
        self.store = store
        self.onUpdated = onUpdated
        _expense = State(initialValue: expense)
    }

    var body: some View {
        List {
            Section("Expense") {
                LabeledContent("Amount", value: expense.amount.formatted(.currency(code: expense.currencyCode)))
                LabeledContent("Date", value: expense.date.formatted(date: .abbreviated, time: .omitted))
                LabeledContent("Category", value: expense.category.title)
                LabeledContent("Group", value: group?.name ?? "Personal")
                if !expense.notes.isEmpty {
                    Text(expense.notes)
                }
            }
            if let split = expense.split, let group {
                Section("Split") {
                    LabeledContent("Paid by", value: group.members.first(where: { $0.id == split.payerID })?.name ?? "Member")
                    ForEach(split.allocations) { allocation in
                        LabeledContent(
                            group.members.first(where: { $0.id == allocation.memberID })?.name ?? "Member",
                            value: CurrencyUnits.amount(allocation.minorUnits, currencyCode: group.currencyCode)
                                .formatted(.currency(code: group.currencyCode))
                        )
                    }
                }
            }
            if let bill = expense.itemizedBill {
                Section("Items") {
                    ForEach(bill.items) { item in
                        LabeledContent(item.name, value: item.price.formatted(.currency(code: expense.currencyCode)))
                    }
                }
            }
            if let receiptData, let image = UIImage(data: receiptData) {
                Section("Receipt") {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .accessibilityLabel("Receipt photo")
                }
            }
        }
        .navigationTitle(expense.merchant)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { showingEditor = true }
                    .accessibilityIdentifier("editExpense")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingEditor) {
            ExpenseEditorView(store: store, expense: expense) {
                reload()
                onUpdated()
            }
        }
        .alert("Could not load expense", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func reload() {
        do {
            guard let latest = try store.load().first(where: { $0.id == expense.id }) else { return }
            expense = latest
            group = try store.loadGroups().first(where: { $0.id == latest.split?.groupID })
            receiptData = try store.receiptData(for: latest)
            errorMessage = nil
        } catch {
            errorMessage = "Could not read this expense: \(error.localizedDescription)"
        }
    }
}
