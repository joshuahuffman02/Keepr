import Foundation

/// HTTP methods
public enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// API endpoints for the Campreserv API
public enum APIEndpoint {

    // MARK: - Auth
    case mobileLogin(email: String, password: String, deviceId: String?, deviceName: String?, platform: String, appVersion: String?)
    case refreshToken(refreshToken: String)
    case logout(refreshToken: String)
    case getMobileSessions
    case revokeMobileSession(sessionId: String)

    // MARK: - Guest Auth (Magic Link)
    case guestMagicLink(email: String)
    case verifyMagicLink(token: String)
    case guestProfile

    // MARK: - User
    case getProfile

    // MARK: - Campgrounds
    case getCampgrounds
    case getCampground(id: String)
    case getPublicCampgrounds
    case getPublicCampground(slug: String)

    // MARK: - Reservations
    case getReservations(campgroundId: String, status: String?, limit: Int?, offset: Int?)
    case getReservation(id: String)
    case createReservation(campgroundId: String, data: [String: Any])
    case updateReservation(id: String, data: [String: Any])
    case cancelReservation(id: String)

    // MARK: - Self Check-in/out
    case getCheckinStatus(reservationId: String)
    case selfCheckin(reservationId: String, data: [String: Any]?)
    case selfCheckout(reservationId: String, data: [String: Any]?)

    // MARK: - Staff Check-in/out
    case staffCheckin(reservationId: String, data: [String: Any]?)
    case staffCheckout(reservationId: String, data: [String: Any]?)

    // MARK: - Messaging
    case getMessages(reservationId: String)
    case sendMessage(reservationId: String, content: String)
    case markMessagesRead(reservationId: String)

    // MARK: - Guests
    case getGuests(campgroundId: String, search: String?, limit: Int?, offset: Int?)
    case getGuest(id: String)
    case createGuest(campgroundId: String, data: [String: Any])
    case updateGuest(id: String, data: [String: Any])

    // MARK: - Sites
    case getSites(campgroundId: String)
    case getSite(id: String)
    case getSiteAvailability(campgroundId: String, startDate: String, endDate: String)

    // MARK: - Availability
    case checkAvailability(campgroundId: String, startDate: String, endDate: String, siteClassId: String?)
    case getQuote(campgroundId: String, data: [String: Any])

    // MARK: - Payments
    case recordPayment(reservationId: String, data: [String: Any])
    case refundPayment(reservationId: String, paymentId: String, data: [String: Any])

    // MARK: - Terminal (POS)
    case getTerminalLocations(campgroundId: String)
    case getTerminalReaders(campgroundId: String)
    case createTerminalPayment(campgroundId: String, data: [String: Any])
    case processTerminalPayment(campgroundId: String, intentId: String, readerId: String)
    case getTerminalPaymentStatus(campgroundId: String, intentId: String)
    case cancelTerminalPayment(campgroundId: String, intentId: String)
    case getTerminalConnectionToken(campgroundId: String)

    // MARK: - Store/POS
    case getStoreProducts(campgroundId: String, categoryId: String?)
    case getStoreCategories(campgroundId: String)
    case createStoreOrder(campgroundId: String, data: [String: Any])
    case getStoreOrders(campgroundId: String, status: String?, limit: Int?, offset: Int?)
    case completeStoreOrder(orderId: String)

    // MARK: - Tasks/Maintenance
    case getTasks(campgroundId: String, state: String?, type: String?)
    case getTask(id: String)
    case createTask(campgroundId: String, data: [String: Any])
    case updateTask(id: String, data: [String: Any])

    // MARK: - Dashboard
    case getDashboardSummary(campgroundId: String)

    // MARK: - Push Notifications
    case registerDevice(deviceToken: String, platform: String, deviceId: String?, appBundle: String?, appVersion: String?, campgroundId: String?)
    case unregisterDevice(deviceToken: String)
    case getDevices

    // MARK: - Reviews
    case submitReview(data: [String: Any])
    case getPublicReviews(campgroundSlug: String)

    // MARK: - Properties

