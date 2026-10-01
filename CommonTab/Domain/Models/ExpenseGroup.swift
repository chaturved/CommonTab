import Foundation

struct GroupMember: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var name: String
}

struct GroupSettlement: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var date: Date = .now
    var fromID: UUID
    var toID: UUID
    var minorUnits: Int64
}

struct ExpenseGroup: Codable, Equatable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var currencyCode: String
    var members: [GroupMember]
    var settlements: [GroupSettlement] = []
}

enum ExpenseSplitMethod: String, Codable, CaseIterable, Identifiable {
    case equal, exact, percentage
    var id: String { rawValue }
    var title: String {
        switch self {
        case .equal: "Equally"
        case .exact: "Exact amounts"
        case .percentage: "Percentages"
        }
    }
}

struct SplitAllocation: Codable, Equatable, Identifiable {
    var memberID: UUID
    var minorUnits: Int64
    var inputValue: String?
    var id: UUID { memberID }
}

struct ExpenseSplit: Codable, Equatable {
    var groupID: UUID
    var payerID: UUID
    var method: ExpenseSplitMethod
    var allocations: [SplitAllocation]
}

enum GroupLedgerError: Error, Equatable {
    case invalidGroup
    case invalidMember
    case invalidCurrency
    case invalidAmount
    case invalidParticipants
    case invalidAllocation
    case invalidPercentage
    case invalidSettlement
}

enum CurrencyUnits {
    static func fractionDigits(for currencyCode: String) -> Int? {
        guard currencyCode.count == 3,
              currencyCode.utf8.allSatisfy({ (65...90).contains($0) }) else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        let digits = formatter.maximumFractionDigits
        return (0...3).contains(digits) ? digits : nil
    }

    static func units(_ amount: Decimal, currencyCode: String) throws -> Int64 {
        guard let digits = fractionDigits(for: currencyCode), amount >= 0,
              amount <= 1_000_000_000 else { throw GroupLedgerError.invalidAmount }
        var source = amount
        var rounded = Decimal()
        NSDecimalRound(&rounded, &source, digits, .plain)
        guard rounded == amount else { throw GroupLedgerError.invalidAmount }
        let scale = Decimal(sign: .plus, exponent: digits, significand: 1)
        return NSDecimalNumber(decimal: amount * scale).int64Value
    }

    static func amount(_ units: Int64, currencyCode: String) -> Decimal {
        let digits = fractionDigits(for: currencyCode) ?? 2
        let scale = Decimal(sign: .plus, exponent: digits, significand: 1)
        return Decimal(units) / scale
    }
}

enum ExpenseSplitter {
    static func allocate(
        amount: Decimal, currencyCode: String, participants: [UUID],
        method: ExpenseSplitMethod, values: [UUID: Decimal] = [:]
    ) throws -> [SplitAllocation] {
        guard !participants.isEmpty, participants.count <= 20,
              Set(participants).count == participants.count else { throw GroupLedgerError.invalidParticipants }
        let total = try CurrencyUnits.units(amount, currencyCode: currencyCode)
        guard total > 0 else { throw GroupLedgerError.invalidAmount }

        switch method {
        case .equal:
            let quotient = total / Int64(participants.count)
            let remainder = Int(total % Int64(participants.count))
            return participants.enumerated().map { index, id in
                SplitAllocation(memberID: id, minorUnits: quotient + (index < remainder ? 1 : 0))
            }
        case .exact:
            guard values.count == participants.count, Set(values.keys) == Set(participants) else {
                throw GroupLedgerError.invalidAllocation
            }
            let allocations = try participants.map { id -> SplitAllocation in
                guard let value = values[id] else { throw GroupLedgerError.invalidAllocation }
                let units = try CurrencyUnits.units(value, currencyCode: currencyCode)
                return SplitAllocation(
                    memberID: id, minorUnits: units,
                    inputValue: NSDecimalNumber(decimal: value).stringValue
                )
            }
            guard allocations.reduce(Int64(0), { $0 + $1.minorUnits }) == total else {
                throw GroupLedgerError.invalidAllocation
            }
            return allocations
        case .percentage:
            guard values.count == participants.count, Set(values.keys) == Set(participants),
                  values.values.allSatisfy({ (0...100).contains($0) }),
                  values.values.reduce(Decimal(0), +) == 100 else {
                throw GroupLedgerError.invalidPercentage
            }
            let exact = participants.map { Decimal(total) * values[$0]! / 100 }
            var units = exact.map { value -> Int64 in
                var source = value
                var rounded = Decimal()
                NSDecimalRound(&rounded, &source, 0, .down)
                return NSDecimalNumber(decimal: rounded).int64Value
            }
            let remainder = Int(total - units.reduce(Int64(0), +))
            let order = participants.indices.sorted {
                let left = exact[$0] - Decimal(units[$0])
                let right = exact[$1] - Decimal(units[$1])
                return left == right ? $0 < $1 : left > right
            }
            for index in order.prefix(remainder) { units[index] += 1 }
            return participants.enumerated().map { index, id in
                SplitAllocation(
                    memberID: id, minorUnits: units[index],
                    inputValue: NSDecimalNumber(decimal: values[id]!).stringValue
                )
            }
        }
    }

