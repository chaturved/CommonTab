import Foundation

enum ServerURLValidator {
    static func isAllowed(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(), !host.isEmpty,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else {
            return false
        }
        return scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1"].contains(host))
    }
}
