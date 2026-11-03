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
                VStack(alignment: .leading, spacing: 13) {
                    Text("YOUR EXPENSES")
                        .font(.caption.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(CommonTabStyle.mint)
                    Text("\(expenses.count) saved")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                        .contentTransition(.numericText())
                    Text("Keep purchases and receipts easy to find.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.82))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(22)
                .background(
                    LinearGradient(colors: [CommonTabStyle.ink, CommonTabStyle.deepInk],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22)
                )
                .listRowInsets(EdgeInsets(top: 12, leading: 20, bottom: 8, trailing: 20))
                .listRowBackground(Color.clear)

                NavigationLink { ExpenseGroupsView(store: store) } label: {
                    HStack(spacing: 12) {
                        SymbolTile(symbol: "person.3.fill", size: 42)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Groups and balances")
                                .font(.subheadline.weight(.semibold))
                            Text("Shared expenses on this device")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 5)
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
                Section("Find an expense") {
                    Picker("Category", selection: $categoryFilter) {
                        Text("All categories").tag("all")
                        ForEach(ExpenseCategory.allCases) { category in
                            Text(category.title).tag(category.rawValue)
                        }
                    }
                }
                Section("\(visibleExpenses.count) results") {
                    if visibleExpenses.isEmpty {
                        ContentUnavailableView(
                            "No matching expenses",
                            systemImage: "magnifyingglass",
                            description: Text("Try another search or category.")
                        )
                    }
                    ForEach(visibleExpenses) { expense in
                        NavigationLink {
                            ExpenseDetailView(store: store, expense: expense, onUpdated: reload)
                        } label: {
                            HStack(spacing: 8) {
                                ExpenseSummaryRow(
                                    expense: expense,
                                    context: "\(expense.category.title) · \(expense.date.formatted(date: .abbreviated, time: .omitted))"
                                )
                                if expense.receiptFilename != nil {
                                    Image(systemName: "paperclip")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 5)
                        }
                        .accessibilityIdentifier("savedExpense_\(expense.id.uuidString)")
                    }
                    .onDelete(perform: delete)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(CommonTabStyle.background)
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
