import Foundation

enum ReceiptItemParser {
    private static let trailingPrice = try? NSRegularExpression(
        pattern: #"(?:[$€£₹]\s*)?((?:\d{1,3}(?:[.,]\d{3})*|\d+)[.,]\d{2})\s*$"#
    )
    private static let summaryPrefixes = [
        "subtotal", "sub total", "total", "tax", "tip", "gratuity", "amount due",
        "balance", "change", "cash", "card", "visa", "mastercard", "discount"
    ]

    static func items(in lines: [String], assignedPersonIDs: [UUID]) -> [BillItem] {
        guard let trailingPrice else { return [] }
        return lines.compactMap { line in
            let text = line.trimmingCharacters(in: .whitespacesAndNewlines)
            let lower = text.lowercased()
            guard !summaryPrefixes.contains(where: { lower.hasPrefix($0) }) else { return nil }

            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            guard let match = trailingPrice.firstMatch(in: text, range: range),
                  let priceRange = Range(match.range(at: 1), in: text),
                  let amount = ReceiptAmountParser.candidates(in: [text]).first?.amount,
                  amount > 0 else { return nil }

            let name = text[..<priceRange.lowerBound]
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: ".:-$€£₹ "))
            guard name.count >= 2, name.rangeOfCharacter(from: .letters) != nil else {
                return nil
            }
            return BillItem(name: name, price: amount, assignedPersonIDs: assignedPersonIDs)
        }
    }
}
