import Foundation

struct PersonShare: Equatable {
    let bill: Decimal
    let tip: Decimal

    var total: Decimal { bill + tip }
}

struct TipCalculation: Equatable {
    let bill: Decimal
    let tip: Decimal
    let total: Decimal
    let shares: [PersonShare]
}

enum TipCalculationError: Error, Equatable {
    case negativeBill
    case excessiveBill
    case invalidTipPercentage
    case invalidPeopleCount
    case invalidFractionDigits
}

enum TipCalculator {
    static func calculate(
        bill: Decimal,
        tipPercentage: Decimal,
        people: Int,
        fractionDigits: Int = 2
    ) throws -> TipCalculation {
        guard bill >= 0 else { throw TipCalculationError.negativeBill }
        guard bill <= 1_000_000_000 else { throw TipCalculationError.excessiveBill }
        guard (0...100).contains(tipPercentage) else {
            throw TipCalculationError.invalidTipPercentage
        }
        guard (1...1_000).contains(people) else {
            throw TipCalculationError.invalidPeopleCount
        }
        guard (0...3).contains(fractionDigits) else {
            throw TipCalculationError.invalidFractionDigits
        }

        let roundedBill = round(bill, fractionDigits: fractionDigits)
        let tip = round(roundedBill * tipPercentage / 100, fractionDigits: fractionDigits)
        let billShares = distribute(roundedBill, among: people, fractionDigits: fractionDigits)
        let tipShares = distribute(tip, among: people, fractionDigits: fractionDigits)
        let shares = zip(billShares, tipShares).map { PersonShare(bill: $0, tip: $1) }

        return TipCalculation(
            bill: roundedBill,
            tip: tip,
            total: roundedBill + tip,
            shares: shares
        )
    }

    private static func round(_ amount: Decimal, fractionDigits: Int) -> Decimal {
        var source = amount
        var result = Decimal()
        NSDecimalRound(&result, &source, fractionDigits, .plain)
        return result
    }

    private static func distribute(
        _ amount: Decimal,
        among people: Int,
        fractionDigits: Int
    ) -> [Decimal] {
        let scale = Decimal(sign: .plus, exponent: fractionDigits, significand: 1)
        let minorUnits = NSDecimalNumber(decimal: amount * scale).int64Value
        let quotient = minorUnits / Int64(people)
        let remainder = Int(minorUnits % Int64(people))

        return (0..<people).map { index in
            Decimal(quotient + (index < remainder ? 1 : 0)) / scale
        }
    }
}
