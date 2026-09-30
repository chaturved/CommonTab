import Foundation

enum ExpenseStoreError: Error, Equatable {
    case invalidMerchant
    case invalidAmount
    case invalidCurrency
    case invalidNotes
    case invalidReceipt
    case unsupportedSchema
}

struct ExpenseStore {
    private struct Archive: Codable {
        let schemaVersion: Int
        let expenses: [SavedExpense]
    }

    let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("SplitTip/Expenses", isDirectory: true)
    }

    func load() throws -> [SavedExpense] {
        let url = directory.appendingPathComponent("expenses.json")
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let archive = try JSONDecoder().decode(Archive.self, from: Data(contentsOf: url))
        guard archive.schemaVersion == 1 else { throw ExpenseStoreError.unsupportedSchema }
        return archive.expenses.sorted { $0.date > $1.date }
    }

    @discardableResult
    func save(_ expense: SavedExpense, receiptData: Data? = nil, removeReceipt: Bool = false) throws -> SavedExpense {
        var saved = expense
        saved.merchant = saved.merchant.trimmingCharacters(in: .whitespacesAndNewlines)
        saved.notes = saved.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !saved.merchant.isEmpty, saved.merchant.count <= 120 else { throw ExpenseStoreError.invalidMerchant }
        guard (0...1_000_000_000).contains(saved.amount), saved.amount > 0 else { throw ExpenseStoreError.invalidAmount }
        guard saved.currencyCode.count == 3,
              saved.currencyCode.utf8.allSatisfy({ (65...90).contains($0) }) else {
            throw ExpenseStoreError.invalidCurrency
        }
        guard saved.notes.count <= 2_000 else { throw ExpenseStoreError.invalidNotes }
        guard receiptData == nil || (!receiptData!.isEmpty && receiptData!.count <= 10_000_000) else {
            throw ExpenseStoreError.invalidReceipt
        }

        var expenses = try load()
        let previous = expenses.first { $0.id == saved.id }
        let oldFilename = previous?.receiptFilename
        var newFilename: String?
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let receiptData {
            newFilename = "\(saved.id.uuidString)-\(UUID().uuidString).jpg"
            try receiptData.write(to: directory.appendingPathComponent(newFilename!), options: .atomic)
            saved.receiptFilename = newFilename
        } else if removeReceipt {
            saved.receiptFilename = nil
        } else {
            saved.receiptFilename = oldFilename
        }

        expenses.removeAll { $0.id == saved.id }
        expenses.append(saved)
        do {
            try write(expenses)
        } catch {
            if let newFilename { try? FileManager.default.removeItem(at: directory.appendingPathComponent(newFilename)) }
            throw error
        }
        if oldFilename != saved.receiptFilename, let oldFilename {
            removeImage(named: oldFilename, for: saved.id)
        }
        return saved
    }

    func delete(_ id: UUID) throws {
        var expenses = try load()
        guard let expense = expenses.first(where: { $0.id == id }) else { return }
        expenses.removeAll { $0.id == id }
        try write(expenses)
        if let filename = expense.receiptFilename { removeImage(named: filename, for: id) }
    }

    func receiptData(for expense: SavedExpense) throws -> Data? {
        guard let filename = expense.receiptFilename else { return nil }
        guard isManagedImage(filename, for: expense.id) else { throw ExpenseStoreError.invalidReceipt }
        return try Data(contentsOf: directory.appendingPathComponent(filename))
    }

    private func write(_ expenses: [SavedExpense]) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(Archive(schemaVersion: 1, expenses: expenses))
            .write(to: directory.appendingPathComponent("expenses.json"), options: .atomic)
    }

    private func removeImage(named filename: String, for id: UUID) {
        guard isManagedImage(filename, for: id) else { return }
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(filename))
    }

    private func isManagedImage(_ filename: String, for id: UUID) -> Bool {
        filename.hasPrefix("\(id.uuidString)-") && filename.hasSuffix(".jpg") &&
        !filename.contains("/") && !filename.contains("..")
    }
}
