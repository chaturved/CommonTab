import Foundation

struct BillPerson: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String

    init(id: UUID = UUID(), name: String) {
        self.id = id
        self.name = name
    }
}

struct BillItem: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
    var price: Decimal
    var assignedPersonIDs: [UUID]

    init(id: UUID = UUID(), name: String, price: Decimal, assignedPersonIDs: [UUID]) {
        self.id = id
        self.name = name
        self.price = price
        self.assignedPersonIDs = assignedPersonIDs
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, price, assignedPersonIDs
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        name = try values.decode(String.self, forKey: .name)
        let priceText = try values.decode(String.self, forKey: .price)
        guard let parsed = Decimal(string: priceText) else {
            throw DecodingError.dataCorruptedError(forKey: .price, in: values, debugDescription: "Invalid price")
        }
        price = parsed
        assignedPersonIDs = try values.decode([UUID].self, forKey: .assignedPersonIDs)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(name, forKey: .name)
        try values.encode(NSDecimalNumber(decimal: price).stringValue, forKey: .price)
        try values.encode(assignedPersonIDs, forKey: .assignedPersonIDs)
    }
}

struct ItemizedBill: Codable, Equatable {
    var people: [BillPerson]
    var items: [BillItem]
    var tax: Decimal
    var tipPercentage: Decimal
    var receiptTotal: Decimal?

    init(
        people: [BillPerson] = [BillPerson(name: "Person 1"), BillPerson(name: "Person 2")],
        items: [BillItem] = [],
        tax: Decimal = 0,
        tipPercentage: Decimal = 18,
        receiptTotal: Decimal? = nil
    ) {
        self.people = people
        self.items = items
        self.tax = tax
        self.tipPercentage = tipPercentage
        self.receiptTotal = receiptTotal
    }

    mutating func useScannedItems(_ items: [BillItem], total: Decimal) {
        self.items = items
        receiptTotal = total
        tipPercentage = 0
        let subtotal = items.reduce(Decimal(0)) { $0 + $1.price }
        tax = max(0, total - subtotal)
    }

    private enum CodingKeys: String, CodingKey {
        case people, items, tax, tipPercentage, receiptTotal
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        people = try values.decode([BillPerson].self, forKey: .people)
        items = try values.decode([BillItem].self, forKey: .items)
        tax = try Self.decodeDecimal(.tax, from: values)
        tipPercentage = try Self.decodeDecimal(.tipPercentage, from: values)
        if values.contains(.receiptTotal), !(try values.decodeNil(forKey: .receiptTotal)) {
            receiptTotal = try Self.decodeDecimal(.receiptTotal, from: values)
        } else {
            receiptTotal = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(people, forKey: .people)
        try values.encode(items, forKey: .items)
        try values.encode(NSDecimalNumber(decimal: tax).stringValue, forKey: .tax)
        try values.encode(NSDecimalNumber(decimal: tipPercentage).stringValue, forKey: .tipPercentage)
        try values.encodeIfPresent(receiptTotal.map { NSDecimalNumber(decimal: $0).stringValue }, forKey: .receiptTotal)
    }

    private static func decodeDecimal(
        _ key: CodingKeys,
        from values: KeyedDecodingContainer<CodingKeys>
    ) throws -> Decimal {
        let text = try values.decode(String.self, forKey: key)
        guard let parsed = Decimal(string: text) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: values, debugDescription: "Invalid amount")
        }
        return parsed
    }
}

struct ItemizedShare: Equatable {
    let person: BillPerson
    let subtotal: Decimal
    let tax: Decimal
    let tip: Decimal

    var total: Decimal { subtotal + tax + tip }
}

struct ItemizedCalculation: Equatable {
    let subtotal: Decimal
    let tax: Decimal
    let tip: Decimal
    let shares: [ItemizedShare]

    var total: Decimal { subtotal + tax + tip }
}

enum ItemizedBillError: Error, Equatable {
    case noPeople
    case noItems
    case invalidItem
    case unassignedItem
    case unknownPerson
    case invalidTax
    case invalidTipPercentage
    case invalidFractionDigits
}

