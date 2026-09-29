import XCTest
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
#if SWIFT_PACKAGE
@testable import SplitTipCore
#else
@testable import SplitTip
#endif

final class SplitTipTests: XCTestCase {
    func testTipAndTotal() throws {
        let result = try TipCalculator.calculate(bill: 100, tipPercentage: 18, people: 2)

        XCTAssertEqual(result.tip, 18)
        XCTAssertEqual(result.total, 118)
        XCTAssertEqual(result.shares.map(\.total), [59, 59])
    }

    func testFractionalTipPercentage() throws {
        let result = try TipCalculator.calculate(
            bill: 100, tipPercentage: Decimal(string: "17.5")!, people: 2
        )

        XCTAssertEqual(result.tip, Decimal(string: "17.50"))
        XCTAssertEqual(result.total, Decimal(string: "117.50"))
        XCTAssertEqual(result.shares.map(\.total), [Decimal(string: "58.75"), Decimal(string: "58.75")].compactMap { $0 })
    }

    func testRemainderIsDistributedWithoutLosingMoney() throws {
        let result = try TipCalculator.calculate(bill: 100, tipPercentage: 10, people: 3)

        XCTAssertEqual(result.shares.map(\.bill), ["33.34", "33.33", "33.33"].compactMap { Decimal(string: $0) })
        XCTAssertEqual(result.shares.map(\.tip), ["3.34", "3.33", "3.33"].compactMap { Decimal(string: $0) })
        XCTAssertEqual(result.shares.reduce(Decimal(0)) { $0 + $1.total }, result.total)
    }

    func testCurrencyWithoutMinorUnits() throws {
        let result = try TipCalculator.calculate(
            bill: 101, tipPercentage: 10, people: 3, fractionDigits: 0
        )

        XCTAssertEqual(result.tip, 10)
        XCTAssertEqual(result.shares.map(\.total), [38, 37, 36])
    }

    func testInvalidInputs() {
        XCTAssertThrowsError(try TipCalculator.calculate(bill: -1, tipPercentage: 15, people: 1)) {
            XCTAssertEqual($0 as? TipCalculationError, .negativeBill)
        }
        XCTAssertThrowsError(try TipCalculator.calculate(bill: 10, tipPercentage: 101, people: 1)) {
            XCTAssertEqual($0 as? TipCalculationError, .invalidTipPercentage)
        }
        XCTAssertThrowsError(try TipCalculator.calculate(bill: 10, tipPercentage: 15, people: 0)) {
            XCTAssertEqual($0 as? TipCalculationError, .invalidPeopleCount)
        }
        XCTAssertThrowsError(try TipCalculator.calculate(bill: 1_000_000_001, tipPercentage: 15, people: 1)) {
            XCTAssertEqual($0 as? TipCalculationError, .excessiveBill)
        }
    }

