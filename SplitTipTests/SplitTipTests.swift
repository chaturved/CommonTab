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

    func testBillSessionClientCreateFetchUpdateAndConflict() async throws {
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
        let client = try BillSessionClient(baseURL: URL(string: "https://example.com/api")!) { request in
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
            XCTAssertEqual(error as? BillSessionClientError, .conflict)
        }
    }

    func testBillSessionClientRejectsUntrustedHTTPAndBadCodes() {
        XCTAssertThrowsError(try BillSessionClient(baseURL: URL(string: "http://example.com")!))
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

extension SplitTipTests {
    func testExpenseStorePersistsReceiptAndEditsWithoutLosingIt() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = ExpenseStore(directory: directory)
        let original = SavedExpense(
            merchant: "Market", category: .groceries, currencyCode: "USD",
            amount: Decimal(string: "23.45")!, notes: "Weekly groceries"
        )
        let image = Data([0xFF, 0xD8, 0xFF, 0xD9])
        let saved = try store.save(original, receiptData: image)
        XCTAssertEqual(try store.load(), [saved])
        XCTAssertEqual(try store.receiptData(for: saved), image)
        XCTAssertTrue(try Data(contentsOf: directory.appendingPathComponent("expenses.json"))
            .range(of: Data("\"amount\":\"23.45\"".utf8)) != nil)

        var edited = saved
        edited.notes = "Corrected note"
        let updated = try store.save(edited)
        XCTAssertEqual(updated.receiptFilename, saved.receiptFilename)
        XCTAssertEqual(try store.receiptData(for: updated), image)

        let withoutReceipt = try store.save(updated, removeReceipt: true)
        XCTAssertNil(withoutReceipt.receiptFilename)
        XCTAssertNil(try store.receiptData(for: withoutReceipt))
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.appendingPathComponent(saved.receiptFilename!).path))
        try store.delete(withoutReceipt.id)
        XCTAssertTrue(try store.load().isEmpty)
    }

    func testExpenseStoreRejectsInvalidInputWithoutSaving() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = ExpenseStore(directory: directory)
        XCTAssertThrowsError(try store.save(SavedExpense(merchant: " ", currencyCode: "USD", amount: 1))) {
            XCTAssertEqual($0 as? ExpenseStoreError, .invalidMerchant)
        }
        XCTAssertThrowsError(try store.save(SavedExpense(merchant: "Shop", currencyCode: "USD", amount: -1))) {
            XCTAssertEqual($0 as? ExpenseStoreError, .invalidAmount)
        }
        XCTAssertThrowsError(try store.save(SavedExpense(merchant: "Shop", currencyCode: "US", amount: 1))) {
            XCTAssertEqual($0 as? ExpenseStoreError, .invalidCurrency)
        }
        XCTAssertTrue(try store.load().isEmpty)
    }
}

extension SplitTipTests {
    func testGroupSplitsPreserveEveryCentAcrossModes() throws {
        let ids = (0..<3).map { _ in UUID() }
        let equal = try ExpenseSplitter.allocate(
            amount: Decimal(string: "10.01")!, currencyCode: "USD", participants: ids, method: .equal
        )
        XCTAssertEqual(equal.map(\.minorUnits), [334, 334, 333])
        let percentage = try ExpenseSplitter.allocate(
            amount: Decimal(string: "0.05")!, currencyCode: "USD", participants: ids,
            method: .percentage, values: [ids[0]: 34, ids[1]: 33, ids[2]: 33]
        )
        XCTAssertEqual(percentage.map(\.minorUnits), [2, 2, 1])
        let exact = try ExpenseSplitter.allocate(
            amount: Decimal(string: "10.01")!, currencyCode: "USD", participants: ids,
            method: .exact, values: [ids[0]: 5, ids[1]: 5, ids[2]: Decimal(string: "0.01")!]
        )
        XCTAssertEqual(exact.map(\.minorUnits), [500, 500, 1])
        XCTAssertThrowsError(try ExpenseSplitter.allocate(
            amount: 10, currencyCode: "USD", participants: ids,
            method: .exact, values: [ids[0]: 5, ids[1]: 5, ids[2]: 1]
        ))
        XCTAssertEqual(try CurrencyUnits.units(123, currencyCode: "JPY"), 123)
        XCTAssertThrowsError(try CurrencyUnits.units(Decimal(string: "123.45")!, currencyCode: "JPY"))
    }

    func testGroupLedgerAndSettlementPersist() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = ExpenseStore(directory: directory)
        let group = try store.createGroup(name: "Apartment", currencyCode: "USD", memberNames: ["Alex", "Blair", "Casey"])
        let ids = group.members.map(\.id)
        let allocations = try ExpenseSplitter.allocate(
            amount: Decimal(string: "10.01")!, currencyCode: "USD", participants: ids, method: .equal
        )
        let expense = SavedExpense(
            merchant: "Groceries", currencyCode: "USD", amount: Decimal(string: "10.01")!,
            split: ExpenseSplit(groupID: group.id, payerID: ids[0], method: .equal, allocations: allocations)
        )
        try store.save(expense)
        let before = try GroupLedger.balances(group: group, expenses: store.load())
        XCTAssertEqual(before.map(\.minorUnits), [667, -334, -333])
        XCTAssertEqual(before.map(\.minorUnits).reduce(0, +), 0)

