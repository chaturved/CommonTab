import XCTest

final class SplitTipUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCalculateAndOpenSettings() {
        let app = XCUIApplication()
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

    func testItemizedSplitAndSharedBillNavigation() {
        let app = XCUIApplication()
        app.launch()

        app.buttons["openItemizedBill"].tap()
        let itemName = app.textFields["New item name"]
        XCTAssertTrue(itemName.waitForExistence(timeout: 5))
        itemName.tap()
        itemName.typeText("Coffee")
        let price = app.textFields["Price"]
        price.tap()
        price.typeText("10")
        app.buttons["Add item"].tap()

        XCTAssertTrue(app.staticTexts["Split result"].exists)
        app.buttons["Share or join a bill"].tap()
        XCTAssertTrue(app.navigationBars["Shared bill"].waitForExistence(timeout: 5))
    }
}
