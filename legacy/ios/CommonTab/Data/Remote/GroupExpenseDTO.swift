import Foundation

struct APIAccount: Codable, Identifiable, Sendable {
    let id: UUID
    let email: String
    let name: String
}

struct APIAuthSession: Codable, Sendable {
    let accessToken: String
    let expiresAt: String
    let user: APIAccount
}

struct APIGroupMember: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let email: String
}

struct APIAllocation: Codable, Sendable {
    let memberID: UUID
    let minorUnits: Int64
}

struct APIExpense: Codable, Identifiable, Sendable {
    let id: UUID
    let groupID: UUID
    let merchant: String
    let occurredAt: String
    let category: String
    let notes: String
    let amountMinor: Int64
    let payerID: UUID
    let method: String
    let allocations: [APIAllocation]
    let values: [String]
    let version: Int
    let hasReceipt: Bool
}

struct APISettlement: Codable, Identifiable, Sendable {
    let id: UUID
    let groupID: UUID
    let fromID: UUID
    let toID: UUID
    let amountMinor: Int64
    let createdAt: String
}

struct APIBalance: Codable, Sendable {
    let memberID: UUID
    let minorUnits: Int64
}

struct APIGroup: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let currencyCode: String
    let ownerID: UUID
    let version: Int
    let members: [APIGroupMember]
    let expenses: [APIExpense]
    let settlements: [APISettlement]
    let balances: [APIBalance]
}

struct APIInvitation: Codable, Sendable {
    let inviteToken: String
    let expiresAt: String
    let email: String
    let groupID: UUID
}

struct APIExpenseDraft: Encodable, Sendable {
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
