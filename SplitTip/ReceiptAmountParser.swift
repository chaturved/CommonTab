import Foundation

struct ReceiptAmount: Identifiable, Equatable {
    let id: Int
    let line: String
    let amount: Decimal
}

enum ReceiptAmountParser {
    private static let amountPattern = try? NSRegularExpression(
        pattern: #"(?<!\d)(?:\d{1,3}(?:[.,]\d{3})*|\d+)[.,]\d{2}(?!\d)"#
    )

    static func candidates(in lines: [String]) -> [ReceiptAmount] {
        guard let amountPattern else { return [] }
        let found: [ReceiptAmount] = lines.enumerated().compactMap { index, line -> ReceiptAmount? in
            let range = NSRange(line.startIndex..<line.endIndex, in: line)
            guard let match = amountPattern.matches(in: line, range: range).last,
                  let swiftRange = Range(match.range, in: line),
                  let amount = parseNumber(String(line[swiftRange])),
                  amount > 0 else { return nil }
            return ReceiptAmount(id: index, line: line, amount: amount)
        }
        return found.sorted { left, right in
            let leftScore = score(left.line)
            let rightScore = score(right.line)
            if leftScore != rightScore { return leftScore > rightScore }
            return left.id < right.id
        }
    }

    private static func score(_ line: String) -> Int {
        let text = line.lowercased()
        if text.contains("subtotal") { return 1 }
        if text.contains("total") || text.contains("amount due") { return 2 }
        return 0
    }

    private static func parseNumber(_ text: String) -> Decimal? {
        guard let separator = text.lastIndex(where: { $0 == "." || $0 == "," }) else {
            return nil
        }
        let whole = text[..<separator].filter { $0.isNumber }
        let cents = text[text.index(after: separator)...]
        return Decimal(string: "\(whole).\(cents)")
    }
}
