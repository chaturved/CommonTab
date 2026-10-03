// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CommonTabCore",
    defaultLocalization: "en",
    platforms: [.iOS(.v18), .macOS(.v12)],
    products: [.library(name: "CommonTabCore", targets: ["CommonTabCore"])],
    targets: [
        .target(
            name: "CommonTabCore",
            path: "CommonTab",
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
            name: "CommonTabCoreTests",
            dependencies: ["CommonTabCore"],
            path: "CommonTabTests",
            exclude: ["Info.plist"],
            sources: ["CommonTabTests.swift"]
        )
    ]
)
