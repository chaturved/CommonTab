import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

enum ProductEvent: String, Encodable {
    case calculatorOpened = "calculator_opened"
    case scanOpened = "scan_opened"
    case scanCompleted = "scan_completed"
    case itemizedOpened = "itemized_opened"
    case shareCreated = "share_created"
}

struct ProductAnalytics: Sendable {
    typealias Loader = @Sendable (URLRequest) async throws -> (Data, URLResponse)
    private let client: SharedBillClient
    private let load: Loader

    init(serverURL: URL, load: @escaping Loader = { try await URLSession.shared.data(for: $0) }) throws {
        client = try SharedBillClient(baseURL: serverURL)
        self.load = load
    }

    func record(_ event: ProductEvent, variant: String) async throws {
        guard variant == "A" || variant == "B" else { return }
        var request = URLRequest(url: client.baseURL.appendingPathComponent("v1/events"))
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(EventBody(name: event, variant: variant))
        let (_, response) = try await load(request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 202 else {
            throw SharedBillClientError.invalidResponse
        }
    }

    private struct EventBody: Encodable {
        let name: ProductEvent
        let variant: String
    }
}