    static func validate(_ split: ExpenseSplit, for expense: SavedExpense, in group: ExpenseGroup) throws {
        guard split.groupID == group.id,
              group.members.contains(where: { $0.id == split.payerID }),
              expense.currencyCode == group.currencyCode else { throw GroupLedgerError.invalidGroup }
        let ids = split.allocations.map(\.memberID)
        guard !ids.isEmpty, Set(ids).count == ids.count,
              Set(ids).isSubset(of: Set(group.members.map(\.id))),
              split.allocations.allSatisfy({ $0.minorUnits >= 0 }),
              split.allocations.reduce(Int64(0), { $0 + $1.minorUnits }) ==
                (try CurrencyUnits.units(expense.amount, currencyCode: expense.currencyCode)) else {
            throw GroupLedgerError.invalidAllocation
        }
        var values: [UUID: Decimal] = [:]
        if split.method != .equal {
            for allocation in split.allocations {
                guard let text = allocation.inputValue,
                      let value = Decimal(string: text, locale: Locale(identifier: "en_US_POSIX")) else {
                    throw GroupLedgerError.invalidAllocation
                }
                values[allocation.memberID] = value
            }
        }
        let expected = try allocate(
            amount: expense.amount, currencyCode: expense.currencyCode,
            participants: ids, method: split.method, values: values
        )
        guard expected == split.allocations else { throw GroupLedgerError.invalidAllocation }
    }
}

struct GroupBalance: Equatable {
    let member: GroupMember
    let minorUnits: Int64
}

enum GroupLedger {
    static func balances(group: ExpenseGroup, expenses: [SavedExpense]) throws -> [GroupBalance] {
        var amounts = Dictionary(uniqueKeysWithValues: group.members.map { ($0.id, Int64(0)) })
        for expense in expenses where expense.split?.groupID == group.id {
            guard let split = expense.split else { continue }
            try ExpenseSplitter.validate(split, for: expense, in: group)
            amounts[split.payerID, default: 0] += try CurrencyUnits.units(expense.amount, currencyCode: expense.currencyCode)
            for allocation in split.allocations {
                amounts[allocation.memberID, default: 0] -= allocation.minorUnits
            }
        }
        for settlement in group.settlements {
            guard settlement.fromID != settlement.toID, settlement.minorUnits > 0,
                  amounts[settlement.fromID] != nil, amounts[settlement.toID] != nil else {
                throw GroupLedgerError.invalidSettlement
            }
            amounts[settlement.fromID, default: 0] += settlement.minorUnits
            amounts[settlement.toID, default: 0] -= settlement.minorUnits
        }
        return group.members.map { GroupBalance(member: $0, minorUnits: amounts[$0.id] ?? 0) }
    }
}
