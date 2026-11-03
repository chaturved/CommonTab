import SwiftUI

struct GroupExpensesView: View {
    @AppStorage("settings.serverURL") private var serverURL = "http://localhost:8000"
    @State private var token: String? = AccountCredentialStore.read()
    @State private var account: APIAccount?
    @State private var groups: [APIGroup] = []
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
                        GroupExpenseDetailView(groupID: group.id, token: token ?? "", serverURL: serverURL)
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

    private func client() throws -> GroupExpenseClient {
        guard let url = URL(string: serverURL) else { throw GroupExpenseClientError.invalidServerURL }
        return try GroupExpenseClient(baseURL: url)
    }

    private func authenticate() async {
        loading = true
        defer { loading = false }
        do {
            let session: APIAuthSession
            if isRegistering {
                session = try await client().register(email: email, name: name, password: password)
            } else {
                session = try await client().login(email: email, password: password)
            }
            try AccountCredentialStore.save(session.accessToken)
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
            if case GroupExpenseClientError.server(401, _) = error {
                AccountCredentialStore.clear()
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
        AccountCredentialStore.clear()
        token = nil
        account = nil
        groups = []
    }
}
