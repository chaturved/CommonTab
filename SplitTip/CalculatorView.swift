import SwiftUI

struct CalculatorView: View {
    @AppStorage("settings.tipOne") private var tipOne = 15
    @AppStorage("settings.tipTwo") private var tipTwo = 18
    @AppStorage("settings.tipThree") private var tipThree = 20
    @AppStorage("settings.selectedTip") private var selectedTip = 0
    @AppStorage("settings.customTip") private var customTip = "18"
    @AppStorage("settings.converterEnabled") private var converterEnabled = false
    @AppStorage("settings.targetCurrency") private var targetCurrency = "EUR"
    @AppStorage("calculator.lastBill") private var lastBill = ""
    @AppStorage("calculator.lastEditedAt") private var lastEditedAt = 0.0
    @AppStorage("bill.itemizedDraft") private var itemizedDraftData = Data()
    @AppStorage("settings.serverURL") private var serverURL = "http://localhost:8000"
    @AppStorage("analytics.enabled") private var analyticsEnabled = false
    @AppStorage("experiment.scanEntryVariant") private var scanVariant = ""

    @State private var billText = ""
    @State private var people = 1
    @State private var exchangeRate: ExchangeRate?
    @State private var exchangeError: String?
    @State private var showingScanner = false
    @State private var showingItemizedEditor = false
    @State private var openEditorAfterScan = false
    @State private var itemizedBill = ItemizedBill()
    @State private var scannedReceiptData: Data?
    @FocusState private var billIsFocused: Bool

    @State private var rateService = ExchangeRateService()
    private var currencyCode: String { Locale.current.currency?.identifier ?? "USD" }
    private var tipOptions: [Int] { [tipOne, tipTwo, tipThree] }
    private var selectedPercentage: Decimal? {
        if selectedTip == 3 {
            guard let percentage = MoneyInputParser.parse(customTip), (0...100).contains(percentage) else { return nil }
            return percentage
        }
        return Decimal(tipOptions.indices.contains(selectedTip) ? tipOptions[selectedTip] : tipOne)
    }

    private var enteredBill: Decimal? {
        guard let bill = MoneyInputParser.parse(billText), (0...1_000_000_000).contains(bill) else { return nil }
        return bill
    }

    private var calculation: TipCalculation? {
        guard let bill = enteredBill, let selectedPercentage else { return nil }
        return try? TipCalculator.calculate(
            bill: bill,
            tipPercentage: selectedPercentage,
            people: people,
            fractionDigits: currencyFormatter.maximumFractionDigits
        )
    }

