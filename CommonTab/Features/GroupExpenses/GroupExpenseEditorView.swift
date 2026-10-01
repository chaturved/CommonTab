import PhotosUI
import SwiftUI

struct GroupExpenseEditorView: View {
    let group: APIGroup
    let existing: APIExpense?
    let source: SavedExpense?
    let token: String
    let serverURL: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var merchant = ""
    @State private var amountText = ""
    @State private var notes = ""
    @State private var category = ExpenseCategory.other
    @State private var date = Date()
    @State private var payerID: UUID?
    @State private var participants: Set<UUID> = []
    @State private var method = ExpenseSplitMethod.equal
    @State private var values: [UUID: String] = [:]
    @State private var photo: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var receiptImage: UIImage?
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Expense") {
                TextField("Description", text: $merchant)
                TextField("Amount in \(group.currencyCode)", text: $amountText).keyboardType(.decimalPad)
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Picker("Category", selection: $category) {
                    ForEach(ExpenseCategory.allCases) { category in Text(category.title).tag(category) }
                }
                TextField("Notes", text: $notes, axis: .vertical)
            }
            Section("Split") {
                Picker("Paid by", selection: $payerID) {
                    Text("Choose payer").tag(Optional<UUID>.none)
                    ForEach(group.members) { member in Text(member.name).tag(Optional(member.id)) }
                }
                Picker("Method", selection: $method) {
                    ForEach(ExpenseSplitMethod.allCases) { method in Text(method.title).tag(method) }
                }
                ForEach(group.members) { member in
                    Toggle(member.name, isOn: Binding(
                        get: { participants.contains(member.id) },
                        set: { if $0 { participants.insert(member.id) } else { participants.remove(member.id) } }
                    ))
                    if participants.contains(member.id) && method != .equal {
                        TextField(method == .exact ? "\(member.name) minor units" : "\(member.name) percent",
                                  text: Binding(get: { values[member.id] ?? "" },
                                                set: { values[member.id] = $0 }))
                            .keyboardType(.decimalPad)
                    }
                }
                if method == .exact {
                    Text("Enter integer minor units (for example, 1250 for $12.50).")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Section("Receipt") {
                PhotosPicker("Attach receipt photo", selection: $photo, matching: .images)
                if let receiptImage {
                    Image(uiImage: receiptImage).resizable().scaledToFit().frame(maxHeight: 240)
                } else if existing?.hasReceipt == true {
                    Text("Receipt attached").foregroundStyle(.secondary)
                }
            }
            if let existing {
                Section { Button("Delete expense", role: .destructive) { Task { await delete(existing) } } }
            }
        }
        .navigationTitle(existing == nil ? "Add expense" : "Edit expense")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } } }
        }
        .onAppear(perform: loadExisting)
        .task {
            if let existing, existing.hasReceipt {
                do { receiptImage = UIImage(data: try await client().receipt(expense: existing, token: token)) }
                catch { errorMessage = error.localizedDescription }
            }
        }
        .onChange(of: photo) { _, newValue in
            Task {
                if let data = try? await newValue?.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    let normalized = normalizedJPEG(image)
                    photoData = normalized
                    receiptImage = UIImage(data: normalized)
                }
            }
        }
        .alert("Could not save expense", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func loadExisting() {
        payerID = existing?.payerID ?? group.members.first?.id
        participants = Set(existing?.allocations.map(\.memberID) ?? group.members.map(\.id))
        if let source {
            merchant = source.merchant
            amountText = NSDecimalNumber(decimal: source.amount).stringValue
            notes = source.notes
            category = source.category
            date = source.date
            if let data = try? ExpenseStore().receiptData(for: source),
               let image = UIImage(data: data) {
                photoData = normalizedJPEG(image)
                receiptImage = UIImage(data: photoData ?? Data())
            }
            return
        }
        guard let existing else { return }
        merchant = existing.merchant
        amountText = NSDecimalNumber(decimal: CurrencyUnits.amount(existing.amountMinor, currencyCode: group.currencyCode)).stringValue
        notes = existing.notes
        category = ExpenseCategory(rawValue: existing.category) ?? .other
        method = ExpenseSplitMethod(rawValue: existing.method) ?? .equal
        if let parsed = ISO8601DateFormatter().date(from: existing.occurredAt) { date = parsed }
        if method != .equal {
            values = Dictionary(uniqueKeysWithValues: zip(existing.allocations.map(\.memberID), existing.values))
        }
    }

    private func client() throws -> GroupExpenseClient {
        guard let url = URL(string: serverURL) else { throw GroupExpenseClientError.invalidServerURL }
        return try GroupExpenseClient(baseURL: url)
    }

    private func normalizedJPEG(_ image: UIImage) -> Data {
        let scale = min(1, 1800 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.75) { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private func save() async {
        guard let payerID, let amount = MoneyInputParser.parse(amountText) else {
            errorMessage = "Enter a payer and valid amount."
            return
        }
        do {
            let minor = try CurrencyUnits.units(amount, currencyCode: group.currencyCode)
            let members = group.members.map(\.id).filter { participants.contains($0) }
            let inputs = method == .equal ? [] : members.map { values[$0] ?? "" }
            let draft = APIExpenseDraft(id: existing?.id ?? UUID(), merchant: merchant,
                                           occurredAt: ISO8601DateFormatter().string(from: date),
                                           category: category.rawValue, notes: notes, amountMinor: minor,
                                           payerID: payerID, method: method.rawValue, participants: members,
                                           values: inputs, version: existing?.version)
            let client = try client()
            let saved = try await client.saveExpense(draft, groupID: group.id, token: token)
            if let photoData { try await client.uploadReceipt(photoData, mime: "image/jpeg", expense: saved, token: token) }
            onSaved()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }

    private func delete(_ expense: APIExpense) async {
        do {
            try await client().deleteExpense(expense, token: token)
            onSaved()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}
