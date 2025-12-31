import Foundation

// MARK: - User Role
public enum UserRole: String, Codable, CaseIterable, Sendable {
    case owner
    case manager
    case frontDesk = "front_desk"
    case maintenance
    case finance
    case marketing
    case readonly
}

// MARK: - Platform Role
public enum PlatformRole: String, Codable, CaseIterable, Sendable {
    case supportAgent = "support_agent"
    case supportLead = "support_lead"
    case regionalSupport = "regional_support"
    case opsEngineer = "ops_engineer"
    case platformAdmin = "platform_admin"
}

// MARK: - User
public struct User: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let email: String
    public let firstName: String
    public let lastName: String
    public let platformRole: PlatformRole?
    public let campgrounds: [CampgroundSummary]?

    // MARK: - Computed Properties

    public var fullName: String {
        "\(firstName) \(lastName)"
    }

    public var initials: String {
        let first = firstName.prefix(1).uppercased()
        let last = lastName.prefix(1).uppercased()
        return "\(first)\(last)"
    }

    public var isPlatformAdmin: Bool {
        platformRole == .platformAdmin
    }

    /// Get the user's role for a specific campground
    public func role(for campgroundId: String) -> UserRole? {
        guard let campgrounds = campgrounds,
              let match = campgrounds.first(where: { $0.id == campgroundId }),
              let roleString = match.role else {
            return nil
        }
        return UserRole(rawValue: roleString)
    }

    // MARK: - Convenience Init for Demo

    public init(
        id: String,
        email: String,
        firstName: String,
        lastName: String,
        platformRole: PlatformRole? = nil,
        campgrounds: [CampgroundSummary]? = nil
    ) {
        self.id = id
        self.email = email
        self.firstName = firstName
        self.lastName = lastName
        self.platformRole = platformRole
        self.campgrounds = campgrounds
    }
}