    public var path: String {
        switch self {
        // Auth
        case .mobileLogin: return "/auth/mobile/login"
        case .refreshToken: return "/auth/mobile/refresh"
        case .logout: return "/auth/mobile/logout"
        case .getMobileSessions: return "/auth/mobile/sessions"
        case .revokeMobileSession(let sessionId): return "/auth/mobile/sessions/\(sessionId)"

        // Guest Auth
        case .guestMagicLink: return "/guest-auth/magic-link"
        case .verifyMagicLink: return "/guest-auth/verify"
        case .guestProfile: return "/guest-auth/me"

        // User
        case .getProfile: return "/auth/me"

        // Campgrounds
        case .getCampgrounds: return "/campgrounds"
        case .getCampground(let id): return "/campgrounds/\(id)"
        case .getPublicCampgrounds: return "/public/campgrounds"
        case .getPublicCampground(let slug): return "/public/campgrounds/\(slug)"

        // Reservations
        case .getReservations(let campgroundId, _, _, _): return "/campgrounds/\(campgroundId)/reservations"
        case .getReservation(let id): return "/reservations/\(id)"
        case .createReservation(let campgroundId, _): return "/campgrounds/\(campgroundId)/reservations"
        case .updateReservation(let id, _): return "/reservations/\(id)"
        case .cancelReservation(let id): return "/reservations/\(id)/cancel"

        // Check-in/out
        case .getCheckinStatus(let reservationId): return "/reservations/\(reservationId)/checkin-status"
        case .selfCheckin(let reservationId, _): return "/reservations/\(reservationId)/self-checkin"
        case .selfCheckout(let reservationId, _): return "/reservations/\(reservationId)/self-checkout"
        case .staffCheckin(let reservationId, _): return "/reservations/\(reservationId)/check-in"
        case .staffCheckout(let reservationId, _): return "/reservations/\(reservationId)/check-out"

        // Messaging
        case .getMessages(let reservationId): return "/reservations/\(reservationId)/messages"
        case .sendMessage(let reservationId, _): return "/reservations/\(reservationId)/messages"
        case .markMessagesRead(let reservationId): return "/reservations/\(reservationId)/messages/read"

        // Guests
        case .getGuests(let campgroundId, _, _, _): return "/campgrounds/\(campgroundId)/guests"
        case .getGuest(let id): return "/guests/\(id)"
        case .createGuest(let campgroundId, _): return "/campgrounds/\(campgroundId)/guests"
        case .updateGuest(let id, _): return "/guests/\(id)"

        // Sites
        case .getSites(let campgroundId): return "/campgrounds/\(campgroundId)/sites"
        case .getSite(let id): return "/sites/\(id)"
        case .getSiteAvailability(let campgroundId, _, _): return "/campgrounds/\(campgroundId)/sites/status"

        // Availability
        case .checkAvailability(let campgroundId, _, _, _): return "/campgrounds/\(campgroundId)/availability"
        case .getQuote(let campgroundId, _): return "/campgrounds/\(campgroundId)/quote"

        // Payments
        case .recordPayment(let reservationId, _): return "/reservations/\(reservationId)/payments"
        case .refundPayment(let reservationId, let paymentId, _): return "/reservations/\(reservationId)/payments/\(paymentId)/refund"

        // Terminal
        case .getTerminalLocations(let campgroundId): return "/campgrounds/\(campgroundId)/terminal/locations"
        case .getTerminalReaders(let campgroundId): return "/campgrounds/\(campgroundId)/terminal/readers"
        case .createTerminalPayment(let campgroundId, _): return "/campgrounds/\(campgroundId)/terminal/payments"
        case .processTerminalPayment(let campgroundId, let intentId, _): return "/campgrounds/\(campgroundId)/terminal/payments/\(intentId)/process"
        case .getTerminalPaymentStatus(let campgroundId, let intentId): return "/campgrounds/\(campgroundId)/terminal/payments/\(intentId)/status"
        case .cancelTerminalPayment(let campgroundId, let intentId): return "/campgrounds/\(campgroundId)/terminal/payments/\(intentId)/cancel"
        case .getTerminalConnectionToken(let campgroundId): return "/campgrounds/\(campgroundId)/terminal/connection-token"

        // Store
        case .getStoreProducts(let campgroundId, _): return "/campgrounds/\(campgroundId)/store/products"
        case .getStoreCategories(let campgroundId): return "/campgrounds/\(campgroundId)/store/categories"
        case .createStoreOrder(let campgroundId, _): return "/campgrounds/\(campgroundId)/store/orders"
        case .getStoreOrders(let campgroundId, _, _, _): return "/campgrounds/\(campgroundId)/store/orders"
        case .completeStoreOrder(let orderId): return "/store/orders/\(orderId)/complete"

        // Tasks
        case .getTasks(let campgroundId, _, _): return "/campgrounds/\(campgroundId)/tasks"
        case .getTask(let id): return "/tasks/\(id)"
        case .createTask(let campgroundId, _): return "/campgrounds/\(campgroundId)/tasks"
        case .updateTask(let id, _): return "/tasks/\(id)"

        // Dashboard
        case .getDashboardSummary(let campgroundId): return "/dashboard/campgrounds/\(campgroundId)/summary"

        // Push
        case .registerDevice: return "/push/mobile/register"
        case .unregisterDevice: return "/push/mobile/unregister"
        case .getDevices: return "/push/mobile/devices"

        // Reviews
        case .submitReview: return "/reviews/submit"
        case .getPublicReviews(let slug): return "/public/campgrounds/\(slug)/reviews"
        }
    }

