import Foundation

// MARK: - Campground
public struct Campground: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let organizationId: String?
    public let name: String
    public let slug: String

    // Location
    public let city: String?
    public let state: String?
    public let country: String?
    public let address1: String?
    public let postalCode: String?
    public let latitude: Double?
    public let longitude: Double?
    public let timezone: String?

    // Contact
    public let phone: String?
    public let email: String?
    public let website: String?

    // Operations
    public let seasonStart: String?
    public let seasonEnd: String?
    public let checkInTime: String?
    public let checkOutTime: String?

    // Branding
    public let logoUrl: String?
    public let primaryColor: String?

    // Financial
    public let currency: String?

    public let createdAt: Date?
    public let updatedAt: Date?

    // MARK: - Computed Properties

    public var formattedLocation: String? {
        var parts: [String] = []
        if let city = city, !city.isEmpty { parts.append(city) }
        if let state = state, !state.isEmpty { parts.append(state) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    public var hasCoordinates: Bool {
        latitude != nil && longitude != nil
    }

    // MARK: - Convenience Init for Demo

    public init(
        id: String,
        organizationId: String? = nil,
        name: String,
        slug: String? = nil,
        city: String? = nil,
        state: String? = nil,
        country: String? = nil,
        address1: String? = nil,
        postalCode: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        timezone: String? = nil,
        phone: String? = nil,
        email: String? = nil,
        website: String? = nil,
        seasonStart: String? = nil,
        seasonEnd: String? = nil,
        checkInTime: String? = nil,
        checkOutTime: String? = nil,
        logoUrl: String? = nil,
        primaryColor: String? = nil,
        currency: String? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.organizationId = organizationId
        self.name = name
        self.slug = slug ?? id
        self.city = city
        self.state = state
        self.country = country
        self.address1 = address1
        self.postalCode = postalCode
        self.latitude = latitude
        self.longitude = longitude
        self.timezone = timezone
        self.phone = phone
        self.email = email
        self.website = website
        self.seasonStart = seasonStart
        self.seasonEnd = seasonEnd
        self.checkInTime = checkInTime
        self.checkOutTime = checkOutTime
        self.logoUrl = logoUrl
        self.primaryColor = primaryColor
        self.currency = currency
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Campground Summary (for lists)
public struct CampgroundSummary: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let slug: String
    public let role: String?

    public init(id: String, name: String, slug: String, role: String? = nil) {
        self.id = id
        self.name = name
        self.slug = slug
        self.role = role
    }
}
