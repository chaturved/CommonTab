import Foundation

enum ExpenseValidation {
    static func group(name: String, currencyCode: String, memberNames: [String]) throws -> ExpenseGroup {
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
        return ExpenseGroup(
            name: cleanedName, currencyCode: currencyCode,
            members: cleanedMembers.map { GroupMember(name: $0) }
        )
    }

    static func member(named name: String, in group: ExpenseGroup) throws -> GroupMember {
        let cleaned = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, cleaned.count <= 80, group.members.count < 20,
              !group.members.contains(where: { $0.name.caseInsensitiveCompare(cleaned) == .orderedSame }) else {
            throw GroupLedgerError.invalidMember
        }
        return GroupMember(name: cleaned)
    }

    static func expense(_ expense: SavedExpense, groups: [ExpenseGroup], receiptData: Data?) throws -> SavedExpense {
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

        if let bill = saved.itemizedBill {
            let calculation = try ItemizedExpenseMapper.calculation(for: bill, currencyCode: saved.currencyCode)
            guard calculation.total == saved.amount else { throw ItemizedExpenseError.amountMismatch }
            if let split = saved.split {
                guard let group = groups.first(where: { $0.id == split.groupID }) else {
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
            guard let group = groups.first(where: { $0.id == split.groupID }) else {
                throw ExpenseStoreError.groupMissing
            }
            try ExpenseSplitter.validate(split, for: saved, in: group)
        }
        return saved
    }
}
