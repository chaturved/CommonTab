import XCTest

final class CommonTabUITests: XCTestCase {
    @MainActor
    func testSharedExpensesEntryShowsAccountForm() {
        let app = isolatedApp()
        app.launch()
        app.buttons["openSharedExpenses"].tap()
        XCTAssertTrue(app.navigationBars["Shared expenses"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["sharedAuthenticate"].exists)
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func isolatedApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["COMMONTAB_UI_TEST_RESET_STATE"] = "1"
        app.launchEnvironment["COMMONTAB_UI_TEST_STORE_ID"] = UUID().uuidString
        return app
    }

    @MainActor
    func testCalculateAndOpenSettings() {
        let app = isolatedApp()
        app.launchArguments = [
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-settings.tipOne", "15", "-settings.tipTwo", "18",
            "-settings.tipThree", "20", "-settings.selectedTip", "0"
        ]
        app.launch()
        app.buttons["openCalculator"].tap()

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
        let app = isolatedApp()
        app.launchArguments = [
            "-AppleLanguages", "(en)", "-AppleLocale", "en_US",
            "-settings.tipOne", "15", "-settings.tipTwo", "18",
            "-settings.tipThree", "20"
        ]
        app.launch()
        app.buttons["openCalculator"].tap()

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
        XCTAssertEqual(customTipField.value as? String, "17.5")
        let total = app.staticTexts["$117.50"]
        for _ in 0..<3 where !total.exists { app.swipeUp() }
        XCTAssertTrue(total.waitForExistence(timeout: 5))
    }

    @MainActor
    func testItemizedSplitAndSharedBillNavigation() {
        let app = isolatedApp()
        app.launch()
        app.buttons["openCalculator"].tap()

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

extension CommonTabUITests {
    @MainActor
    func testSaveManualExpense() {
        let app = isolatedApp()
        app.launch()
        let merchantName = "UI Test Market \(UUID().uuidString.prefix(8))"

        let addExpense = app.buttons["addExpenseFromHome"]
        XCTAssertTrue(addExpense.waitForExistence(timeout: 5))
        addExpense.tap()

        let merchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(merchant.waitForExistence(timeout: 5))
        merchant.tap()
        merchant.typeText(merchantName)
        let amount = app.textFields["expenseAmount"]
        amount.tap()
        amount.typeText("12.34")
        app.buttons["saveExpense"].tap()

        let savedExpense = app.staticTexts[merchantName]
        for _ in 0..<3 where !savedExpense.exists { app.swipeUp() }
        XCTAssertTrue(savedExpense.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["$12.34"].exists)
        savedExpense.tap()
        XCTAssertTrue(app.navigationBars[merchantName].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["editExpense"].exists)
    }
}

extension CommonTabUITests {
    @MainActor
    func testSaveItemizedBillAsExpense() {
        let app = isolatedApp()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        app.buttons["openCalculator"].tap()
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


extension CommonTabUITests {
    @MainActor
    func testExpenseHomeCreatesGroup() {
        let app = isolatedApp()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["addExpenseFromHome"].waitForExistence(timeout: 5))
        app.buttons["createGroupFromHome"].tap()

        let name = "Trip \(UUID().uuidString.prefix(8))"
        let groupName = app.textFields["groupName"]
        XCTAssertTrue(groupName.waitForExistence(timeout: 5))
        groupName.tap()
        groupName.typeText(name)
        app.buttons["saveGroup"].tap()

        XCTAssertTrue(app.staticTexts[name].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["2 members · Settled"].exists)
    }
}

extension CommonTabUITests {
    @MainActor
    func testEditAndDeleteSavedExpense() {
        let app = isolatedApp()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        app.buttons["addExpenseFromHome"].tap()
        let merchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(merchant.waitForExistence(timeout: 5))
        merchant.tap()
        merchant.typeText("Market purchase")
        let amount = app.textFields["expenseAmount"]
        amount.tap()
        amount.typeText("12.34")
        app.buttons["saveExpense"].tap()
        XCTAssertTrue(app.staticTexts["Market purchase"].waitForExistence(timeout: 5))
        app.staticTexts["Market purchase"].tap()
        XCTAssertTrue(app.buttons["editExpense"].waitForExistence(timeout: 5))
        app.buttons["editExpense"].tap()
        let editedMerchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(editedMerchant.waitForExistence(timeout: 5))
        editedMerchant.tap()
        let oldValue = editedMerchant.value as? String ?? ""
        editedMerchant.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: oldValue.count) + "Updated market")
        app.buttons["saveExpense"].tap()
        XCTAssertTrue(app.navigationBars["Updated market"].waitForExistence(timeout: 5))

        app.navigationBars["Updated market"].buttons.element(boundBy: 0).tap()
        app.buttons["openExpenseLibrary"].tap()
        XCTAssertTrue(app.navigationBars["Expenses"].waitForExistence(timeout: 5))
        let row = app.cells.containing(.staticText, identifier: "Updated market").firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.swipeLeft()
        app.buttons["Delete"].tap()
        XCTAssertFalse(row.waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["No saved expenses"].exists)
    }

    @MainActor
    func testLocalGroupExpenseAndSettlement() {
        let app = isolatedApp()
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        app.buttons["createGroupFromHome"].tap()
        let name = app.textFields["groupName"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Weekend trip")
        app.buttons["saveGroup"].tap()
        XCTAssertTrue(app.staticTexts["Weekend trip"].waitForExistence(timeout: 5))
        app.staticTexts["Weekend trip"].tap()
        XCTAssertTrue(app.buttons["addGroupExpense"].waitForExistence(timeout: 5))
        app.buttons["addGroupExpense"].tap()
        let merchant = app.textFields["expenseMerchant"]
        XCTAssertTrue(merchant.waitForExistence(timeout: 5))
        merchant.tap()
        merchant.typeText("Cab fare")
        let amount = app.textFields["expenseAmount"]
        amount.tap()
        amount.typeText("10")
        app.buttons["saveExpense"].tap()
        XCTAssertTrue(app.staticTexts["Cab fare"].waitForExistence(timeout: 5))
        let settle = app.buttons["Record settlement"]
        XCTAssertTrue(settle.waitForExistence(timeout: 5))
        settle.tap()
        let settlementAmount = app.textFields["settlementAmount"]
        XCTAssertTrue(settlementAmount.waitForExistence(timeout: 5))
        settlementAmount.tap()
        settlementAmount.typeText("5")
        app.buttons["saveSettlement"].tap()
        XCTAssertTrue(app.staticTexts["Friend paid You"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Record settlement"].isEnabled)
    }

    @MainActor
    func testReceiptScannerNeedsAnImageBeforeUse() {
        let app = isolatedApp()
        app.launch()
        app.buttons["addExpenseFromHome"].tap()
        let scan = app.buttons["Scan receipt"]
        for _ in 0..<3 where !scan.isHittable { app.swipeUp() }
        XCTAssertTrue(scan.waitForExistence(timeout: 5))
        scan.tap()
        XCTAssertTrue(app.navigationBars["Scan receipt"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Choose photo"].exists)
        XCTAssertFalse(app.buttons["useScannedAmount"].isEnabled)
        app.navigationBars["Scan receipt"].buttons["Cancel"].tap()
        XCTAssertTrue(app.navigationBars["Add expense"].waitForExistence(timeout: 5))
    }
}
