import Foundation

// MARK: - Reservation Status
public enum ReservationStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case confirmed
    case checkedIn = "checked_in"
    case checkedOut = "checked_out"
    case cancelled
}

// MARK: - Check-in Status
public enum CheckInStatus: String, Codable, CaseIterable, Sendable {
    case notStarted = "not_started"
    case pendingId = "pending_id"
    case pendingPayment = "pending_payment"
    case pendingWaiver = "pending_waiver"
    case pendingSiteReady = "pending_site_ready"
    case completed
    case failed
}

// MARK: - Reservation
public struct Reservation: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let campgroundId: String
    public let siteId: String
    public let guestId: String
    public let confirmationNumber: String?

    public let arrivalDate: Date
    public let departureDate: Date
    public let checkInAt: Date?
    public let checkOutAt: Date?

    public let adults: Int
    public let children: Int
    public let petCount: Int?
    public let vehicleCount: Int?

    public let status: String  // Using String to match API response
    public let checkInStatus: CheckInStatus?

    // All amounts in cents
    public let totalAmount: Int
    public let paidAmount: Int
    public let balanceAmount: Int
    public let depositAmount: Int?

    public let notes: String?

    // Expanded relations
    public let guest: Guest?
    public let site: ReservationSite?
    public let campground: ReservationCampground?

    public let createdAt: Date
    public let updatedAt: Date

    // MARK: - Computed Properties (for view compatibility)

    public var startDate: Date { arrivalDate }
    public var endDate: Date { departureDate }

    public var totalAmountCents: Int { totalAmount }
    public var paidAmountCents: Int { paidAmount }
    public var balanceAmountCents: Int { balanceAmount }

    public var siteName: String? { site?.name ?? site?.siteNumber }
    public var campgroundName: String? { campground?.name }
    public var guestName: String? {
        guest?.fullName
    }
    public var guestEmail: String? { guest?.email }
    public var guestCount: Int { adults + children }

    public var totalAmountFormatted: String {
        MoneyFormatter.format(cents: totalAmount)
    }

    public var balanceAmountFormatted: String {
        MoneyFormatter.format(cents: balanceAmount)
    }

    public var nights: Int {
        Calendar.current.dateComponents([.day], from: arrivalDate, to: departureDate).day ?? 1
    }

    public var isPaid: Bool {
        balanceAmount <= 0
    }

    public var canCheckIn: Bool {
        status == "confirmed" && checkInStatus != .completed
    }

    public var canCheckOut: Bool {
        status == "checked_in"
    }
}

// MARK: - Reservation Embedded Types

/// Simplified campground info embedded in reservation responses
public struct ReservationCampground: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
}

/// Simplified site info embedded in reservation responses
public struct ReservationSite: Codable, Equatable, Sendable {
    public let id: String
    public let name: String?
    public let siteNumber: String?
    public let siteType: String?
    public let siteClass: ReservationSiteClass?
}

/// Simplified site class info embedded in reservation responses
public struct ReservationSiteClass: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
}
