// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SplitTipCore",
    defaultLocalization: "en",
    platforms: [.iOS(.v16), .macOS(.v12)],
    products: [.library(name: "SplitTipCore", targets: ["SplitTipCore"])],
    targets: [
        .target(
            name: "SplitTipCore",
            path: "SplitTip",
            exclude: ["SplitTipApp.swift", "CalculatorView.swift", "SettingsView.swift",
                      "ItemizedBillView.swift", "SharedBillView.swift", "SharedSessionStore.swift",
                      "ReceiptOCR.swift", "ReceiptScannerView.swift",
                      "Info.plist", "Base.lproj", "Assets.xcassets"],
            sources: ["TipCalculation.swift", "ExchangeRateService.swift", "ReceiptAmountParser.swift",
                      "MoneyInputParser.swift", "ItemizedBill.swift", "ReceiptItemParser.swift",
                      "SharedBillClient.swift", "ProductAnalytics.swift"]
        ),
        .testTarget(
            name: "SplitTipCoreTests",
            dependencies: ["SplitTipCore"],
            path: "SplitTipTests",
            exclude: ["Info.plist"],
            sources: ["SplitTipTests.swift"]
        )
    ]
)
