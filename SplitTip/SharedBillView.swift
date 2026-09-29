import SwiftUI
import UIKit

struct SharedBillView: View {
    @Binding var bill: ItemizedBill
    @AppStorage("settings.serverURL") private var serverURL = "http://localhost:8000"
    @AppStorage("analytics.enabled") private var analyticsEnabled = false
    @AppStorage("experiment.scanEntryVariant") private var scanVariant = ""
    @State private var inviteCode = ""
    @State private var activeCredentials: BillSessionCredentials?
    @State private var version: Int?
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section("Share this bill") {
                Text("Everyone with the invite code can view and edit this bill until the session expires. Send it only to people you trust.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Create shared bill") { Task { await create() } }
                    .disabled(busy || !billIsValid)
                if !billIsValid {
                    Text("Add valid items and assign each one to a person before sharing.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Join a bill") {
                TextField("Invite code", text: $inviteCode)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .privacySensitive()
                Button("Join and load bill") { Task { await join() } }
                    .disabled(busy || BillSessionCredentials(inviteCode: inviteCode) == nil)
                Text("Joining replaces your current itemized draft with the shared bill.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if activeCredentials != nil {
                Section("Current session") {
                    Button("Copy invite code") { UIPasteboard.general.string = activeCredentials?.inviteCode }
                    Button("Load latest changes") { Task { await reload() } }
                        .disabled(busy)
                    Button("Save my changes") { Task { await save() } }
                        .disabled(busy || !billIsValid)
                    if let version { Text("Version \(version)").foregroundStyle(.secondary) }
                    Button("Leave session", role: .destructive) {
                        SharedSessionStore.clear()
                        activeCredentials = nil
                        version = nil
                        inviteCode = ""
                        message = "Session removed from this device. Your local bill is still here."
                    }
                }
            }

            if busy { Section { ProgressView("Connecting") } }
            if let message { Section { Text(message).foregroundStyle(.secondary) } }
        }
        .navigationTitle("Shared bill")
        .onAppear {
            guard let saved = SharedSessionStore.load(), saved.serverURL == serverURL,
                  let credentials = BillSessionCredentials(inviteCode: saved.inviteCode) else { return }
            inviteCode = saved.inviteCode
            activeCredentials = credentials
            version = saved.version
        }
    }

    private var billIsValid: Bool {
        (try? ItemizedBillCalculator.calculate(bill)) != nil
    }

    private func client() throws -> SharedBillClient {
        guard let url = URL(string: serverURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw SharedBillClientError.invalidServerURL
        }
        return try SharedBillClient(baseURL: url)
    }

    private func create() async {
        busy = true
        defer { busy = false }
        do {
            let created = try await client().create(bill)
            try SharedSessionStore.save(SavedBillSession(
                serverURL: serverURL, inviteCode: created.inviteCode, version: created.version
            ))
            inviteCode = created.inviteCode
            activeCredentials = BillSessionCredentials(inviteCode: created.inviteCode)
            version = created.version
            message = "Shared bill created. Copy the invite code to send it."
            if analyticsEnabled, let url = URL(string: serverURL),
               let analytics = try? ProductAnalytics(serverURL: url) {
                try? await analytics.record(.shareCreated, variant: scanVariant)
            }
        } catch { message = description(for: error) }
    }

    private func join() async {
        guard let credentials = BillSessionCredentials(inviteCode: inviteCode) else { return }
        busy = true
        defer { busy = false }
        do {
            let session = try await client().fetch(credentials)
            try SharedSessionStore.save(SavedBillSession(
                serverURL: serverURL, inviteCode: credentials.inviteCode, version: session.version
            ))
            bill = session.bill
            activeCredentials = credentials
            version = session.version
            inviteCode = credentials.inviteCode
            message = "Shared bill loaded."
        } catch { message = description(for: error) }
    }

    private func reload() async {
        guard let credentials = activeCredentials else { return }
        busy = true
        defer { busy = false }
        do {
            let session = try await client().fetch(credentials)
            try SharedSessionStore.save(SavedBillSession(
                serverURL: serverURL, inviteCode: credentials.inviteCode, version: session.version
            ))
            bill = session.bill
            version = session.version
            message = "Latest version loaded."
        } catch { message = description(for: error) }
    }

    private func save() async {
        guard let credentials = activeCredentials, let version else { return }
        busy = true
        defer { busy = false }
        do {
            let session = try await client().update(bill, version: version, credentials: credentials)
            try SharedSessionStore.save(SavedBillSession(
                serverURL: serverURL, inviteCode: credentials.inviteCode, version: session.version
            ))
            self.version = session.version
            message = "Changes saved."
        } catch SharedBillClientError.conflict {
            message = "Someone saved a newer version. Load latest changes, then make your edits again."
        } catch { message = description(for: error) }
    }

    private func description(for error: Error) -> String {
        switch error {
        case SharedBillClientError.invalidServerURL:
            return "Set a valid HTTPS server URL in Settings. Localhost HTTP is available for development."
        case SharedBillClientError.missing, SharedBillClientError.unauthorized:
            return "Session or invite code not found."
        case SharedBillClientError.expired:
            SharedSessionStore.clear()
            activeCredentials = nil
            version = nil
            return "This session expired. Create a new shared bill."
        case SharedBillClientError.conflict:
            return "Someone saved a newer version. Load latest changes first."
        default:
            return "Could not connect or save. Check the server URL and your connection."
        }
    }
}