    private var currencyFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        return formatter
    }

    var body: some View {
        Form {
            Section("Bill") {
                HStack {
                    Text(currencyCode)
                        .foregroundStyle(.secondary)
                    TextField("Amount", text: $billText)
                        .keyboardType(.decimalPad)
                        .focused($billIsFocused)
                        .accessibilityIdentifier("billAmount")
                }
                if !billText.isEmpty && enteredBill == nil {
                    Text("Enter a valid amount from 0 to 1,000,000,000.")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }

            Section("Tip") {
                Picker("Tip percentage", selection: $selectedTip) {
                    ForEach(tipOptions.indices, id: \.self) { index in
                        Text("\(tipOptions[index])%").tag(index)
                    }
                    Text("Other").tag(3)
                }
                .pickerStyle(.segmented)
                .accessibilityIdentifier("tipPercentage")
                if selectedTip == 3 {
                    HStack {
                        TextField("Custom tip", text: $customTip)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("customTipPercentage")
                        Text("%")
                            .foregroundStyle(.secondary)
                    }
                    if selectedPercentage == nil {
                        Text("Enter a tip percentage from 0 to 100.")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }

            Section("Split") {
                Stepper("People: \(people)", value: $people, in: 1...20)
                    .accessibilityIdentifier("peopleCount")
            }

            Section("Itemized bill") {
                Button {
                    showingItemizedEditor = true
                    track(.itemizedOpened)
                } label: {
                    Label("Assign items to people", systemImage: "list.bullet.rectangle")
                }
                .accessibilityIdentifier("openItemizedBill")
                if scanVariant == "B" {
                    Button {
                        showingScanner = true
                        track(.scanOpened)
                    } label: {
                        Label("Scan and split a receipt", systemImage: "doc.text.viewfinder")
                    }
                }
            }

            Section("Expenses") {
                NavigationLink {
                    ExpenseLibraryView()
                } label: {
                    Label("Saved expenses and receipts", systemImage: "receipt")
                }
                .accessibilityIdentifier("openExpenseLibrary")
            }

            if let calculation {
                Section("Total") {
                    amountRow("Tip", amount: calculation.tip)
                    amountRow("Bill and tip", amount: calculation.total, emphasized: true)
                        .accessibilityIdentifier("totalAmount")
                }

                if people > 1 {
                    Section("Per person") {
                        ForEach(calculation.shares.indices, id: \.self) { index in
                            amountRow("Person \(index + 1)", amount: calculation.shares[index].total)
                        }
                    }
                }

                if converterEnabled {
                    Section("Currency estimate") {
                        conversionContent(total: calculation.total)
                    }
                }
            }
        }
        .navigationTitle("SplitTip")
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    showingScanner = true
                    track(.scanOpened)
                } label: {
                    Label("Scan receipt", systemImage: "camera.viewfinder")
                }
                .accessibilityIdentifier("scanReceipt")
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                .accessibilityIdentifier("openSettings")
            }
        }
        .onAppear {
            if scanVariant.isEmpty { scanVariant = Bool.random() ? "A" : "B" }
            track(.calculatorOpened)
            if ProcessInfo.processInfo.environment["SPLITTIP_UI_TEST_RESET_STATE"] == "1" {
                lastBill = ""
                lastEditedAt = 0
                itemizedDraftData = Data()
                itemizedBill = ItemizedBill()
                scannedReceiptData = nil
            } else if let stored = try? JSONDecoder().decode(ItemizedBill.self, from: itemizedDraftData) {
                itemizedBill = stored
            }
            restoreRecentBill()
        }
        .sheet(isPresented: $showingScanner, onDismiss: {
            if openEditorAfterScan {
                openEditorAfterScan = false
                showingItemizedEditor = true
            }
        }) {
            ReceiptScannerView { result in handleScan(result) }
        }
        .sheet(isPresented: $showingItemizedEditor) {
            ItemizedBillView(bill: $itemizedBill, receiptImageData: scannedReceiptData)
        }
        .onChange(of: billText) { _, value in
            lastBill = value
            lastEditedAt = Date().timeIntervalSince1970
        }
        .onChange(of: itemizedBill) { _, value in
            if let encoded = try? JSONEncoder().encode(value) {
                itemizedDraftData = encoded
            }
        }
        .task(id: "\(currencyCode)-\(targetCurrency)-\(converterEnabled)") {
            await loadExchangeRate()
        }
    }

    private func amountRow(_ title: String, amount: Decimal, emphasized: Bool = false) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(currencyFormatter.string(from: NSDecimalNumber(decimal: amount)) ?? "—")
                .fontWeight(emphasized ? .semibold : .regular)
                .monospacedDigit()
        }
    }

    @ViewBuilder
    private func conversionContent(total: Decimal) -> some View {
        if currencyCode == targetCurrency {
            Text("Choose another currency in Settings.")
                .foregroundStyle(.secondary)
        } else if let exchangeRate,
                  exchangeRate.base.lowercased() == currencyCode.lowercased(),
                  exchangeRate.quote.lowercased() == targetCurrency.lowercased() {
            let converted = total * exchangeRate.rate
            let formatted = converted.formatted(.currency(code: targetCurrency))
            LabeledContent("Estimated total", value: formatted)
            Text("Rate dated \(exchangeRate.date) · 1 \(currencyCode) = \(NSDecimalNumber(decimal: exchangeRate.rate).stringValue) \(targetCurrency)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else if let exchangeError {
            Text(exchangeError).foregroundStyle(.secondary)
            Button("Retry") { Task { await loadExchangeRate() } }
        } else {
            ProgressView("Loading rate")
        }
    }

    private func restoreRecentBill() {
        if Date().timeIntervalSince1970 - lastEditedAt < 600 {
            billText = lastBill
        } else {
            billText = ""
        }
    }

    private func handleScan(_ result: ReceiptScanResult) {
        track(.scanCompleted)
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = .current
        formatter.maximumFractionDigits = 2
        billText = formatter.string(from: NSDecimalNumber(decimal: result.amount)) ?? ""

        let items = ReceiptItemParser.items(
            in: result.lines,
            assignedPersonIDs: itemizedBill.people.map(\.id)
        )
        guard !items.isEmpty else {
            scannedReceiptData = nil
            return
        }
        scannedReceiptData = result.imageData
        itemizedBill.useScannedItems(items, total: result.amount)
        openEditorAfterScan = true
    }

    private func track(_ event: ProductEvent) {
        guard analyticsEnabled, let url = URL(string: serverURL),
              let analytics = try? ProductAnalytics(serverURL: url) else { return }
        let variant = scanVariant
        Task { try? await analytics.record(event, variant: variant) }
    }

    private func loadExchangeRate() async {
        exchangeRate = nil
        exchangeError = nil
        guard converterEnabled, currencyCode != targetCurrency else { return }
        do {
            let rate = try await rateService.rate(from: currencyCode, to: targetCurrency)
            try Task.checkCancellation()
            exchangeRate = rate
        } catch {
            guard !Task.isCancelled else { return }
            exchangeError = "Could not load a rate. Check your connection and try again."
        }
    }
}
