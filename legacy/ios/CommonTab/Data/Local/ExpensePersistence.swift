import Foundation

// The local archive is an implementation detail. Future sync uses a separate remote repository.
struct ExpenseArchive: Codable {
    var schemaVersion: Int = 2
    var expenses: [SavedExpense] = []
    var groups: [ExpenseGroup] = []

    private enum CodingKeys: String, CodingKey { case schemaVersion, expenses, groups }

    init() {}

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try values.decode(Int.self, forKey: .schemaVersion)
        expenses = try values.decode([SavedExpense].self, forKey: .expenses)
        groups = try values.decodeIfPresent([ExpenseGroup].self, forKey: .groups) ?? []
    }
}

protocol ExpenseArchiveRepository {
    func read() throws -> ExpenseArchive
    func write(_ archive: ExpenseArchive) throws
}

struct JSONExpenseArchiveRepository: ExpenseArchiveRepository {
    let directory: URL

    func read() throws -> ExpenseArchive {
        let url = directory.appendingPathComponent("expenses.json")
        guard FileManager.default.fileExists(atPath: url.path) else { return ExpenseArchive() }
        let archive = try JSONDecoder().decode(ExpenseArchive.self, from: Data(contentsOf: url))
        guard archive.schemaVersion == 1 || archive.schemaVersion == 2 else {
            throw ExpenseStoreError.unsupportedSchema
        }
        return archive
    }

    func write(_ archive: ExpenseArchive) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var archive = archive
        archive.schemaVersion = 2
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(archive).write(
            to: directory.appendingPathComponent("expenses.json"), options: .atomic
        )
    }
}

protocol ReceiptImageRepository {
    func save(_ data: Data, for expenseID: UUID) throws -> String
    func load(named filename: String, for expenseID: UUID) throws -> Data
    func remove(named filename: String, for expenseID: UUID)
}

struct FileReceiptImageRepository: ReceiptImageRepository {
    let directory: URL

    func save(_ data: Data, for expenseID: UUID) throws -> String {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let filename = "\(expenseID.uuidString)-\(UUID().uuidString).jpg"
        try data.write(to: directory.appendingPathComponent(filename), options: .atomic)
        return filename
    }

    func load(named filename: String, for expenseID: UUID) throws -> Data {
        guard isManagedImage(filename, for: expenseID) else { throw ExpenseStoreError.invalidReceipt }
        return try Data(contentsOf: directory.appendingPathComponent(filename))
    }

    func remove(named filename: String, for expenseID: UUID) {
        guard isManagedImage(filename, for: expenseID) else { return }
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(filename))
    }

    private func isManagedImage(_ filename: String, for id: UUID) -> Bool {
        filename.hasPrefix("\(id.uuidString)-") && filename.hasSuffix(".jpg") &&
        !filename.contains("/") && !filename.contains("..")
    }
}