        let settled = try store.recordSettlement(
            groupID: group.id, fromID: ids[1], toID: ids[0], amount: Decimal(string: "3.34")!
        )
        XCTAssertEqual(try GroupLedger.balances(group: settled, expenses: store.load()).map(\.minorUnits), [333, 0, -333])
        XCTAssertEqual(try store.loadGroups().first?.settlements.count, 1)
        XCTAssertThrowsError(try store.recordSettlement(groupID: group.id, fromID: ids[1], toID: ids[0], amount: 1))

        var revised = expense
        revised.amount = Decimal(string: "20.01")!
        revised.split?.allocations = try ExpenseSplitter.allocate(
            amount: revised.amount, currencyCode: "USD", participants: ids, method: .equal
        )
        try store.save(revised)
        let afterEdit = try GroupLedger.balances(group: settled, expenses: store.load())
        XCTAssertEqual(afterEdit.map(\.minorUnits), [1000, -333, -667])
        var invalid = revised
        invalid.split?.allocations[0].memberID = UUID()
        XCTAssertThrowsError(try store.save(invalid))
        XCTAssertEqual(try store.load(), [revised])
    }

    func testLegacyExpenseArchiveMigratesWhenGroupIsCreated() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let expense = SavedExpense(merchant: "Old receipt", currencyCode: "USD", amount: 7)
        let encoded = try JSONEncoder().encode(expense)
        let legacy = Data("{\"schemaVersion\":1,\"expenses\":[\(String(decoding: encoded, as: UTF8.self))]}".utf8)
        try legacy.write(to: directory.appendingPathComponent("expenses.json"))

        let store = ExpenseStore(directory: directory)
        XCTAssertEqual(try store.load(), [expense])
        XCTAssertTrue(try store.loadGroups().isEmpty)
        _ = try store.createGroup(name: "Trip", currencyCode: "USD", memberNames: ["Alex", "Blair"])
        XCTAssertEqual(try store.load(), [expense])
        XCTAssertEqual(try store.loadGroups().count, 1)
    }
}

extension SplitTipTests {
    func testScannedItemizedBillKeepsReceiptTotalUntilExtraTipIsChosen() throws {
        let person = BillPerson(name: "Alex")
        var bill = ItemizedBill(people: [person], tipPercentage: 18)
        bill.useScannedItems([
            BillItem(name: "Meal", price: 30, assignedPersonIDs: [person.id])
        ], total: 36)

        let scanned = try ItemizedBillCalculator.calculate(bill)
        XCTAssertEqual(scanned.tax, 6)
        XCTAssertEqual(scanned.tip, 0)
        XCTAssertEqual(scanned.total, bill.receiptTotal)

        bill.tipPercentage = 20
        XCTAssertEqual(try ItemizedBillCalculator.calculate(bill).total, 42)
    }

    func testItemizedBillBecomesSavedGroupExpenseWithExactShares() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = ExpenseStore(directory: directory)
        let group = try store.createGroup(name: "Dinner", currencyCode: "USD", memberNames: ["Blair", "Alex"])
        let alice = BillPerson(name: "Alice")
        let bob = BillPerson(name: "Bob")
        let bill = ItemizedBill(
            people: [alice, bob],
            items: [
                BillItem(name: "Pasta", price: 20, assignedPersonIDs: [alice.id]),
                BillItem(name: "Salad", price: 10, assignedPersonIDs: [bob.id])
            ], tax: 3, tipPercentage: 20
        )
        let mapping = [
            ItemizedMemberMapping(billPersonID: alice.id, groupMemberID: group.members[1].id),
            ItemizedMemberMapping(billPersonID: bob.id, groupMemberID: group.members[0].id)
        ]
        let split = try ItemizedExpenseMapper.split(
            bill: bill, group: group, payerID: group.members[1].id, mapping: mapping
        )
        XCTAssertEqual(split.allocations.map(\.minorUnits), [1300, 2600])
        let expense = SavedExpense(
            merchant: "Dinner", category: .dining, currencyCode: "USD", amount: 39,
            split: split, itemizedBill: bill, itemizedMemberMapping: mapping
        )
        let receipt = Data([0xFF, 0xD8, 0xFF, 0xD9])
        let saved = try store.save(expense, receiptData: receipt)
        XCTAssertEqual(try store.load(), [saved])
        XCTAssertEqual(try store.receiptData(for: saved), receipt)
        XCTAssertEqual(try GroupLedger.balances(group: group, expenses: store.load()).map(\.minorUnits), [-1300, 1300])

