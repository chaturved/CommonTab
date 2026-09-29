import SwiftUI

struct ItemizedBillView: View {
    @Binding var bill: ItemizedBill
    @Environment(\.dismiss) private var dismiss
    @State private var newItemName = ""
    @State private var newItemPrice = ""

    private var calculation: ItemizedCalculation? {
        try? ItemizedBillCalculator.calculate(bill, fractionDigits: fractionDigits)
    }

    private var fractionDigits: Int {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = .current
        return formatter.maximumFractionDigits
    }

    private var currencyCode: String { Locale.current.currency?.identifier ?? "USD" }

    var body: some View {
        NavigationStack {
            Form {
                Section("People") {
                    ForEach(bill.people) { person in
                        HStack {
                            TextField("Name", text: personNameBinding(for: person.id))
                            if bill.people.count > 1 {
                                Button(role: .destructive) {
                                    removePerson(person.id)
                                } label: {
                                    Image(systemName: "minus.circle")
                                }
                                .accessibilityLabel("Remove \(person.name)")
                            }
                        }
                    }
                    if bill.people.count < 20 {
                        Button {
                            bill.people.append(BillPerson(name: "Person \(bill.people.count + 1)"))
                        } label: {
                            Label("Add person", systemImage: "person.badge.plus")
                        }
                    }
                }

                Section("Items") {
                    ForEach(bill.items) { item in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                TextField("Item", text: itemNameBinding(for: item.id))
                                TextField("Price", value: itemPriceBinding(for: item.id), format: .number)
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .frame(maxWidth: 100)
                                Button(role: .destructive) {
                                    bill.items.removeAll { $0.id == item.id }
                                } label: {
                                    Image(systemName: "trash")
                                }
                                .accessibilityLabel("Delete \(item.name)")
                            }
                            DisclosureGroup("Assigned to") {
                                ForEach(bill.people) { person in
                                    Toggle(person.name, isOn: assignmentBinding(itemID: item.id, personID: person.id))
                                }
                            }
                        }
                    }

                    TextField("New item name", text: $newItemName)
                    HStack {
                        TextField("Price", text: $newItemPrice)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("newItemPrice")
                        Button("Add item") { addItem() }
                            .disabled(newItemName.trimmingCharacters(in: .whitespaces).isEmpty ||
                                      (MoneyInputParser.parse(newItemPrice) ?? 0) <= 0)
                    }
                }

                Section("Tax and tip") {
                    LabeledContent("Tax and fees") {
                        TextField("0", value: $bill.tax, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 120)
                    }
                    Stepper(
                        "Tip: \(NSDecimalNumber(decimal: bill.tipPercentage).intValue)%",
                        value: tipBinding,
                        in: 0...100
                    )
                    Text("Tip is calculated on items before tax.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Split result") {
                    if let calculation {
                        amountRow("Items", calculation.subtotal)
                        amountRow("Tax and fees", calculation.tax)
                        amountRow("Tip", calculation.tip)
                        amountRow("Total", calculation.total)
                            .fontWeight(.semibold)

                        if let receiptTotal = bill.receiptTotal,
                           calculation.subtotal + calculation.tax != receiptTotal {
                            Text("Items and tax differ from the scanned total \(formatted(receiptTotal)). Review the receipt before sharing.")
                                .font(.footnote)
                                .foregroundStyle(.orange)
                        }

                        ForEach(calculation.shares, id: \.person.id) { share in
                            amountRow(share.person.name, share.total)
                        }
                    } else {
                        Text(validationMessage)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Collaborate") {
                    NavigationLink {
                        SharedBillView(bill: $bill)
                    } label: {
                        Label("Share or join a bill", systemImage: "person.2")
                    }
                    .accessibilityIdentifier("openSharedBill")
                }
            }
            .navigationTitle("Itemized split")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var validationMessage: String {
        do {
            _ = try ItemizedBillCalculator.calculate(bill, fractionDigits: fractionDigits)
            return "Add an item to see the split."
        } catch ItemizedBillError.noItems {
            return "Add an item to see the split."
        } catch ItemizedBillError.unassignedItem {
            return "Assign every item to at least one person."
        } catch ItemizedBillError.invalidItem {
            return "Give every item a name and a valid price."
        } catch {
            return "Review the people, items, tax, and tip."
        }
    }

    private var tipBinding: Binding<Int> {
        Binding(
            get: { NSDecimalNumber(decimal: bill.tipPercentage).intValue },
            set: { bill.tipPercentage = Decimal($0) }
        )
    }

    private func personNameBinding(for id: UUID) -> Binding<String> {
        Binding(
            get: { bill.people.first(where: { $0.id == id })?.name ?? "" },
            set: { value in
                if let index = bill.people.firstIndex(where: { $0.id == id }) {
                    bill.people[index].name = value
                }
            }
        )
    }

    private func itemNameBinding(for id: UUID) -> Binding<String> {
        Binding(
            get: { bill.items.first(where: { $0.id == id })?.name ?? "" },
            set: { value in
                if let index = bill.items.firstIndex(where: { $0.id == id }) {
                    bill.items[index].name = value
                }
            }
        )
    }

    private func itemPriceBinding(for id: UUID) -> Binding<Decimal> {
        Binding(
            get: { bill.items.first(where: { $0.id == id })?.price ?? 0 },
            set: { value in
                if let index = bill.items.firstIndex(where: { $0.id == id }) {
                    bill.items[index].price = value
                }
            }
        )
    }

    private func assignmentBinding(itemID: UUID, personID: UUID) -> Binding<Bool> {
        Binding(
            get: {
                bill.items.first(where: { $0.id == itemID })?.assignedPersonIDs.contains(personID) ?? false
            },
            set: { isAssigned in
                guard let index = bill.items.firstIndex(where: { $0.id == itemID }) else { return }
                bill.items[index].assignedPersonIDs.removeAll { $0 == personID }
                if isAssigned {
                    bill.items[index].assignedPersonIDs.append(personID)
                }
            }
        )
    }

    private func removePerson(_ id: UUID) {
        bill.people.removeAll { $0.id == id }
        for index in bill.items.indices {
            bill.items[index].assignedPersonIDs.removeAll { $0 == id }
        }
    }

    private func addItem() {
        guard let price = MoneyInputParser.parse(newItemPrice), price > 0 else { return }
        bill.items.append(BillItem(
            name: newItemName.trimmingCharacters(in: .whitespacesAndNewlines),
            price: price,
            assignedPersonIDs: bill.people.map(\.id)
        ))
        newItemName = ""
        newItemPrice = ""
    }

    private func formatted(_ amount: Decimal) -> String {
        amount.formatted(.currency(code: currencyCode))
    }

    private func amountRow(_ title: String, _ amount: Decimal) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(formatted(amount)).monospacedDigit()
        }
    }
}
