import Foundation

enum ExpenseCategory: String, CaseIterable, Codable, Identifiable {
    case groceries, dining, travel, shopping, household, health, other

    var id: String { rawValue }

    var title: String {
        switch self {
        case .groceries: "Groceries"
        case .dining: "Dining"
        case .travel: "Travel"
        case .shopping: "Shopping"
        case .household: "Household"
        case .health: "Health"
        case .other: "Other"
        }
    }
}

struct SavedExpense: Codable, Equatable, Identifiable {
    var id: UUID
    var merchant: String
    var date: Date
    var category: ExpenseCategory
    var currencyCode: String
    var amount: Decimal
    var notes: String
    var receiptFilename: String?
    var split: ExpenseSplit?

    init(
        id: UUID = UUID(), merchant: String, date: Date = .now,
        category: ExpenseCategory = .other, currencyCode: String,
        amount: Decimal, notes: String = "", receiptFilename: String? = nil,
        split: ExpenseSplit? = nil
    ) {
        self.id = id
        self.merchant = merchant
        self.date = date
        self.category = category
        self.currencyCode = currencyCode
        self.amount = amount
        self.notes = notes
        self.receiptFilename = receiptFilename
        self.split = split
    }

    private enum CodingKeys: String, CodingKey {
        case id, merchant, date, category, currencyCode, amount, notes, receiptFilename, split
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        merchant = try values.decode(String.self, forKey: .merchant)
        date = try values.decode(Date.self, forKey: .date)
        category = try values.decode(ExpenseCategory.self, forKey: .category)
        currencyCode = try values.decode(String.self, forKey: .currencyCode)
        let amountText = try values.decode(String.self, forKey: .amount)
        guard let parsed = Decimal(string: amountText, locale: Locale(identifier: "en_US_POSIX")) else {
            throw DecodingError.dataCorruptedError(forKey: .amount, in: values, debugDescription: "Invalid amount")
        }
        amount = parsed
        notes = try values.decode(String.self, forKey: .notes)
        receiptFilename = try values.decodeIfPresent(String.self, forKey: .receiptFilename)
        split = try values.decodeIfPresent(ExpenseSplit.self, forKey: .split)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(id, forKey: .id)
        try values.encode(merchant, forKey: .merchant)
        try values.encode(date, forKey: .date)
        try values.encode(category, forKey: .category)
        try values.encode(currencyCode, forKey: .currencyCode)
        try values.encode(NSDecimalNumber(decimal: amount).stringValue, forKey: .amount)
        try values.encode(notes, forKey: .notes)
        try values.encodeIfPresent(receiptFilename, forKey: .receiptFilename)
        try values.encodeIfPresent(split, forKey: .split)
    }
}
