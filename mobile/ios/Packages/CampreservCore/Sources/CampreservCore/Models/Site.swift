import Foundation

/// Site model representing a bookable campsite
public struct Site: Codable, Sendable, Identifiable {
    public let id: String
    public let campgroundId: String
    public let siteClassId: String?
    public let name: String
    public let description: String?
    public let basePriceCents: Int
    public let maxGuests: Int?
    public let maxVehicles: Int?
    public let length: Int?
    public let width: Int?
    public let amperage: Int?
    public let hasWater: Bool
    public let hasSewer: Bool
    public let hasElectric: Bool
    public let isActive: Bool
    public let sortOrder: Int?
    public let siteClassName: String?
    public let createdAt: Date?
    public let updatedAt: Date?

    public init(
        id: String,
        campgroundId: String,
        siteClassId: String? = nil,
        name: String,
        description: String? = nil,
        basePriceCents: Int,
        maxGuests: Int? = nil,
        maxVehicles: Int? = nil,
        length: Int? = nil,
        width: Int? = nil,
        amperage: Int? = nil,
        hasWater: Bool = false,
        hasSewer: Bool = false,
        hasElectric: Bool = false,
        isActive: Bool = true,
        sortOrder: Int? = nil,
        siteClassName: String? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.campgroundId = campgroundId
        self.siteClassId = siteClassId
        self.name = name
        self.description = description
        self.basePriceCents = basePriceCents
        self.maxGuests = maxGuests
        self.maxVehicles = maxVehicles
        self.length = length
        self.width = width
        self.amperage = amperage
        self.hasWater = hasWater
        self.hasSewer = hasSewer
        self.hasElectric = hasElectric
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.siteClassName = siteClassName
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Site availability for a date range
public struct SiteAvailability: Codable, Sendable {
    public let site: Site
    public let isAvailable: Bool
    public let unavailableDates: [Date]?
    public let pricePerNightCents: Int

    public init(
        site: Site,
        isAvailable: Bool,
        unavailableDates: [Date]? = nil,
        pricePerNightCents: Int
    ) {
        self.site = site
        self.isAvailable = isAvailable
        self.unavailableDates = unavailableDates
        self.pricePerNightCents = pricePerNightCents
    }
}