    func testExchangeRateDecoding() async throws {
        let service = ExchangeRateService { url in
            let json = Data(#"{"date":"2026-09-29","base":"USD","quote":"EUR","rate":0.85}"#.utf8)
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (json, response)
        }

        let rate = try await service.rate(from: "USD", to: "EUR")
        XCTAssertEqual(rate.rate, Decimal(string: "0.85"))
        XCTAssertEqual(rate.date, "2026-09-29")
    }

    func testExchangeRateRejectsServerError() async {
        let service = ExchangeRateService { url in
            let response = HTTPURLResponse(url: url, statusCode: 503, httpVersion: nil, headerFields: nil)!
            return (Data(), response)
        }

        do {
            _ = try await service.rate(from: "USD", to: "EUR")
            XCTFail("Expected the server error to be reported")
        } catch {
            XCTAssertEqual(error as? ExchangeRateError, .invalidResponse)
        }
    }

    func testReceiptAmountParserPrioritizesTotalOverSubtotal() {
        let candidates = ReceiptAmountParser.candidates(in: [
            "Coffee 4.50", "Subtotal $12.50", "Tax $1.00", "TOTAL $13.50"
        ])

        XCTAssertEqual(candidates.first?.amount, Decimal(string: "13.50"))
        XCTAssertEqual(candidates.count, 4)
    }

    func testReceiptAmountParserIgnoresMalformedAmounts() {
        let candidates = ReceiptAmountParser.candidates(in: ["Order #12345", "Discount 10%"])

        XCTAssertTrue(candidates.isEmpty)
    }

    func testReceiptAmountParserHandlesDifferentSeparators() {
        let candidates = ReceiptAmountParser.candidates(in: [
            "TOTAL €1.234,56", "TOTAL $1,234.56", "TOTAL 12,50"
        ])

        XCTAssertEqual(candidates.map(\.amount), [
            Decimal(string: "1234.56"), Decimal(string: "1234.56"), Decimal(string: "12.50")
        ].compactMap { $0 })
    }

    func testMoneyInputParserUsesLocaleAndRejectsPartialNumbers() {
        XCTAssertEqual(
            MoneyInputParser.parse("1,234.56", locale: Locale(identifier: "en_US")),
            Decimal(string: "1234.56")
        )
        XCTAssertEqual(
            MoneyInputParser.parse("1.234,56", locale: Locale(identifier: "de_DE")),
            Decimal(string: "1234.56")
        )
        XCTAssertNil(MoneyInputParser.parse("12.3.4", locale: Locale(identifier: "en_US")))
    }

    func testItemizedBillAllocatesTaxAndTipProportionally() throws {
        let alice = BillPerson(name: "Alice")
        let bob = BillPerson(name: "Bob")
        let bill = ItemizedBill(
            people: [alice, bob],
            items: [
                BillItem(name: "Pasta", price: 20, assignedPersonIDs: [alice.id]),
                BillItem(name: "Salad", price: 10, assignedPersonIDs: [bob.id])
            ],
            tax: 3,
            tipPercentage: 20
        )

        let result = try ItemizedBillCalculator.calculate(bill)
        XCTAssertEqual(result.total, 39)
        XCTAssertEqual(result.shares.map(\.total), [26, 13])
        XCTAssertEqual(result.shares.map(\.tax), [2, 1])
        XCTAssertEqual(result.shares.map(\.tip), [4, 2])
    }

    func testSharedItemAndRemaindersStillAddToTotal() throws {
        let people = (1...3).map { BillPerson(name: "Person \($0)") }
        let bill = ItemizedBill(
            people: people,
            items: [BillItem(name: "Fries", price: Decimal(string: "10.01")!,
                             assignedPersonIDs: people.map(\.id))],
            tax: Decimal(string: "0.99")!,
            tipPercentage: 15
        )

        let result = try ItemizedBillCalculator.calculate(bill)
        XCTAssertEqual(result.subtotal, Decimal(string: "10.01"))
        XCTAssertEqual(result.tip, Decimal(string: "1.50"))
        XCTAssertEqual(result.shares.reduce(Decimal(0)) { $0 + $1.total }, result.total)
    }

    func testItemizedBillRequiresAssignments() {
        let person = BillPerson(name: "Alice")
        let bill = ItemizedBill(
            people: [person],
            items: [BillItem(name: "Coffee", price: 5, assignedPersonIDs: [])]
        )

        XCTAssertThrowsError(try ItemizedBillCalculator.calculate(bill)) {
            XCTAssertEqual($0 as? ItemizedBillError, .unassignedItem)
        }
    }

    func testReceiptItemParserSkipsSummaryLines() {
        let person = BillPerson(name: "Alice")
        let items = ReceiptItemParser.items(in: [
            "Pasta $14.50", "Coffee 3,25", "Subtotal 17.75", "TOTAL $19.31"
        ], assignedPersonIDs: [person.id])

        XCTAssertEqual(items.map(\.name), ["Pasta", "Coffee"])
        XCTAssertEqual(items.map(\.price), [Decimal(string: "14.50"), Decimal(string: "3.25")].compactMap { $0 })
    }

    func testItemizedBillJSONRoundTripPreservesDecimals() throws {
        let person = BillPerson(name: "Alex")
        let bill = ItemizedBill(
            people: [person],
            items: [BillItem(name: "Tea", price: Decimal(string: "2.35")!, assignedPersonIDs: [person.id])],
            tax: Decimal(string: "0.19")!,
            tipPercentage: Decimal(string: "18.5")!,
            receiptTotal: Decimal(string: "2.54")!
        )
        let data = try JSONEncoder().encode(bill)
        XCTAssertEqual(try JSONDecoder().decode(ItemizedBill.self, from: data), bill)
        XCTAssertTrue(String(decoding: data, as: UTF8.self).contains("\"price\":\"2.35\""))
    }

    func testSharedBillClientCreateFetchUpdateAndConflict() async throws {
        let person = BillPerson(name: "Alex")
        let bill = ItemizedBill(
            people: [person],
            items: [BillItem(name: "Tea", price: 3, assignedPersonIDs: [person.id])]
        )
        let id = UUID()
        let token = "test_secret"
        let created = CreatedBillSession(
            id: id, accessToken: token, version: 1, expiresAt: "2026-10-01T00:00:00Z", bill: bill
        )
        let client = try SharedBillClient(baseURL: URL(string: "https://example.com/api")!) { request in
            XCTAssertEqual(request.url?.path, "/api/v1/sessions" + (request.httpMethod == "POST" ? "" : "/\(id.uuidString)"))
            let response: HTTPURLResponse
            let data: Data
            switch request.httpMethod {
            case "POST":
                XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
                data = try JSONEncoder().encode(created)
                response = HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!
            case "GET":
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
                data = try JSONEncoder().encode(created.session)
                response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            default:
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer \(token)")
                XCTAssertEqual(request.httpMethod, "PUT")
                data = Data()
                response = HTTPURLResponse(url: request.url!, statusCode: 409, httpVersion: nil, headerFields: nil)!
            }
            return (data, response)
        }

        let session = try await client.create(bill)
        let credentials = try XCTUnwrap(BillSessionCredentials(inviteCode: session.inviteCode))
        let fetched = try await client.fetch(credentials)
        XCTAssertEqual(fetched, created.session)
        do {
            _ = try await client.update(bill, version: 1, credentials: credentials)
            XCTFail("Expected version conflict")
        } catch {
            XCTAssertEqual(error as? SharedBillClientError, .conflict)
        }
    }

    func testSharedBillClientRejectsUntrustedHTTPAndBadCodes() {
        XCTAssertThrowsError(try SharedBillClient(baseURL: URL(string: "http://example.com")!))
        XCTAssertNil(BillSessionCredentials(inviteCode: "invalid"))
        XCTAssertNil(BillSessionCredentials(inviteCode: "\(UUID().uuidString).bad token"))
    }

    func testAnalyticsSendsOnlyAllowedEventAndVariant() async throws {
        let analytics = try ProductAnalytics(serverURL: URL(string: "https://example.com")!) { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/v1/events")
            let payload = try XCTUnwrap(request.httpBody)
            let object = try XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: String])
            XCTAssertEqual(object, ["name": "scan_opened", "variant": "B"])
            let response = HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!
            return (Data(), response)
        }
        try await analytics.record(.scanOpened, variant: "B")
    }
}
