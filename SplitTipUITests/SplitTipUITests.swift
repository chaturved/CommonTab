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
