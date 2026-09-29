import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct SharedBillSession: Codable, Equatable {
    let id: UUID
    let version: Int
    let expiresAt: String
    let bill: ItemizedBill
}

struct CreatedBillSession: Codable, Equatable {
    let id: UUID
    let accessToken: String
    let version: Int
    let expiresAt: String
    let bill: ItemizedBill

    var session: SharedBillSession {
        SharedBillSession(id: id, version: version, expiresAt: expiresAt, bill: bill)
    }

    var inviteCode: String { "\(id.uuidString).\(accessToken)" }
}

struct BillSessionCredentials: Equatable {
    let id: UUID
    let token: String

    init?(inviteCode: String) {
        let parts = inviteCode.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 2, let id = UUID(uuidString: String(parts[0])),
              !parts[1].isEmpty, parts[1].count <= 128,
              parts[1].allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_") }) else {
            return nil
        }
        self.id = id
        token = String(parts[1])
    }

    var inviteCode: String { "\(id.uuidString).\(token)" }
}

enum SharedBillClientError: Error, Equatable {
    case invalidServerURL
    case invalidResponse
    case unauthorized
    case missing
    case expired
    case conflict
    case server(Int)
}

struct SharedBillClient: Sendable {
    typealias Loader = @Sendable (URLRequest) async throws -> (Data, URLResponse)

    let baseURL: URL
    private let load: Loader

    init(baseURL: URL, load: @escaping Loader = { try await URLSession.shared.data(for: $0) }) throws {
        guard let scheme = baseURL.scheme?.lowercased(),
              let host = baseURL.host?.lowercased(), !host.isEmpty,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1"].contains(host)),
              baseURL.user == nil, baseURL.password == nil, baseURL.query == nil, baseURL.fragment == nil else {
            throw SharedBillClientError.invalidServerURL
        }
        self.baseURL = baseURL
        self.load = load
    }

    func create(_ bill: ItemizedBill) async throws -> CreatedBillSession {
        let body = try JSONEncoder().encode(CreateRequest(bill: bill))
        let data = try await request("v1/sessions", method: "POST", body: body, expectedStatus: 201)
        return try JSONDecoder().decode(CreatedBillSession.self, from: data)
    }

    func fetch(_ credentials: BillSessionCredentials) async throws -> SharedBillSession {
        let data = try await request("v1/sessions/\(credentials.id.uuidString)", token: credentials.token)
        return try JSONDecoder().decode(SharedBillSession.self, from: data)
    }

    func update(_ bill: ItemizedBill, version: Int, credentials: BillSessionCredentials) async throws -> SharedBillSession {
        let body = try JSONEncoder().encode(UpdateRequest(version: version, bill: bill))
        let data = try await request(
            "v1/sessions/\(credentials.id.uuidString)", method: "PUT", token: credentials.token, body: body
        )
        return try JSONDecoder().decode(SharedBillSession.self, from: data)
    }

    private func request(
        _ path: String,
        method: String = "GET",
        token: String? = nil,
        body: Data? = nil,
        expectedStatus: Int = 200
    ) async throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await load(request)
        guard let response = response as? HTTPURLResponse else { throw SharedBillClientError.invalidResponse }
        switch response.statusCode {
        case expectedStatus: return data
        case 401: throw SharedBillClientError.unauthorized
        case 404: throw SharedBillClientError.missing
        case 409: throw SharedBillClientError.conflict
        case 410: throw SharedBillClientError.expired
        default: throw SharedBillClientError.server(response.statusCode)
        }
    }

    private struct CreateRequest: Encodable { let bill: ItemizedBill }
    private struct UpdateRequest: Encodable { let version: Int; let bill: ItemizedBill }
}
