import Foundation

enum MoneyInputParser {
    static func parse(_ text: String, locale: Locale = .current) -> Decimal? {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.generatesDecimalNumbers = true
        formatter.isLenient = false
        return (formatter.number(from: text) as? NSDecimalNumber)?.decimalValue
    }
}