        var wrongTotal = saved
        wrongTotal.amount = 40
        XCTAssertThrowsError(try store.save(wrongTotal)) {
            XCTAssertEqual($0 as? ItemizedExpenseError, .amountMismatch)
        }
        var wrongMapping = saved
        wrongMapping.itemizedMemberMapping[1].groupMemberID = group.members[1].id
        XCTAssertThrowsError(try store.save(wrongMapping)) {
            XCTAssertEqual($0 as? ItemizedExpenseError, .invalidMapping)
        }
        XCTAssertEqual(try store.load(), [saved])

        var edited = saved
        edited.itemizedBill!.items[0].price = 30
        edited.amount = 51
        edited.split = try ItemizedExpenseMapper.split(
            bill: edited.itemizedBill!, group: group,
            payerID: group.members[1].id, mapping: mapping
        )
        let updated = try store.save(edited)
        XCTAssertEqual(try store.load(), [updated])
        XCTAssertEqual(try store.receiptData(for: updated), receipt)
        XCTAssertEqual(updated.split?.allocations.map(\.minorUnits), [1275, 3825])
        XCTAssertEqual(try GroupLedger.balances(group: group, expenses: store.load()).map(\.minorUnits), [-1275, 1275])
    }
}

private final class FailingExpenseArchiveRepository: ExpenseArchiveRepository {
    var archive = ExpenseArchive()
    var failWrites = false

    func read() throws -> ExpenseArchive { archive }

    func write(_ archive: ExpenseArchive) throws {
        if failWrites { throw CocoaError(.fileWriteUnknown) }
        self.archive = archive
    }
}

extension SplitTipTests {
    func testArchiveWriteFailureRollsBackNewReceiptAndKeepsExistingData() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let archive = FailingExpenseArchiveRepository()
        let store = ExpenseStore(
            archiveRepository: archive,
            receiptRepository: FileReceiptImageRepository(directory: directory)
        )
        let original = try store.save(
            SavedExpense(merchant: "Market", currencyCode: "USD", amount: 10),
            receiptData: Data([1, 2, 3])
        )
        archive.failWrites = true
        var edited = original
        edited.notes = "New note"
        XCTAssertThrowsError(try store.save(edited, receiptData: Data([4, 5, 6])))
        XCTAssertEqual(try store.load(), [original])
        XCTAssertEqual(try store.receiptData(for: original), Data([1, 2, 3]))
        let imageFiles = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertEqual(imageFiles, [try XCTUnwrap(original.receiptFilename)])
    }
}

final class GroupExpenseClientTests: XCTestCase {
    func testRegisterSendsAccountAndDecodesSession() async throws {
        let userID = UUID()
        let json = #"{"accessToken":"token-123","expiresAt":"2026-10-30T00:00:00Z","user":{"id":"\#(userID)","email":"ada@example.com","name":"Ada"}}"#
        let client = try GroupExpenseClient(baseURL: URL(string: "https://example.com")!) { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.url?.path, "/v1/accounts")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            let body = try XCTUnwrap(request.httpBody)
            let account = try JSONSerialization.jsonObject(with: body) as? [String: String]
            XCTAssertEqual(account?["email"], "ada@example.com")
            return (Data(json.utf8), HTTPURLResponse(url: request.url!, statusCode: 201,
                                                      httpVersion: nil, headerFields: nil)!)
        }
        let session = try await client.register(email: "ada@example.com", name: "Ada",
                                                password: "correct horse battery staple")
        XCTAssertEqual(session.user.id, userID)
        XCTAssertEqual(session.accessToken, "token-123")
    }

    func testDeleteExpenseIncludesVersionAndAuthorization() async throws {
        let id = UUID()
        let groupID = UUID()
        let json = #"{"id":"\#(id)","groupID":"\#(groupID)","merchant":"Lunch","occurredAt":"2026-09-30T00:00:00Z","category":"dining","notes":"","amountMinor":1250,"payerID":"\#(UUID())","method":"equal","allocations":[],"values":[],"version":4,"hasReceipt":false}"#
        let expense = try JSONDecoder().decode(APIExpense.self, from: Data(json.utf8))
        let client = try GroupExpenseClient(baseURL: URL(string: "https://example.com")!) { request in
            XCTAssertEqual(request.httpMethod, "DELETE")
            XCTAssertEqual(request.url?.path, "/v1/groups/\(groupID)/expenses/\(id)")
            XCTAssertEqual(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?
                .queryItems?.first?.value, "4")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer secret")
            return (Data(), HTTPURLResponse(url: request.url!, statusCode: 204,
                                            httpVersion: nil, headerFields: nil)!)
        }
        try await client.deleteExpense(expense, token: "secret")
    }

    func testRejectsInsecureRemoteURL() {
        XCTAssertThrowsError(try GroupExpenseClient(baseURL: URL(string: "http://example.com")!))
    }
}
