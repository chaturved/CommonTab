import Foundation
import Security
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct SharedAccount: Codable, Identifiable, Sendable {
    let id: UUID
    let email: String
    let name: String
}

struct SharedAuthSession: Codable, Sendable {
    let accessToken: String
    let expiresAt: String
    let user: SharedAccount
}

struct SharedMember: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let email: String
}

struct SharedAllocation: Codable, Sendable {
    let memberID: UUID
    let minorUnits: Int64
}

struct SharedExpense: Codable, Identifiable, Sendable {
    let id: UUID
    let groupID: UUID
    let merchant: String
    let occurredAt: String
    let category: String
    let notes: String
    let amountMinor: Int64
    let payerID: UUID
    let method: String
    let allocations: [SharedAllocation]
    let values: [String]
    let version: Int
    let hasReceipt: Bool
}

struct SharedSettlement: Codable, Identifiable, Sendable {
    let id: UUID
    let groupID: UUID
    let fromID: UUID
    let toID: UUID
    let amountMinor: Int64
    let createdAt: String
}

struct SharedBalance: Codable, Sendable {
    let memberID: UUID
    let minorUnits: Int64
}

struct SharedGroup: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let currencyCode: String
    let ownerID: UUID
    let version: Int
    let members: [SharedMember]
    let expenses: [SharedExpense]
    let settlements: [SharedSettlement]
    let balances: [SharedBalance]
}

struct SharedInvitation: Codable, Sendable {
    let inviteToken: String
    let expiresAt: String
    let email: String
    let groupID: UUID
}

struct SharedExpenseDraft: Encodable, Sendable {
    let id: UUID
    let merchant: String
    let occurredAt: String
    let category: String
    let notes: String
    let amountMinor: Int64
    let payerID: UUID
    let method: String
    let participants: [UUID]
    let values: [String]
    let version: Int?
}

enum SharedExpenseClientError: LocalizedError {
    case invalidServerURL
    case invalidResponse
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidServerURL: "Enter an HTTPS server URL in Settings."
        case .invalidResponse: "The server returned an invalid response."
        case let .server(_, detail): detail
        }
    }
}

