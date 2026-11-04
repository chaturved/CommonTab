import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct ExchangeRate: Decodable, Equatable {
    let date: String
    let base: String
    let quote: String
    let rate: Decimal
}

enum ExchangeRateError: Error, Equatable {
    case invalidCurrency
    case invalidResponse
    case invalidRate
}

actor ExchangeRateService {
    private let load: @Sendable (URL) async throws -> (Data, URLResponse)
    private var cachedRates: [String: (value: ExchangeRate, fetchedAt: Date)] = [:]

    init(load: @escaping @Sendable (URL) async throws -> (Data, URLResponse) = {
        try await URLSession.shared.data(from: $0)
    }) {
        self.load = load
    }

    func rate(from base: String, to quote: String) async throws -> ExchangeRate {
        let base = base.lowercased()
        let quote = quote.lowercased()
        guard base.count == 3, quote.count == 3,
              base.allSatisfy(\.isASCII), quote.allSatisfy(\.isASCII),
              base.allSatisfy(\.isLetter), quote.allSatisfy(\.isLetter) else {
            throw ExchangeRateError.invalidCurrency
        }

        let key = "\(base)/\(quote)"
        if let cached = cachedRates[key], Date().timeIntervalSince(cached.fetchedAt) < 3_600 {
            return cached.value
        }

        guard let url = URL(string: "https://api.frankfurter.dev/v2/rate/\(base)/\(quote)") else {
            throw ExchangeRateError.invalidCurrency
        }
        let (data, response) = try await load(url)
        guard let response = response as? HTTPURLResponse,
              (200...299).contains(response.statusCode) else {
            throw ExchangeRateError.invalidResponse
        }

        let value = try JSONDecoder().decode(ExchangeRate.self, from: data)
        guard value.rate > 0, value.base.lowercased() == base,
              value.quote.lowercased() == quote else {
            throw ExchangeRateError.invalidRate
        }
        cachedRates[key] = (value, Date())
        return value
    }
}
