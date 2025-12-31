import Foundation
import KeychainAccess

/// Error types for Keychain operations
public enum KeychainError: Error {
    case itemNotFound
    case saveFailed
    case deleteFailed
    case unexpectedData
}

/// Service for securely storing sensitive data in the iOS Keychain
public actor KeychainService {

    private let keychain: Keychain
    private let serviceName: String

    public init(serviceName: String = "com.campreserv.app") {
        self.serviceName = serviceName
        self.keychain = Keychain(service: serviceName)
            .accessibility(.afterFirstUnlock)
    }

    // MARK: - Public Methods

    public func save(_ value: String, forKey key: String) async throws {
        do {
            try keychain.set(value, key: key)
        } catch {
            throw KeychainError.saveFailed
        }
    }

    public func load(forKey key: String) async throws -> String {
        guard let value = try keychain.get(key) else {
            throw KeychainError.itemNotFound
        }
        return value
    }

    public func loadOptional(forKey key: String) async -> String? {
        return try? keychain.get(key)
    }

    public func delete(forKey key: String) async throws {
        do {
            try keychain.remove(key)
        } catch {
            throw KeychainError.deleteFailed
        }
    }

    public func deleteAll() async throws {
        do {
            try keychain.removeAll()
        } catch {
            throw KeychainError.deleteFailed
        }
    }

    public func contains(key: String) async -> Bool {
        return (try? keychain.contains(key)) ?? false
    }
}

// MARK: - Keychain Keys
public enum KeychainKeys {
    public static let accessToken = "campreserv.accessToken"
    public static let refreshToken = "campreserv.refreshToken"
    public static let tokenExpiration = "campreserv.tokenExpiration"
    public static let userId = "campreserv.userId"
    public static let userEmail = "campreserv.userEmail"
    public static let deviceId = "campreserv.deviceId"
}
