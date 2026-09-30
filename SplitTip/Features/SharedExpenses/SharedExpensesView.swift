import PhotosUI
import SwiftUI

struct SharedExpensesView: View {
    @AppStorage("settings.serverURL") private var serverURL = "http://localhost:8000"
    @State private var token: String? = SharedCredentials.read()
    @State private var account: SharedAccount?
    @State private var groups: [SharedGroup] = []
    @State private var email = ""
    @State private var name = ""
    @State private var password = ""
    @State private var isRegistering = false
    @State private var groupName = ""
    @State private var currencyCode = "USD"
    @State private var inviteToken = ""
    @State private var showingCreate = false
    @State private var showingJoin = false
    @State private var errorMessage: String?
    @State private var loading = false

    var body: some View {
        Group {
            if token == nil {
                signInForm
            } else {
                groupList
            }
        }
        .navigationTitle("Shared expenses")
        .task { await refresh() }
        .alert("Could not complete request", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .sheet(isPresented: $showingCreate) {
            NavigationStack {
                Form {
                    TextField("Group name", text: $groupName)
                    Picker("Currency", selection: $currencyCode) {
                        ForEach(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"], id: \.self) { code in
                            Text(code).tag(code)
                        }
                    }
                }
                .navigationTitle("New group")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingCreate = false } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Create") { Task { await createGroup() } }.disabled(groupName.isEmpty)
                    }
                }
            }
        }
        .sheet(isPresented: $showingJoin) {
            NavigationStack {
                Form { TextField("Invitation code", text: $inviteToken).textInputAutocapitalization(.never) }
                    .navigationTitle("Join group")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingJoin = false } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Join") { Task { await joinGroup() } }.disabled(inviteToken.isEmpty)
                        }
                    }
            }
        }
    }

    private var signInForm: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress).textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                if isRegistering {
                    TextField("Name", text: $name).textContentType(.name)
                }
                SecureField("Password", text: $password)
                    .textContentType(isRegistering ? .newPassword : .password)
                if isRegistering {
                    Text("Use a password with at least 15 characters.").font(.footnote).foregroundStyle(.secondary)
                }
                Button(isRegistering ? "Create account" : "Sign in") { Task { await authenticate() } }
                    .disabled(loading || email.isEmpty || password.isEmpty || (isRegistering && name.isEmpty))
                    .accessibilityIdentifier("sharedAuthenticate")
            }
            Section {
                Button(isRegistering ? "Already have an account? Sign in" : "Create an account") {
                    isRegistering.toggle()
                }
            }
            Section {
                Text("Set the API address in Settings before signing in. Your personal expenses stay on this device until you choose to share them.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private var groupList: some View {
        List {
            if let account {
                Section { Text("Signed in as \(account.name) · \(account.email)") }
            }
            Section("Groups") {
                if groups.isEmpty { Text("Create or join a group to split expenses across devices.") }
                ForEach(groups) { group in
                    NavigationLink {
                        SharedGroupView(groupID: group.id, token: token ?? "", serverURL: serverURL)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(group.name).font(.headline)
                            Text("\(group.members.count) members · \(group.currencyCode)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                Button("Create group", systemImage: "plus") { showingCreate = true }
                Button("Join with invitation", systemImage: "person.badge.plus") { showingJoin = true }
            }
            Section {
                Button("Sign out", role: .destructive) { Task { await signOut() } }
            }
        }
        .refreshable { await refresh() }
    }

    private func client() throws -> SharedExpenseClient {
        guard let url = URL(string: serverURL) else { throw SharedExpenseClientError.invalidServerURL }
        return try SharedExpenseClient(baseURL: url)
    }

    private func authenticate() async {
        loading = true
        defer { loading = false }
        do {
            let session: SharedAuthSession
            if isRegistering {
                session = try await client().register(email: email, name: name, password: password)
            } else {
                session = try await client().login(email: email, password: password)
            }
            try SharedCredentials.save(session.accessToken)
            token = session.accessToken
            account = session.user
            password = ""
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    private func refresh() async {
        guard let token else { return }
        do {
            let client = try client()
            account = try await client.me(token: token)
            groups = try await client.groups(token: token)
        } catch {
            if case SharedExpenseClientError.server(401, _) = error {
                SharedCredentials.clear()
                self.token = nil
                account = nil
                groups = []
            } else { errorMessage = error.localizedDescription }
        }
    }

    private func createGroup() async {
        guard let token else { return }
        do {
            _ = try await client().createGroup(name: groupName, currencyCode: currencyCode.uppercased(), token: token)
            showingCreate = false
            groupName = ""
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    private func joinGroup() async {
        guard let token else { return }
        do {
            _ = try await client().accept(inviteToken: inviteToken.trimmingCharacters(in: .whitespacesAndNewlines), token: token)
            showingJoin = false
            inviteToken = ""
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    private func signOut() async {
        if let token { try? await client().logout(token: token) }
        SharedCredentials.clear()
        token = nil
        account = nil
        groups = []
    }
}

private struct SharedGroupView: View {
    let groupID: UUID
    let token: String
    let serverURL: String
    @State private var group: SharedGroup?
    @State private var showingExpense = false
    @State private var editedExpense: SharedExpense?
    @State private var importedExpense: SavedExpense?
    @State private var showingImport = false
    @State private var localExpenses: [SavedExpense] = []
    @State private var showingInvite = false
    @State private var showingSettle = false
    @State private var inviteEmail = ""
    @State private var invitation: SharedInvitation?
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
                    SharedExpenseEditor(group: group, existing: editedExpense, source: importedExpense,
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

    private func client() throws -> SharedExpenseClient {
        guard let url = URL(string: serverURL) else { throw SharedExpenseClientError.invalidServerURL }
        return try SharedExpenseClient(baseURL: url)
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

private struct SharedExpenseEditor: View {
    let group: SharedGroup
    let existing: SharedExpense?
    let source: SavedExpense?
    let token: String
    let serverURL: String
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var merchant = ""
    @State private var amountText = ""
    @State private var notes = ""
    @State private var category = ExpenseCategory.other
    @State private var date = Date()
    @State private var payerID: UUID?
    @State private var participants: Set<UUID> = []
    @State private var method = ExpenseSplitMethod.equal
    @State private var values: [UUID: String] = [:]
    @State private var photo: PhotosPickerItem?
    @State private var photoData: Data?
    @State private var receiptImage: UIImage?
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section("Expense") {
                TextField("Description", text: $merchant)
                TextField("Amount in \(group.currencyCode)", text: $amountText).keyboardType(.decimalPad)
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Picker("Category", selection: $category) {
                    ForEach(ExpenseCategory.allCases) { category in Text(category.title).tag(category) }
                }
                TextField("Notes", text: $notes, axis: .vertical)
            }
            Section("Split") {
                Picker("Paid by", selection: $payerID) {
                    Text("Choose payer").tag(Optional<UUID>.none)
                    ForEach(group.members) { member in Text(member.name).tag(Optional(member.id)) }
                }
                Picker("Method", selection: $method) {
                    ForEach(ExpenseSplitMethod.allCases) { method in Text(method.title).tag(method) }
                }
                ForEach(group.members) { member in
                    Toggle(member.name, isOn: Binding(
                        get: { participants.contains(member.id) },
                        set: { if $0 { participants.insert(member.id) } else { participants.remove(member.id) } }
                    ))
                    if participants.contains(member.id) && method != .equal {
                        TextField(method == .exact ? "\(member.name) minor units" : "\(member.name) percent",
                                  text: Binding(get: { values[member.id] ?? "" },
                                                set: { values[member.id] = $0 }))
                            .keyboardType(.decimalPad)
                    }
                }
                if method == .exact {
                    Text("Enter integer minor units (for example, 1250 for $12.50).")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Section("Receipt") {
                PhotosPicker("Attach receipt photo", selection: $photo, matching: .images)
                if let receiptImage {
                    Image(uiImage: receiptImage).resizable().scaledToFit().frame(maxHeight: 240)
                } else if existing?.hasReceipt == true {
                    Text("Receipt attached").foregroundStyle(.secondary)
                }
            }
            if let existing {
                Section { Button("Delete expense", role: .destructive) { Task { await delete(existing) } } }
            }
        }
        .navigationTitle(existing == nil ? "Add expense" : "Edit expense")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } } }
        }
        .onAppear(perform: loadExisting)
        .task {
            if let existing, existing.hasReceipt {
                do { receiptImage = UIImage(data: try await client().receipt(expense: existing, token: token)) }
                catch { errorMessage = error.localizedDescription }
            }
        }
        .onChange(of: photo) { _, newValue in
            Task {
                if let data = try? await newValue?.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    let normalized = normalizedJPEG(image)
                    photoData = normalized
                    receiptImage = UIImage(data: normalized)
                }
            }
        }
        .alert("Could not save expense", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    private func loadExisting() {
        payerID = existing?.payerID ?? group.members.first?.id
        participants = Set(existing?.allocations.map(\.memberID) ?? group.members.map(\.id))
        if let source {
            merchant = source.merchant
            amountText = NSDecimalNumber(decimal: source.amount).stringValue
            notes = source.notes
            category = source.category
            date = source.date
            if let data = try? ExpenseStore().receiptData(for: source),
               let image = UIImage(data: data) {
                photoData = normalizedJPEG(image)
                receiptImage = UIImage(data: photoData ?? Data())
            }
            return
        }
        guard let existing else { return }
        merchant = existing.merchant
        amountText = NSDecimalNumber(decimal: CurrencyUnits.amount(existing.amountMinor, currencyCode: group.currencyCode)).stringValue
        notes = existing.notes
        category = ExpenseCategory(rawValue: existing.category) ?? .other
        method = ExpenseSplitMethod(rawValue: existing.method) ?? .equal
        if let parsed = ISO8601DateFormatter().date(from: existing.occurredAt) { date = parsed }
        if method != .equal {
            values = Dictionary(uniqueKeysWithValues: zip(existing.allocations.map(\.memberID), existing.values))
        }
    }

    private func client() throws -> SharedExpenseClient {
        guard let url = URL(string: serverURL) else { throw SharedExpenseClientError.invalidServerURL }
        return try SharedExpenseClient(baseURL: url)
    }

    private func normalizedJPEG(_ image: UIImage) -> Data {
        let scale = min(1, 1800 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.75) { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private func save() async {
        guard let payerID, let amount = MoneyInputParser.parse(amountText) else {
            errorMessage = "Enter a payer and valid amount."
            return
        }
        do {
            let minor = try CurrencyUnits.units(amount, currencyCode: group.currencyCode)
            let members = group.members.map(\.id).filter { participants.contains($0) }
            let inputs = method == .equal ? [] : members.map { values[$0] ?? "" }
            let draft = SharedExpenseDraft(id: existing?.id ?? UUID(), merchant: merchant,
                                           occurredAt: ISO8601DateFormatter().string(from: date),
                                           category: category.rawValue, notes: notes, amountMinor: minor,
                                           payerID: payerID, method: method.rawValue, participants: members,
                                           values: inputs, version: existing?.version)
            let client = try client()
            let saved = try await client.saveExpense(draft, groupID: group.id, token: token)
            if let photoData { try await client.uploadReceipt(photoData, mime: "image/jpeg", expense: saved, token: token) }
            onSaved()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }

    private func delete(_ expense: SharedExpense) async {
        do {
            try await client().deleteExpense(expense, token: token)
            onSaved()
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}