enum ItemizedBillCalculator {
    static func calculate(_ bill: ItemizedBill, fractionDigits: Int = 2) throws -> ItemizedCalculation {
        guard !bill.people.isEmpty, bill.people.count <= 20,
              Set(bill.people.map(\.id)).count == bill.people.count else {
            throw ItemizedBillError.noPeople
        }
        guard !bill.items.isEmpty, bill.items.count <= 100 else {
            throw ItemizedBillError.noItems
        }
        guard (0...1_000_000_000).contains(bill.tax) else {
            throw ItemizedBillError.invalidTax
        }
        guard (0...100).contains(bill.tipPercentage) else {
            throw ItemizedBillError.invalidTipPercentage
        }
        guard (0...3).contains(fractionDigits) else {
            throw ItemizedBillError.invalidFractionDigits
        }

        let personIDs = bill.people.map(\.id)
        let knownIDs = Set(personIDs)
        var subtotalUnits = Array(repeating: Int64(0), count: bill.people.count)

        for item in bill.items {
            guard !item.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  (0...1_000_000_000).contains(item.price) else {
                throw ItemizedBillError.invalidItem
            }
            guard !item.assignedPersonIDs.isEmpty else {
                throw ItemizedBillError.unassignedItem
            }
            let assigned = Set(item.assignedPersonIDs)
            guard assigned.isSubset(of: knownIDs) else {
                throw ItemizedBillError.unknownPerson
            }
            let indices = personIDs.indices.filter { assigned.contains(personIDs[$0]) }
            let itemUnits = minorUnits(item.price, fractionDigits: fractionDigits)
            let quotient = itemUnits / Int64(indices.count)
            let remainder = Int(itemUnits % Int64(indices.count))
            for (position, index) in indices.enumerated() {
                subtotalUnits[index] += quotient + (position < remainder ? 1 : 0)
            }
        }

        let taxUnits = minorUnits(bill.tax, fractionDigits: fractionDigits)
        let subtotal = subtotalUnits.reduce(Int64(0), +)
        let subtotalDecimal = decimal(subtotal, fractionDigits: fractionDigits)
        let tipUnits = minorUnits(
            subtotalDecimal * bill.tipPercentage / 100,
            fractionDigits: fractionDigits
        )
        let taxShares = allocate(taxUnits, weights: subtotalUnits)
        let tipShares = allocate(tipUnits, weights: subtotalUnits)

        let shares = bill.people.indices.map { index in
            ItemizedShare(
                person: bill.people[index],
                subtotal: decimal(subtotalUnits[index], fractionDigits: fractionDigits),
                tax: decimal(taxShares[index], fractionDigits: fractionDigits),
                tip: decimal(tipShares[index], fractionDigits: fractionDigits)
            )
        }
        return ItemizedCalculation(
            subtotal: subtotalDecimal,
            tax: decimal(taxUnits, fractionDigits: fractionDigits),
            tip: decimal(tipUnits, fractionDigits: fractionDigits),
            shares: shares
        )
    }

    private static func minorUnits(_ amount: Decimal, fractionDigits: Int) -> Int64 {
        var source = amount
        var rounded = Decimal()
        NSDecimalRound(&rounded, &source, fractionDigits, .plain)
        let scale = Decimal(sign: .plus, exponent: fractionDigits, significand: 1)
        return NSDecimalNumber(decimal: rounded * scale).int64Value
    }

    private static func decimal(_ units: Int64, fractionDigits: Int) -> Decimal {
        let scale = Decimal(sign: .plus, exponent: fractionDigits, significand: 1)
        return Decimal(units) / scale
    }

    private static func allocate(_ amount: Int64, weights: [Int64]) -> [Int64] {
        guard amount > 0 else { return Array(repeating: 0, count: weights.count) }
        let totalWeight = weights.reduce(Int64(0), +)
        if totalWeight == 0 {
            let quotient = amount / Int64(weights.count)
            let remainder = Int(amount % Int64(weights.count))
            return weights.indices.map { quotient + ($0 < remainder ? 1 : 0) }
        }

        let exact = weights.map { Decimal(amount) * Decimal($0) / Decimal(totalWeight) }
        let whole = exact.map { value -> Int64 in
            var source = value
            var rounded = Decimal()
            NSDecimalRound(&rounded, &source, 0, .down)
            return NSDecimalNumber(decimal: rounded).int64Value
        }
        var result = whole
        let remaining = Int(amount - whole.reduce(Int64(0), +))
        let order = weights.indices.sorted {
            let left = exact[$0] - Decimal(whole[$0])
            let right = exact[$1] - Decimal(whole[$1])
            return left == right ? $0 < $1 : left > right
        }
        for index in order.prefix(remaining) {
            result[index] += 1
        }
        return result
    }
}
