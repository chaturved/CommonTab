import Foundation

struct ItemizedMemberMapping: Codable, Equatable {
    var billPersonID: UUID
    var groupMemberID: UUID
}

enum ItemizedExpenseError: Error, Equatable {
    case invalidCurrency
    case invalidMapping
    case amountMismatch
    case splitMismatch
}

enum ItemizedExpenseMapper {
    static func calculation(for bill: ItemizedBill, currencyCode: String) throws -> ItemizedCalculation {
        guard let digits = CurrencyUnits.fractionDigits(for: currencyCode) else {
            throw ItemizedExpenseError.invalidCurrency
        }
        return try ItemizedBillCalculator.calculate(bill, fractionDigits: digits)
    }

    static func split(
        bill: ItemizedBill, group: ExpenseGroup, payerID: UUID,
        mapping: [ItemizedMemberMapping]
    ) throws -> ExpenseSplit {
        guard group.members.contains(where: { $0.id == payerID }) else {
            throw ItemizedExpenseError.invalidMapping
        }
        let personIDs = bill.people.map(\.id)
        let mappedPeople = mapping.map(\.billPersonID)
        let mappedMembers = mapping.map(\.groupMemberID)
        guard mapping.count == personIDs.count,
              Set(mappedPeople) == Set(personIDs),
              Set(mappedPeople).count == mappedPeople.count,
              Set(mappedMembers).count == mappedMembers.count,
              Set(mappedMembers).isSubset(of: Set(group.members.map(\.id))) else {
            throw ItemizedExpenseError.invalidMapping
        }
        let result = try calculation(for: bill, currencyCode: group.currencyCode)
        let memberForPerson = Dictionary(uniqueKeysWithValues: mapping.map { ($0.billPersonID, $0.groupMemberID) })
        let values = Dictionary(uniqueKeysWithValues: result.shares.map { share in
            (memberForPerson[share.person.id]!, share.total)
        })
        let participants = group.members.map(\.id).filter { values[$0] != nil }
        let allocations = try ExpenseSplitter.allocate(
            amount: result.total, currencyCode: group.currencyCode,
            participants: participants, method: .exact, values: values
        )
        return ExpenseSplit(groupID: group.id, payerID: payerID, method: .exact, allocations: allocations)
    }
}
