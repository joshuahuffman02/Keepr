import SwiftUI
import CampreservCore

/// Central app state manager
@MainActor
final class AppState: ObservableObject {

    @Published var isLoading = true
    @Published var isAuthenticated = false
    @Published var currentGuest: Guest?
    @Published var error: Error?

    private let tokenManager: TokenManager
    private let apiClient: APIClient

    init() {
        let keychain = KeychainService(serviceName: "com.campreserv.guest")
        self.tokenManager = TokenManager(keychain: keychain)

        let baseURL = URL(string: Configuration.apiBaseURL)!
        self.apiClient = APIClient(baseURL: baseURL, tokenManager: tokenManager)
    }

    // MARK: - Auth State

    func checkAuthState() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Try to get a valid token (will refresh if needed)
            _ = try await tokenManager.getValidToken()
            isAuthenticated = true

            // Load guest profile
            await loadProfile()
        } catch {
            isAuthenticated = false
            currentGuest = nil
        }
    }

    func loadProfile() async {
        do {
            currentGuest = try await apiClient.request(.guestProfile)
        } catch {
            self.error = error
        }
    }

    // MARK: - Magic Link Auth

    func requestMagicLink(email: String) async throws {
        try await apiClient.request(.guestMagicLink(email: email))
    }

    func verifyMagicLink(token: String) async throws {
        struct MagicLinkResponse: Decodable {
            let accessToken: String
            let refreshToken: String
            let expiresIn: Int
        }

        let response: MagicLinkResponse = try await apiClient.request(.verifyMagicLink(token: token))

        try await tokenManager.saveTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn
        )

        isAuthenticated = true
        await loadProfile()
    }

    // MARK: - Logout

    func logout() async {
        do {
            // Try to logout on server
            if let refreshToken = await tokenManager.getRefreshToken() {
                try await apiClient.request(.logout(refreshToken: refreshToken))
            }
        } catch {
            // Ignore logout errors, still clear local state
        }

        await tokenManager.clearTokens()
        isAuthenticated = false
        currentGuest = nil
    }
}

// MARK: - Configuration

enum Configuration {
    #if DEBUG
    static let apiBaseURL = "http://localhost:4000"
    #else
    static let apiBaseURL = "https://api.campreserv.com"
    #endif
}