    public var method: HTTPMethod {
        switch self {
        case .mobileLogin, .refreshToken, .logout,
             .guestMagicLink, .verifyMagicLink,
             .createReservation, .cancelReservation,
             .selfCheckin, .selfCheckout, .staffCheckin, .staffCheckout,
             .sendMessage, .markMessagesRead,
             .createGuest,
             .recordPayment, .refundPayment,
             .createTerminalPayment, .processTerminalPayment, .cancelTerminalPayment,
             .createStoreOrder,
             .createTask,
             .registerDevice, .unregisterDevice,
             .submitReview:
            return .post

        case .updateReservation, .updateGuest, .updateTask, .completeStoreOrder:
            return .patch

        case .revokeMobileSession:
            return .delete

        default:
            return .get
        }
    }

    public var requiresAuth: Bool {
        switch self {
        case .mobileLogin, .refreshToken, .guestMagicLink, .verifyMagicLink,
             .getPublicCampgrounds, .getPublicCampground, .getPublicReviews,
             .getCheckinStatus, .selfCheckin, .selfCheckout, .submitReview:
            return false
        default:
            return true
        }
    }

    public var queryItems: [URLQueryItem]? {
        switch self {
        case .getReservations(_, let status, let limit, let offset):
            var items: [URLQueryItem] = []
            if let status = status { items.append(URLQueryItem(name: "status", value: status)) }
            if let limit = limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
            if let offset = offset { items.append(URLQueryItem(name: "offset", value: String(offset))) }
            return items.isEmpty ? nil : items

        case .getGuests(_, let search, let limit, let offset):
            var items: [URLQueryItem] = []
            if let search = search { items.append(URLQueryItem(name: "search", value: search)) }
            if let limit = limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
            if let offset = offset { items.append(URLQueryItem(name: "offset", value: String(offset))) }
            return items.isEmpty ? nil : items

        case .getSiteAvailability(_, let startDate, let endDate):
            return [
                URLQueryItem(name: "startDate", value: startDate),
                URLQueryItem(name: "endDate", value: endDate)
            ]

        case .checkAvailability(_, let startDate, let endDate, let siteClassId):
            var items = [
                URLQueryItem(name: "startDate", value: startDate),
                URLQueryItem(name: "endDate", value: endDate)
            ]
            if let siteClassId = siteClassId {
                items.append(URLQueryItem(name: "siteClassId", value: siteClassId))
            }
            return items

        case .getStoreProducts(_, let categoryId):
            if let categoryId = categoryId {
                return [URLQueryItem(name: "categoryId", value: categoryId)]
            }
            return nil

        case .getStoreOrders(_, let status, let limit, let offset):
            var items: [URLQueryItem] = []
            if let status = status { items.append(URLQueryItem(name: "status", value: status)) }
            if let limit = limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
            if let offset = offset { items.append(URLQueryItem(name: "offset", value: String(offset))) }
            return items.isEmpty ? nil : items

        case .getTasks(_, let state, let type):
            var items: [URLQueryItem] = []
            if let state = state { items.append(URLQueryItem(name: "state", value: state)) }
            if let type = type { items.append(URLQueryItem(name: "type", value: type)) }
            return items.isEmpty ? nil : items

        default:
            return nil
        }
    }
}
