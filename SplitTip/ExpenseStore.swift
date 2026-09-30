import Foundation

enum ExpenseStoreError: Error, Equatable {
    case invalidMerchant
    case invalidAmount
    case invalidCurrency
    case invalidNotes
    case invalidReceipt
    case unsupportedSchema
    case groupMissing
}

struct ExpenseStore {
    private struct Archive: Codable {
        var schemaVersion: Int
        var expenses: [SavedExpense]
        var groups: [ExpenseGroup]

        init(schemaVersion: Int = 2, expenses: [SavedExpense] = [], groups: [ExpenseGroup] = []) {
            self.schemaVersion = schemaVersion
            self.expenses = expenses
            self.groups = groups
        }

        private enum CodingKeys: String, CodingKey { case schemaVersion, expenses, groups }

        init(from decoder: Decoder) throws {
            let values = try decoder.container(keyedBy: CodingKeys.self)
            schemaVersion = try values.decode(Int.self, forKey: .schemaVersion)
            expenses = try values.decode([SavedExpense].self, forKey: .expenses)
            groups = try values.decodeIfPresent([ExpenseGroup].self, forKey: .groups) ?? []
        }
    }

    let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("SplitTip/Expenses", isDirectory: true)
    }

    func load() throws -> [SavedExpense] {
        try readArchive().expenses.sorted { $0.date > $1.date }
    }

    func loadGroups() throws -> [ExpenseGroup] {
        try readArchive().groups.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    @discardableResult
    func createGroup(name: String, currencyCode: String, memberNames: [String]) throws -> ExpenseGroup {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedMembers = memberNames.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard !cleanedName.isEmpty, cleanedName.count <= 120,
              (2...20).contains(cleanedMembers.count),
              cleanedMembers.allSatisfy({ !$0.isEmpty && $0.count <= 80 }),
              Set(cleanedMembers.map { $0.lowercased() }).count == cleanedMembers.count else {
            throw GroupLedgerError.invalidGroup
        }
        guard CurrencyUnits.fractionDigits(for: currencyCode) != nil else {
            throw GroupLedgerError.invalidCurrency
        }
        var archive = try readArchive()
        let group = ExpenseGroup(
            name: cleanedName, currencyCode: currencyCode,
            members: cleanedMembers.map { GroupMember(name: $0) }
        )
        archive.groups.append(group)
        try write(archive)
        return group
    }

    @discardableResult
    func addMember(named name: String, to groupID: UUID) throws -> ExpenseGroup {
        var archive = try readArchive()
        guard let index = archive.groups.firstIndex(where: { $0.id == groupID }) else {
            throw ExpenseStoreError.groupMissing
        }
        let cleaned = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, cleaned.count <= 80,
              archive.groups[index].members.count < 20,
              !archive.groups[index].members.contains(where: { $0.name.caseInsensitiveCompare(cleaned) == .orderedSame }) else {
            throw GroupLedgerError.invalidMember
        }
        archive.groups[index].members.append(GroupMember(name: cleaned))
        try write(archive)
        return archive.groups[index]
    }

    @discardableResult
    func recordSettlement(groupID: UUID, fromID: UUID, toID: UUID, amount: Decimal) throws -> ExpenseGroup {
        var archive = try readArchive()
        guard let index = archive.groups.firstIndex(where: { $0.id == groupID }) else {
            throw ExpenseStoreError.groupMissing
        }
        let group = archive.groups[index]
        let units = try CurrencyUnits.units(amount, currencyCode: group.currencyCode)
        guard fromID != toID, units > 0 else { throw GroupLedgerError.invalidSettlement }
        let balances = try GroupLedger.balances(group: group, expenses: archive.expenses)
        guard let from = balances.first(where: { $0.member.id == fromID })?.minorUnits,
              let to = balances.first(where: { $0.member.id == toID })?.minorUnits,
              from < 0, to > 0, units <= min(-from, to) else {
            throw GroupLedgerError.invalidSettlement
        }
        archive.groups[index].settlements.append(GroupSettlement(fromID: fromID, toID: toID, minorUnits: units))
        try write(archive)
        return archive.groups[index]
    }

    @discardableResult
    func save(_ expense: SavedExpense, receiptData: Data? = nil, removeReceipt: Bool = false) throws -> SavedExpense {
        var saved = expense
        saved.merchant = saved.merchant.trimmingCharacters(in: .whitespacesAndNewlines)
        saved.notes = saved.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !saved.merchant.isEmpty, saved.merchant.count <= 120 else { throw ExpenseStoreError.invalidMerchant }
        guard (0...1_000_000_000).contains(saved.amount), saved.amount > 0 else { throw ExpenseStoreError.invalidAmount }
        guard CurrencyUnits.fractionDigits(for: saved.currencyCode) != nil else { throw ExpenseStoreError.invalidCurrency }
        guard saved.notes.count <= 2_000 else { throw ExpenseStoreError.invalidNotes }
        if let receiptData {
            guard !receiptData.isEmpty, receiptData.count <= 10_000_000 else { throw ExpenseStoreError.invalidReceipt }
        }

        var archive = try readArchive()
        if let bill = saved.itemizedBill {
            let calculation = try ItemizedExpenseMapper.calculation(for: bill, currencyCode: saved.currencyCode)
            guard calculation.total == saved.amount else { throw ItemizedExpenseError.amountMismatch }
            if let split = saved.split {
                guard let group = archive.groups.first(where: { $0.id == split.groupID }) else {
                    throw ExpenseStoreError.groupMissing
                }
                let expected = try ItemizedExpenseMapper.split(
                    bill: bill, group: group, payerID: split.payerID,
                    mapping: saved.itemizedMemberMapping
                )
                guard expected == split else { throw ItemizedExpenseError.splitMismatch }
            } else if !saved.itemizedMemberMapping.isEmpty {
                throw ItemizedExpenseError.invalidMapping
            }
        } else if !saved.itemizedMemberMapping.isEmpty {
            throw ItemizedExpenseError.invalidMapping
        }
        if let split = saved.split {
            guard let group = archive.groups.first(where: { $0.id == split.groupID }) else {
                throw ExpenseStoreError.groupMissing
            }
            try ExpenseSplitter.validate(split, for: saved, in: group)
        }
        let previous = archive.expenses.first { $0.id == saved.id }
        let oldFilename = previous?.receiptFilename
        var newFilename: String?
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let receiptData {
            let filename = "\(saved.id.uuidString)-\(UUID().uuidString).jpg"
            try receiptData.write(to: directory.appendingPathComponent(filename), options: .atomic)
            newFilename = filename
            saved.receiptFilename = filename
        } else if removeReceipt {
            saved.receiptFilename = nil
        } else {
            saved.receiptFilename = oldFilename
        }

        archive.expenses.removeAll { $0.id == saved.id }
        archive.expenses.append(saved)
        do {
            try write(archive)
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
        var archive = try readArchive()
        guard let expense = archive.expenses.first(where: { $0.id == id }) else { return }
        archive.expenses.removeAll { $0.id == id }
        try write(archive)
        if let filename = expense.receiptFilename { removeImage(named: filename, for: id) }
    }

    func receiptData(for expense: SavedExpense) throws -> Data? {
        guard let filename = expense.receiptFilename else { return nil }
        guard isManagedImage(filename, for: expense.id) else { throw ExpenseStoreError.invalidReceipt }
        return try Data(contentsOf: directory.appendingPathComponent(filename))
    }

    private func readArchive() throws -> Archive {
        let url = directory.appendingPathComponent("expenses.json")
        guard FileManager.default.fileExists(atPath: url.path) else { return Archive() }
        let archive = try JSONDecoder().decode(Archive.self, from: Data(contentsOf: url))
        guard archive.schemaVersion == 1 || archive.schemaVersion == 2 else {
            throw ExpenseStoreError.unsupportedSchema
        }
        return archive
    }

    private func write(_ archive: Archive) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        var archive = archive
        archive.schemaVersion = 2
        try encoder.encode(archive).write(
            to: directory.appendingPathComponent("expenses.json"), options: .atomic
        )
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
