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

// Coordinates domain rules and repositories. Views do not know the local file format.
struct ExpenseStore {
    private let archiveRepository: any ExpenseArchiveRepository
    private let receiptRepository: any ReceiptImageRepository

    init(directory: URL? = nil) {
        let defaultDirectory = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("SplitTip/Expenses", isDirectory: true)
        let testDirectory = ProcessInfo.processInfo.environment["COMMONTAB_UI_TEST_STORE_ID"]
            .flatMap(UUID.init(uuidString:))
            .map { FileManager.default.temporaryDirectory
                .appendingPathComponent("CommonTabUITests", isDirectory: true)
                .appendingPathComponent($0.uuidString, isDirectory: true) }
        let directory = directory ?? testDirectory ?? defaultDirectory
        self.init(
            archiveRepository: JSONExpenseArchiveRepository(directory: directory),
            receiptRepository: FileReceiptImageRepository(directory: directory)
        )
    }

    init(archiveRepository: any ExpenseArchiveRepository, receiptRepository: any ReceiptImageRepository) {
        self.archiveRepository = archiveRepository
        self.receiptRepository = receiptRepository
    }

    func load() throws -> [SavedExpense] {
        try archiveRepository.read().expenses.sorted { $0.date > $1.date }
    }

    func loadGroups() throws -> [ExpenseGroup] {
        try archiveRepository.read().groups.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    @discardableResult
    func createGroup(name: String, currencyCode: String, memberNames: [String]) throws -> ExpenseGroup {
        let group = try ExpenseValidation.group(name: name, currencyCode: currencyCode, memberNames: memberNames)
        var archive = try archiveRepository.read()
        archive.groups.append(group)
        try archiveRepository.write(archive)
        return group
    }

    @discardableResult
    func addMember(named name: String, to groupID: UUID) throws -> ExpenseGroup {
        var archive = try archiveRepository.read()
        guard let index = archive.groups.firstIndex(where: { $0.id == groupID }) else {
            throw ExpenseStoreError.groupMissing
        }
        archive.groups[index].members.append(try ExpenseValidation.member(named: name, in: archive.groups[index]))
        try archiveRepository.write(archive)
        return archive.groups[index]
    }

    @discardableResult
    func recordSettlement(groupID: UUID, fromID: UUID, toID: UUID, amount: Decimal) throws -> ExpenseGroup {
        var archive = try archiveRepository.read()
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
        try archiveRepository.write(archive)
        return archive.groups[index]
    }

    @discardableResult
    func save(_ expense: SavedExpense, receiptData: Data? = nil, removeReceipt: Bool = false) throws -> SavedExpense {
        var archive = try archiveRepository.read()
        var saved = try ExpenseValidation.expense(expense, groups: archive.groups, receiptData: receiptData)
        let oldFilename = archive.expenses.first(where: { $0.id == saved.id })?.receiptFilename
        var newFilename: String?
        if let receiptData {
            newFilename = try receiptRepository.save(receiptData, for: saved.id)
            saved.receiptFilename = newFilename
        } else {
            saved.receiptFilename = removeReceipt ? nil : oldFilename
        }
        archive.expenses.removeAll { $0.id == saved.id }
        archive.expenses.append(saved)
        do {
            try archiveRepository.write(archive)
        } catch {
            if let newFilename { receiptRepository.remove(named: newFilename, for: saved.id) }
            throw error
        }
        if oldFilename != saved.receiptFilename, let oldFilename {
            receiptRepository.remove(named: oldFilename, for: saved.id)
        }
        return saved
    }

    func delete(_ id: UUID) throws {
        var archive = try archiveRepository.read()
        guard let expense = archive.expenses.first(where: { $0.id == id }) else { return }
        archive.expenses.removeAll { $0.id == id }
        try archiveRepository.write(archive)
        if let filename = expense.receiptFilename {
            receiptRepository.remove(named: filename, for: id)
        }
    }

    func receiptData(for expense: SavedExpense) throws -> Data? {
        guard let filename = expense.receiptFilename else { return nil }
        return try receiptRepository.load(named: filename, for: expense.id)
    }
}
