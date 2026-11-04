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
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeading("Tip & split", subtitle: "Split every cent fairly")

                SurfaceCard {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Bill amount")
                                .font(.subheadline.weight(.semibold))
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text(currencyCode)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                TextField("Amount", text: $billText)
                                    .font(.system(.title2, design: .rounded, weight: .bold))
                                    .keyboardType(.decimalPad)
                                    .focused($billIsFocused)
                                    .accessibilityIdentifier("billAmount")
                            }
                            .padding(14)
                            .background(CommonTabStyle.background, in: RoundedRectangle(cornerRadius: 14))
                            if !billText.isEmpty && enteredBill == nil {
                                Text("Enter a valid amount from 0 to 1,000,000,000.")
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                            }
                        }

                        Divider()

                        VStack(alignment: .leading, spacing: 9) {
                            Text("Tip percentage")
                                .font(.subheadline.weight(.semibold))
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
                                .padding(12)
                                .background(CommonTabStyle.background, in: RoundedRectangle(cornerRadius: 12))
                                if selectedPercentage == nil {
                                    Text("Enter a tip percentage from 0 to 100.")
                                        .font(.footnote)
                                        .foregroundStyle(.red)
                                }
                            }
                        }

                        Divider()

                        Stepper(value: $people, in: 1...20) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("People: \(people)")
                                    .font(.subheadline.weight(.semibold))
                                Text("Up to 20 people")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityIdentifier("peopleCount")
                    }
                }

                if let calculation {
                    resultCard(calculation)
                    if converterEnabled {
                        SurfaceCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Currency estimate")
                                    .font(.headline)
                                conversionContent(total: calculation.total)
                            }
                        }
                    }
                }

                SectionHeading("Keep going", subtitle: "More ways to handle a shared bill")
                SurfaceCard {
                    VStack(spacing: 0) {
                        Button {
                            showingItemizedEditor = true
                            track(.itemizedOpened)
                        } label: {
                            actionRow("Assign items to people", symbol: "list.bullet.rectangle")
                        }
                        .accessibilityIdentifier("openItemizedBill")

                        if scanVariant == "B" {
                            Divider().padding(.vertical, 12)
                            Button {
                                showingScanner = true
                                track(.scanOpened)
                            } label: {
                                actionRow("Scan and split a receipt", symbol: "doc.text.viewfinder")
                            }
                        }

                        Divider().padding(.vertical, 12)
                        NavigationLink {
                            ExpenseLibraryView()
                        } label: {
                            actionRow("Saved expenses and receipts", symbol: "receipt")
                        }
                        .accessibilityIdentifier("openExpenseLibrary")
                    }
                }
            }
            .padding(20)
        }
        .background(CommonTabStyle.background)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Calculator")
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
            if ProcessInfo.processInfo.environment["COMMONTAB_UI_TEST_RESET_STATE"] == "1" {
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

    private func resultCard(_ calculation: TipCalculation) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            amountRow("Tip", amount: calculation.tip)
                .foregroundStyle(.white.opacity(0.82))
            Divider().overlay(.white.opacity(0.2))
            HStack(alignment: .firstTextBaseline) {
                Text("Bill and tip")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(currencyFormatter.string(from: NSDecimalNumber(decimal: calculation.total)) ?? "—")
                    .font(.system(.title, design: .rounded, weight: .bold))
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .accessibilityIdentifier("totalAmount")
            }
            if people > 1 {
                Text("PER PERSON")
                    .font(.caption.weight(.bold))
                    .tracking(1.2)
                    .foregroundStyle(CommonTabStyle.mint)
                    .padding(.top, 5)
                ForEach(calculation.shares.indices, id: \.self) { index in
                    Divider().overlay(.white.opacity(0.16))
                    amountRow("Person \(index + 1)", amount: calculation.shares[index].total)
                        .font(.subheadline)
                }
            }
        }
        .foregroundStyle(.white)
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [CommonTabStyle.ink, CommonTabStyle.deepInk],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22)
        )
    }

    private func actionRow(_ title: String, symbol: String) -> some View {
        HStack(spacing: 12) {
            SymbolTile(symbol: symbol, size: 40)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            Spacer(minLength: 4)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
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
