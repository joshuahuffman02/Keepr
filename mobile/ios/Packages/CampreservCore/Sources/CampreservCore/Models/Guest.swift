import Foundation

// MARK: - Guest
public struct Guest: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let primaryFirstName: String
    public let primaryLastName: String
    public let email: String
    public let phone: String?

    // Address
    public let address1: String?
    public let address2: String?
    public let city: String?
    public let state: String?
    public let postalCode: String?
    public let country: String?

    // Vehicle info
    public let rigType: String?
    public let rigLength: Int?
    public let vehiclePlate: String?
    public let vehicleState: String?

    // Preferences
    public let preferredContact: String?
    public let preferredLanguage: String?
    public let tags: [String]?
    public let vip: Bool?
    public let marketingOptIn: Bool?

    // History
    public let repeatStays: Int?
    public let notes: String?

    public let createdAt: Date?
    public let updatedAt: Date?

    // MARK: - Computed Properties

    public var fullName: String {
        "\(primaryFirstName) \(primaryLastName)"
    }

    public var initials: String {
        let first = primaryFirstName.prefix(1).uppercased()
        let last = primaryLastName.prefix(1).uppercased()
        return "\(first)\(last)"
    }

    public var formattedAddress: String? {
        var parts: [String] = []
        if let address1 = address1, !address1.isEmpty { parts.append(address1) }
        if let address2 = address2, !address2.isEmpty { parts.append(address2) }
        var cityStateLine: [String] = []
        if let city = city, !city.isEmpty { cityStateLine.append(city) }
        if let state = state, !state.isEmpty { cityStateLine.append(state) }
        if let postalCode = postalCode, !postalCode.isEmpty { cityStateLine.append(postalCode) }
        if !cityStateLine.isEmpty { parts.append(cityStateLine.joined(separator: ", ")) }
        return parts.isEmpty ? nil : parts.joined(separator: "\n")
    }
}
