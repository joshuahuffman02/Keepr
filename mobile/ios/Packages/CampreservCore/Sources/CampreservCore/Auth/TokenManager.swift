import Foundation

/// Error types for token management
public enum TokenError: Error, LocalizedError {
    case noAccessToken
    case noRefreshToken
    case tokenExpired
    case refreshFailed
    case invalidToken

    public var errorDescription: String? {
        switch self {
        case .noAccessToken: return "No access token available"
        case .noRefreshToken: return "No refresh token available"
        case .tokenExpired: return "Token has expired"
        case .refreshFailed: return "Failed to refresh token"
        case .invalidToken: return "Invalid token format"
        }
    }
}

/// JWT payload structure
struct JWTPayload: Decodable {
    let sub: String
    let email: String
    let exp: Int
    let iat: Int?
}

/// Manages JWT access tokens and refresh tokens for mobile authentication
public actor TokenManager {

    private let keychain: KeychainService
    private var accessToken: String?
    private var refreshToken: String?
    private var tokenExpiration: Date?
    private var isRefreshing = false
    private var refreshContinuations: [CheckedContinuation<String, Error>] = []

    // Callback for refreshing token - set by AuthManager
    private var refreshHandler: ((String) async throws -> (accessToken: String, refreshToken: String, expiresIn: Int))?

    public init(keychain: KeychainService) {
        self.keychain = keychain
    }

    // MARK: - Configuration

    public func setRefreshHandler(_ handler: @escaping (String) async throws -> (accessToken: String, refreshToken: String, expiresIn: Int)) {
        self.refreshHandler = handler
    }

    // MARK: - Token State

    public var isAuthenticated: Bool {
        accessToken != nil && refreshToken != nil
    }

    public var currentUserId: String? {
        guard let token = accessToken else { return nil }
        return parseUserId(from: token)
    }

    // MARK: - Token Management

    /// Load tokens from keychain on app launch
    public func loadStoredTokens() async {
        accessToken = await keychain.loadOptional(forKey: KeychainKeys.accessToken)
        refreshToken = await keychain.loadOptional(forKey: KeychainKeys.refreshToken)

        if let expirationString = await keychain.loadOptional(forKey: KeychainKeys.tokenExpiration),
           let interval = Double(expirationString) {
            tokenExpiration = Date(timeIntervalSince1970: interval)
        }
    }

    /// Save tokens after login
    public func saveTokens(accessToken: String, refreshToken: String, expiresIn: Int) async throws {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.tokenExpiration = Date().addingTimeInterval(TimeInterval(expiresIn))

        try await keychain.save(accessToken, forKey: KeychainKeys.accessToken)
        try await keychain.save(refreshToken, forKey: KeychainKeys.refreshToken)
        try await keychain.save(
            String(tokenExpiration!.timeIntervalSince1970),
            forKey: KeychainKeys.tokenExpiration
        )
    }

    /// Clear all tokens (logout)
    public func clearTokens() async {
        accessToken = nil
        refreshToken = nil
        tokenExpiration = nil

        try? await keychain.delete(forKey: KeychainKeys.accessToken)
        try? await keychain.delete(forKey: KeychainKeys.refreshToken)
        try? await keychain.delete(forKey: KeychainKeys.tokenExpiration)
    }

    /// Get the current refresh token (for logout)
    public func getRefreshToken() -> String? {
        return refreshToken
    }

    /// Get a valid access token, refreshing if needed
    public func getValidToken() async throws -> String {
        // If already refreshing, wait for it to complete
        if isRefreshing {
            return try await withCheckedThrowingContinuation { continuation in
                refreshContinuations.append(continuation)
            }
        }

        // Check if current token is still valid (with 5 minute buffer)
        if let token = accessToken, let expiration = tokenExpiration {
            if expiration > Date().addingTimeInterval(300) {
                return token
            }
        }

        // Need to refresh
        return try await refreshAccessToken()
    }

    // MARK: - Private Methods

    private func refreshAccessToken() async throws -> String {
        guard let refresh = refreshToken else {
            throw TokenError.noRefreshToken
        }

        guard let handler = refreshHandler else {
            throw TokenError.refreshFailed
        }

        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let result = try await handler(refresh)

            try await saveTokens(
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            )

            // Resume waiting continuations
            for continuation in refreshContinuations {
                continuation.resume(returning: result.accessToken)
            }
            refreshContinuations.removeAll()

            return result.accessToken
        } catch {
            // Clear tokens on refresh failure
            await clearTokens()

            // Resume waiting continuations with error
            for continuation in refreshContinuations {
                continuation.resume(throwing: error)
            }
            refreshContinuations.removeAll()

            throw error
        }
    }

    private func parseUserId(from token: String) -> String? {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else { return nil }

        var base64 = parts[1]
        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        guard let data = Data(base64Encoded: base64),
              let payload = try? JSONDecoder().decode(JWTPayload.self, from: data) else {
            return nil
        }

        return payload.sub
    }

    private func parseTokenExpiration(from token: String) -> Date? {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else { return nil }

        var base64 = parts[1]
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        guard let data = Data(base64Encoded: base64),
              let payload = try? JSONDecoder().decode(JWTPayload.self, from: data) else {
            return nil
        }

        return Date(timeIntervalSince1970: TimeInterval(payload.exp))
    }
}
