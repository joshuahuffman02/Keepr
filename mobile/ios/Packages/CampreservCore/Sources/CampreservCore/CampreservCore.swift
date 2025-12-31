// CampreservCore
// Shared networking, authentication, and models for Campreserv iOS apps

@_exported import Foundation

// Re-export all public types for convenience

// Models
public typealias ReservationModel = Reservation
public typealias GuestModel = Guest
public typealias CampgroundModel = Campground
public typealias UserModel = User

// Networking
public typealias CampreservAPIClient = APIClient
public typealias CampreservAPIEndpoint = APIEndpoint
public typealias CampreservAPIError = APIError

// Auth
public typealias CampreservTokenManager = TokenManager
public typealias CampreservKeychainService = KeychainService

/// Configuration for CampreservCore
public struct CampreservCoreConfiguration {
    public let apiBaseURL: URL
    public let environment: Environment

    public enum Environment {
        case development
        case staging
        case production

        public var isDebug: Bool {
            self != .production
        }
    }

    public init(apiBaseURL: URL, environment: Environment = .production) {
        self.apiBaseURL = apiBaseURL
        self.environment = environment
    }

    /// Default development configuration
    public static var development: CampreservCoreConfiguration {
        CampreservCoreConfiguration(
            apiBaseURL: URL(string: "http://localhost:4000")!,
            environment: .development
        )
    }

    /// Default production configuration
    public static var production: CampreservCoreConfiguration {
        CampreservCoreConfiguration(
            apiBaseURL: URL(string: "https://api.campreserv.com")!,
            environment: .production
        )
    }
}
