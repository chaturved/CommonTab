import SwiftUI

struct GroupExpenseDetailView: View {
    let groupID: UUID
    let token: String
    let serverURL: String
    @State private var group: APIGroup?
    @State private var showingExpense = false
    @State private var editedExpense: APIExpense?
    @State private var importedExpense: SavedExpense?
    @State private var showingImport = false
    @State private var localExpenses: [SavedExpense] = []
    @State private var showingInvite = false
    @State private var showingSettle = false
    @State private var inviteEmail = ""
    @State private var invitation: APIInvitation?
    @State private var fromID: UUID?
    @State private var toID: UUID?
    @State private var settlementText = ""
    @State private var errorMessage: String?

    var body: some View {
        List {
            if let group {
                Section("Balances") {
                    ForEach(group.balances, id: \.memberID) { balance in
                        HStack {
                            Text(memberName(balance.memberID))
                            Spacer()
                            Text(CurrencyUnits.amount(balance.minorUnits, currencyCode: group.currencyCode)
                                .formatted(.currency(code: group.currencyCode)))
                                .foregroundStyle(balance.minorUnits < 0 ? Color.red : Color.primary)
                        }
                    }
                    Button("Record settlement") { showingSettle = true }
                }
                Section("Expenses") {
                    Button("Add expense", systemImage: "plus.circle.fill") {
                        editedExpense = nil
                        importedExpense = nil
                        showingExpense = true
                    }
                    Button("Import from this device", systemImage: "square.and.arrow.up") {
                        do {
                            localExpenses = try ExpenseStore().load().filter { $0.currencyCode == group.currencyCode }
                            showingImport = true
                        } catch { errorMessage = error.localizedDescription }
                    }
                    ForEach(group.expenses) { expense in
                        Button {
                            editedExpense = expense
                            importedExpense = nil
                            showingExpense = true
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(expense.merchant)
                                    Text("Paid by \(memberName(expense.payerID))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(CurrencyUnits.amount(expense.amountMinor, currencyCode: group.currencyCode)
                                    .formatted(.currency(code: group.currencyCode)))
                            }
                        }
                    }
                }
                Section("People") {
                    ForEach(group.members) { member in Text("\(member.name) · \(member.email)") }
                    Button("Invite member") { showingInvite = true }
                }
            } else {
                ProgressView("Loading group")
            }
        }
        .navigationTitle(group?.name ?? "Group")
        .refreshable { await refresh() }
        .task { await refresh() }
        .alert("Could not complete request", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .sheet(isPresented: $showingExpense) {
            if let group {
                NavigationStack {
                    GroupExpenseEditorView(group: group, existing: editedExpense, source: importedExpense,
                                        token: token, serverURL: serverURL) {
                        Task { await refresh() }
                    }
                }
            }
        }
        .sheet(isPresented: $showingImport, onDismiss: {
            if importedExpense != nil { showingExpense = true }
        }) {
            NavigationStack {
                List {
                    if localExpenses.isEmpty {
                        ContentUnavailableView("No local expenses in this currency", systemImage: "tray")
                    }
                    ForEach(localExpenses) { expense in
                        Button {
                            importedExpense = expense
                            editedExpense = nil
                            showingImport = false
                        } label: {
                            HStack {
                                Text(expense.merchant)
                                Spacer()
                                Text(expense.amount.formatted(.currency(code: expense.currencyCode)))
                            }
                        }
                    }
                }
                .navigationTitle("Import expense")
                .toolbar { Button("Cancel") { showingImport = false } }
            }
        }
        .sheet(isPresented: $showingInvite) {
            NavigationStack {
                Form {
                    TextField("Member email", text: $inviteEmail).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    if let invitation {
                        ShareLink(item: invitation.inviteToken) {
                            Label("Share invitation code", systemImage: "square.and.arrow.up")
                        }
                        Text("Share this code privately with \(invitation.email). It expires in seven days.")
                            .font(.footnote)
                    }
                }
                .navigationTitle("Invite member")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Done") { showingInvite = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create code") { Task { await invite() } }.disabled(inviteEmail.isEmpty)
                    }
                }
            }
        }
        .sheet(isPresented: $showingSettle) {
            if let group {
                NavigationStack {
                    Form {
                        Picker("From", selection: $fromID) {
                            Text("Choose member").tag(Optional<UUID>.none)
                            ForEach(group.members) { member in Text(member.name).tag(Optional(member.id)) }
                        }
                        Picker("To", selection: $toID) {
                            Text("Choose member").tag(Optional<UUID>.none)
                            ForEach(group.members) { member in Text(member.name).tag(Optional(member.id)) }
                        }
                        TextField("Amount", text: $settlementText).keyboardType(.decimalPad)
                    }
                    .navigationTitle("Record settlement")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingSettle = false } }
                        ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await settle() } } }
                    }
                }
            }
        }
    }

    private func memberName(_ id: UUID) -> String { group?.members.first { $0.id == id }?.name ?? "Member" }

    private func client() throws -> GroupExpenseClient {
        guard let url = URL(string: serverURL) else { throw GroupExpenseClientError.invalidServerURL }
        return try GroupExpenseClient(baseURL: url)
    }

    private func refresh() async {
        do { group = try await client().group(groupID, token: token) }
        catch { errorMessage = error.localizedDescription }
    }

    private func invite() async {
        do { invitation = try await client().invite(groupID: groupID, email: inviteEmail, token: token) }
        catch { errorMessage = error.localizedDescription }
    }

    private func settle() async {
        guard let group, let fromID, let toID,
              let amount = MoneyInputParser.parse(settlementText) else { return }
        do {
            let units = try CurrencyUnits.units(amount, currencyCode: group.currencyCode)
            _ = try await client().settle(groupID: groupID, groupVersion: group.version, fromID: fromID, toID: toID,
                                          amountMinor: units, token: token)
            showingSettle = false
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }
}
