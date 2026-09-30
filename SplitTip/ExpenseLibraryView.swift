import PhotosUI
import SwiftUI
import UIKit

struct ExpenseLibraryView: View {
    private let store = ExpenseStore()
    @State private var expenses: [SavedExpense] = []
    @State private var searchText = ""
    @State private var categoryFilter = "all"
    @State private var editingExpense: SavedExpense?
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
                        Button {
                            editingExpense = expense
                            showingEditor = true
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
                    editingExpense = nil
                    showingEditor = true
                } label: {
                    Label("Add expense", systemImage: "plus")
                }
                .accessibilityIdentifier("addExpense")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingEditor) {
            ExpenseEditorView(store: store, expense: editingExpense, onSaved: reload)
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

private struct ExpenseEditorView: View {
    let store: ExpenseStore
    let expense: SavedExpense?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var merchant: String
    @State private var date: Date
    @State private var category: ExpenseCategory
    @State private var currencyCode: String
    @State private var amountText: String
    @State private var notes: String
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var existingImageData: Data?
    @State private var newImageData: Data?
    @State private var removeReceipt = false
    @State private var showingScanner = false
    @State private var errorMessage: String?

    init(store: ExpenseStore, expense: SavedExpense?, onSaved: @escaping () -> Void) {
        self.store = store
        self.expense = expense
        self.onSaved = onSaved
        _merchant = State(initialValue: expense?.merchant ?? "")
        _date = State(initialValue: expense?.date ?? .now)
        _category = State(initialValue: expense?.category ?? .other)
        _currencyCode = State(initialValue: expense?.currencyCode ?? (Locale.current.currency?.identifier ?? "USD"))
        _amountText = State(initialValue: expense.map { NSDecimalNumber(decimal: $0.amount).stringValue } ?? "")
        _notes = State(initialValue: expense?.notes ?? "")
    }

    private var amount: Decimal? {
        guard let value = MoneyInputParser.parse(amountText), value > 0,
              value <= 1_000_000_000 else { return nil }
        return value
    }

    private var previewData: Data? {
        if let newImageData { return newImageData }
        return removeReceipt ? nil : existingImageData
    }

    var body: some View {
        NavigationStack {
            Form {
                expenseFields
                receiptFields
            }
            .navigationTitle(expense == nil ? "Add expense" : "Edit expense")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(merchant.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || amount == nil)
                        .accessibilityIdentifier("saveExpense")
                }
            }
            .onAppear {
                if let expense {
                    do { existingImageData = try store.receiptData(for: expense) }
                    catch { errorMessage = "Could not open the saved receipt." }
                }
            }
            .onChange(of: selectedPhoto) { _, item in
                Task {
                    do {
                        guard let data = try await item?.loadTransferable(type: Data.self),
                              let jpeg = normalizedJPEG(data) else {
                            errorMessage = "Could not open the selected photo."
                            return
                        }
                        newImageData = jpeg
                        removeReceipt = false
                    } catch { errorMessage = "Could not open the selected photo." }
                }
            }
            .sheet(isPresented: $showingScanner) {
                ReceiptScannerView { result in
                    amountText = NSDecimalNumber(decimal: result.amount).stringValue
                    if let jpeg = normalizedJPEG(result.imageData) {
                        newImageData = jpeg
                        removeReceipt = false
                    }
                }
            }
            .alert("Could not save expense", isPresented: Binding(
                get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }


    private var expenseFields: some View {
        Section("Expense") {
            TextField("Merchant or description", text: $merchant)
                .textInputAutocapitalization(.words)
                .accessibilityIdentifier("expenseMerchant")
            DatePicker("Date", selection: $date, displayedComponents: .date)
            Picker("Category", selection: $category) {
                ForEach(ExpenseCategory.allCases) { value in
                    Text(value.title).tag(value)
                }
            }
            HStack {
                TextField("Currency", text: $currencyCode)
                    .textInputAutocapitalization(.characters)
                    .frame(maxWidth: 85)
                    .accessibilityIdentifier("expenseCurrency")
                TextField("Amount", text: $amountText)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("expenseAmount")
            }
            TextField("Notes (optional)", text: $notes, axis: .vertical)
                .lineLimit(2...5)
        }
    }

    private var receiptFields: some View {
        Section {
            if let previewData, let image = UIImage(data: previewData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 240)
                    .accessibilityLabel("Saved receipt")
            }
            Button {
                showingScanner = true
            } label: {
                Label("Scan receipt", systemImage: "doc.text.viewfinder")
            }
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Label("Attach photo", systemImage: "photo")
            }
            if previewData != nil {
                Button("Remove receipt", role: .destructive) {
                    newImageData = nil
                    removeReceipt = true
                }
            }
        } header: {
            Text("Receipt")
        } footer: {
            Text("Receipt text is read on your device. Review the suggested amount before saving.")
        }
    }

    private func save() {
        guard let amount else { return }
        let record = SavedExpense(
            id: expense?.id ?? UUID(), merchant: merchant, date: date,
            category: category, currencyCode: currencyCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
            amount: amount, notes: notes, receiptFilename: expense?.receiptFilename
        )
        do {
            try store.save(record, receiptData: newImageData, removeReceipt: removeReceipt)
            onSaved()
            dismiss()
        } catch {
            errorMessage = "Review the amount, three-letter currency, and receipt. \(error.localizedDescription)"
        }
    }

    private func normalizedJPEG(_ data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let scale = min(1, 1800 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.8) { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
