import XCTest

final class SplitTipUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testCalculateAndOpenSettings() {
        let app = XCUIApplication()
        app.launchEnvironment["SPLITTIP_UI_TEST_RESET_STATE"] = "1"
        app.launchArguments = [
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-settings.tipOne", "15", "-settings.tipTwo", "18",
            "-settings.tipThree", "20", "-settings.selectedTip", "0"
        ]
        app.launch()

        let billField = app.textFields["billAmount"]
        XCTAssertTrue(billField.waitForExistence(timeout: 5))
        billField.tap()
        billField.typeText("100")

        XCTAssertTrue(app.staticTexts["$115.00"].waitForExistence(timeout: 5))

        app.buttons["openSettings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.switches["Dark appearance"].exists)
    }

    @MainActor
    func testCustomTipPercentage() {
        let app = XCUIApplication()
        app.launchEnvironment["SPLITTIP_UI_TEST_RESET_STATE"] = "1"
        app.launchArguments = [
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-settings.tipOne", "15", "-settings.tipTwo", "18",
            "-settings.tipThree", "20"
        ]
        app.launch()

        let billField = app.textFields["billAmount"]
        XCTAssertTrue(billField.waitForExistence(timeout: 5))
        billField.tap()
        billField.typeText("100")

        let tipPicker = app.segmentedControls["tipPercentage"]
        tipPicker.buttons["15%"].tap()
        tipPicker.buttons["Other"].tap()
        let customTipField = app.textFields["customTipPercentage"]
        XCTAssertTrue(customTipField.waitForExistence(timeout: 5))
        customTipField.tap()
        let existingValue = customTipField.value as? String ?? ""
        customTipField.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existingValue.count) + "17.5")
        XCTAssertTrue(app.staticTexts["$117.50"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testItemizedSplitAndSharedBillNavigation() {
        let app = XCUIApplication()
        app.launchEnvironment["SPLITTIP_UI_TEST_RESET_STATE"] = "1"
        app.launch()

        app.buttons["openItemizedBill"].tap()
        XCTAssertTrue(app.navigationBars["Itemized split"].waitForExistence(timeout: 15))
        let itemName = app.textFields["New item name"]
        for _ in 0..<3 where !itemName.exists {
            app.swipeUp()
        }
        XCTAssertTrue(itemName.waitForExistence(timeout: 15))
        itemName.tap()
        itemName.typeText("Coffee")
        let price = app.textFields["newItemPrice"]
        price.tap()
        price.typeText("10")
        app.buttons["Add item"].tap()

        XCTAssertTrue(app.staticTexts["Split result"].exists)
        app.swipeUp()
        let sharedBillLink = app.buttons["openSharedBill"]
        XCTAssertTrue(sharedBillLink.waitForExistence(timeout: 5))
        sharedBillLink.tap()
        XCTAssertTrue(app.navigationBars["Shared bill"].waitForExistence(timeout: 5))
    }
}

extension SplitTipUITests {
    @MainActor
    func testSaveManualExpense() {
        let app = XCUIApplication()
        app.launchEnvironment["SPLITTIP_UI_TEST_RESET_STATE"] = "1"
        app.launch()
        let merchantName = "UI Test Market \(UUID().uuidString.prefix(8))"

        let library = app.buttons["openExpenseLibrary"]
        if !library.isHittable { app.swipeUp() }
        XCTAssertTrue(library.waitForExistence(timeout: 5))
        library.tap()
        XCTAssertTrue(app.navigationBars["Expenses"].waitForExistence(timeout: 5))
        app.buttons["addExpense"].tap()

        let merchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(merchant.waitForExistence(timeout: 5))
        merchant.tap()
        merchant.typeText(merchantName)
        let amount = app.textFields["expenseAmount"]
        amount.tap()
        amount.typeText("12.34")
        app.buttons["saveExpense"].tap()

        XCTAssertTrue(app.staticTexts[merchantName].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["$12.34"].exists)
    }
}

extension SplitTipUITests {
    @MainActor
    func testSaveItemizedBillAsExpense() {
        let app = XCUIApplication()
        app.launchEnvironment["SPLITTIP_UI_TEST_RESET_STATE"] = "1"
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        app.buttons["openItemizedBill"].tap()

        let itemName = app.textFields["New item name"]
        XCTAssertTrue(itemName.waitForExistence(timeout: 5))
        itemName.tap()
        itemName.typeText("Coffee")
        let price = app.textFields["newItemPrice"]
        price.tap()
        price.typeText("10")
        app.buttons["Add item"].tap()

        let saveBill = app.buttons["saveItemizedExpense"]
        if !saveBill.isHittable { app.swipeUp() }
        XCTAssertTrue(saveBill.waitForExistence(timeout: 5))
        saveBill.tap()
        let merchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(merchant.waitForExistence(timeout: 5))
        merchant.tap()
        let current = merchant.value as? String ?? ""
        let name = "Itemized UI Test \(UUID().uuidString.prefix(8))"
        merchant.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count) + name)
        app.buttons["saveExpense"].tap()
        XCTAssertTrue(app.staticTexts["Saved to Expenses"].waitForExistence(timeout: 5))
    }
}
