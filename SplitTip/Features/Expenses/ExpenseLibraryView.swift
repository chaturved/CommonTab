import SwiftUI

struct ExpenseLibraryView: View {
    private let store = ExpenseStore()
    @State private var expenses: [SavedExpense] = []
    @State private var searchText = ""
    @State private var categoryFilter = "all"
    @State private var showingEditor = false
    @State private var errorMessage: String?

    private var visibleExpenses: [SavedExpense] {
        expenses.filter { expense in
            (categoryFilter == "all" || expense.category.rawValue == categoryFilter) &&
            (searchText.isEmpty || expense.merchant.localizedCaseInsensitiveContains(searchText) ||
             expense.notes.localizedCaseInsensitiveContains(searchText))
        }
    }

    var body: some View {
        List {
            Section {
                NavigationLink { ExpenseGroupsView(store: store) } label: {
                    Label("Groups and balances", systemImage: "person.3")
                }
                .accessibilityIdentifier("openExpenseGroups")
            }
            if expenses.isEmpty {
                ContentUnavailableView(
                    "No saved expenses",
                    systemImage: "receipt",
                    description: Text("Add an expense or scan a receipt to keep it here.")
                )
            } else {
                Section {
                    Picker("Category", selection: $categoryFilter) {
                        Text("All categories").tag("all")
                        ForEach(ExpenseCategory.allCases) { category in
                            Text(category.title).tag(category.rawValue)
                        }
                    }
                }
                Section {
                    ForEach(visibleExpenses) { expense in
                        NavigationLink {
                            ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(expense.merchant).foregroundStyle(.primary)
                                    Text("\(expense.category.title) · \(expense.date.formatted(date: .abbreviated, time: .omitted))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if expense.receiptFilename != nil {
                                    Image(systemName: "paperclip").foregroundStyle(.secondary)
                                }
                                Text(expense.amount.formatted(.currency(code: expense.currencyCode)))
                                    .foregroundStyle(.primary)
                            }
                        }
                        .accessibilityIdentifier("savedExpense_\(expense.id.uuidString)")
                    }
                    .onDelete(perform: delete)
                }
            }
        }
        .navigationTitle("Expenses")
        .searchable(text: $searchText, prompt: "Search expenses")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingEditor = true
                } label: {
                    Label("Add expense", systemImage: "plus")
                }
                .accessibilityIdentifier("addExpense")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingEditor) {
            ExpenseEditorView(store: store, expense: nil, onSaved: reload)
        }
        .alert("Expense library error", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func reload() {
        do { expenses = try store.load() }
        catch { errorMessage = "Could not read saved expenses: \(error.localizedDescription)" }
    }

    private func delete(at offsets: IndexSet) {
        do {
            for index in offsets { try store.delete(visibleExpenses[index].id) }
            reload()
        } catch {
            errorMessage = "Could not delete the expense: \(error.localizedDescription)"
        }
    }
}