struct SharedExpenseClient: Sendable {
    let baseURL: URL
    let load: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    init(baseURL: URL, load: @escaping @Sendable (URLRequest) async throws -> (Data, URLResponse) = {
        try await URLSession.shared.data(for: $0)
    }) throws {
        guard let scheme = baseURL.scheme?.lowercased(), let host = baseURL.host?.lowercased(),
              !host.isEmpty, baseURL.user == nil, baseURL.password == nil,
              baseURL.query == nil, baseURL.fragment == nil,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1"].contains(host)) else {
            throw SharedExpenseClientError.invalidServerURL
        }
        self.baseURL = baseURL
        self.load = load
    }

    func register(email: String, name: String, password: String) async throws -> SharedAuthSession {
        try await send("v1/accounts", method: "POST", body: AccountRequest(email: email, name: name, password: password),
                       expected: 201)
    }

    func login(email: String, password: String) async throws -> SharedAuthSession {
        try await send("v1/auth/sessions", method: "POST", body: LoginRequest(email: email, password: password))
    }

    func me(token: String) async throws -> SharedAccount {
        try await send("v1/me", token: token)
    }

    func logout(token: String) async throws {
        let _: EmptyResponse = try await send("v1/auth/sessions", method: "DELETE", token: token, expected: 204)
    }

    func groups(token: String) async throws -> [SharedGroup] {
        try await send("v1/groups", token: token)
    }

    func group(_ id: UUID, token: String) async throws -> SharedGroup {
        try await send("v1/groups/\(id)", token: token)
    }

    func createGroup(name: String, currencyCode: String, token: String) async throws -> SharedGroup {
        try await send("v1/groups", method: "POST", token: token,
                       body: GroupRequest(name: name, currencyCode: currencyCode), expected: 201)
    }

    func invite(groupID: UUID, email: String, token: String) async throws -> SharedInvitation {
        try await send("v1/groups/\(groupID)/invitations", method: "POST", token: token,
                       body: InvitationRequest(email: email), expected: 201)
    }

    func accept(inviteToken: String, token: String) async throws -> SharedGroup {
        try await send("v1/invitations/accept", method: "POST", token: token,
                       body: AcceptRequest(inviteToken: inviteToken))
    }

    func saveExpense(_ draft: SharedExpenseDraft, groupID: UUID, token: String) async throws -> SharedExpense {
        try await send("v1/groups/\(groupID)/expenses/\(draft.id)", method: "PUT", token: token, body: draft)
    }

    func deleteExpense(_ expense: SharedExpense, token: String) async throws {
        let path = "v1/groups/\(expense.groupID)/expenses/\(expense.id)?version=\(expense.version)"
        let _: EmptyResponse = try await send(path, method: "DELETE", token: token, expected: 204)
    }

    func settle(groupID: UUID, groupVersion: Int, fromID: UUID, toID: UUID, amountMinor: Int64, token: String) async throws -> SharedSettlement {
        try await send("v1/groups/\(groupID)/settlements", method: "POST", token: token,
                       body: SettlementRequest(id: UUID(), groupVersion: groupVersion, fromID: fromID, toID: toID, amountMinor: amountMinor),
                       expected: 201)
    }

    func uploadReceipt(_ data: Data, mime: String, expense: SharedExpense, token: String) async throws {
        let path = "v1/groups/\(expense.groupID)/expenses/\(expense.id)/receipt"
        let _: ReceiptResult = try await request(path, method: "PUT", token: token, data: data, contentType: mime)
    }

    func receipt(expense: SharedExpense, token: String) async throws -> Data {
        let path = "v1/groups/\(expense.groupID)/expenses/\(expense.id)/receipt"
        return try await rawRequest(path, token: token).0
    }

    private func send<T: Decodable>(_ path: String, method: String = "GET", token: String? = nil,
                                    expected: Int = 200) async throws -> T {
        try await request(path, method: method, token: token, expected: expected)
    }

    private func send<T: Decodable, B: Encodable>(_ path: String, method: String, token: String? = nil,
                                                  body: B, expected: Int = 200) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await request(path, method: method, token: token, data: data, contentType: "application/json",
                                 expected: expected)
    }

    private func request<T: Decodable>(_ path: String, method: String, token: String?, data: Data? = nil,
                                       contentType: String? = nil, expected: Int = 200) async throws -> T {
        let (data, response) = try await rawRequest(path, method: method, token: token, data: data,
                                                    contentType: contentType)
        guard response.statusCode == expected else {
            let detail = (try? JSONDecoder().decode(ServerError.self, from: data).detail) ?? "Request failed."
            throw SharedExpenseClientError.server(response.statusCode, detail)
        }
        if expected == 204 { return try JSONDecoder().decode(T.self, from: Data("{}".utf8)) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func rawRequest(_ path: String, method: String = "GET", token: String? = nil,
                            data: Data? = nil, contentType: String? = nil) async throws -> (Data, HTTPURLResponse) {
        let parts = path.split(separator: "?", maxSplits: 1).map(String.init)
        var url = baseURL.appendingPathComponent(parts[0])
        if parts.count == 2, var components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            components.percentEncodedQuery = parts[1]
            if let built = components.url { url = built }
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        request.httpBody = data
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        let (result, response) = try await load(request)
        guard let http = response as? HTTPURLResponse else { throw SharedExpenseClientError.invalidResponse }
        if !(200...299).contains(http.statusCode) {
            let detail = (try? JSONDecoder().decode(ServerError.self, from: result).detail) ?? "Request failed."
            throw SharedExpenseClientError.server(http.statusCode, detail)
        }
        return (result, http)
    }

    private struct AccountRequest: Encodable { let email: String; let name: String; let password: String }
    private struct LoginRequest: Encodable { let email: String; let password: String }
    private struct GroupRequest: Encodable { let name: String; let currencyCode: String }
    private struct InvitationRequest: Encodable { let email: String }
    private struct AcceptRequest: Encodable { let inviteToken: String }
    private struct SettlementRequest: Encodable { let id: UUID; let groupVersion: Int; let fromID: UUID; let toID: UUID; let amountMinor: Int64 }
    private struct ReceiptResult: Decodable { let hasReceipt: Bool }
    private struct EmptyResponse: Decodable {}
    private struct ServerError: Decodable { let detail: String }
}

enum SharedCredentials {
    private static let service = "com.splittip.shared-expenses"
    private static let account = "session"

    static func read() -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecAttrAccount as String: account,
                                    kSecReturnData as String: true,
                                    kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ token: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else {
            throw SharedExpenseClientError.invalidResponse
        }
    }

    static func clear() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service,
                                    kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
    }
}
