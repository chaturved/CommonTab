// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SplitTipCore",
    defaultLocalization: "en",
    platforms: [.iOS(.v18), .macOS(.v12)],
    products: [.library(name: "SplitTipCore", targets: ["SplitTipCore"])],
    targets: [
        .target(
            name: "SplitTipCore",
            path: "SplitTip",
            exclude: ["App", "Features", "Platform", "Resources", "Data/Local/BillSessionCredentialStore.swift"],
            sources: [
                "Domain/Calculations/TipCalculation.swift",
                "Data/Remote/ExchangeRateService.swift",
                "Domain/Parsing/ReceiptAmountParser.swift",
                "Domain/Parsing/MoneyInputParser.swift",
                "Domain/Models/ItemizedBill.swift",
                "Domain/Parsing/ReceiptItemParser.swift",
                "Data/Remote/BillSessionClient.swift",
                "Data/Remote/GroupExpenseDTO.swift",
                "Data/Remote/GroupExpenseClient.swift",
                "Data/Remote/ServerURLValidator.swift",
                "Data/Local/AccountCredentialStore.swift",
                "Data/Remote/ProductAnalytics.swift",
                "Domain/Models/SavedExpense.swift",
                "Application/ExpenseStore.swift",
                "Data/Local/ExpensePersistence.swift",
                "Domain/Validation/ExpenseValidation.swift",
                "Domain/Models/ExpenseGroup.swift",
                "Domain/Calculations/ItemizedExpenseMapper.swift"
            ]
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
