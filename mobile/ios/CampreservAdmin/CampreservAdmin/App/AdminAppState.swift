import SwiftUI
import CampreservCore

/// Central app state manager for admin app
@MainActor
final class AdminAppState: ObservableObject {

    @Published var isLoading = true
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var currentCampground: Campground?
    @Published var campgrounds: [Campground] = []
    @Published var error: Error?

    private let tokenManager: TokenManager
    private let apiClient: APIClient

    init() {
        let keychain = KeychainService(serviceName: "com.campreserv.admin")
        self.tokenManager = TokenManager(keychain: keychain)

        let baseURL = URL(string: AdminConfiguration.apiBaseURL)!
        self.apiClient = APIClient(baseURL: baseURL, tokenManager: tokenManager)
    }

    // MARK: - Auth State

    func checkAuthState() async {
        isLoading = true
        defer { isLoading = false }

        do {
            _ = try await tokenManager.getValidToken()
            isAuthenticated = true
            await loadProfile()
            await loadCampgrounds()
        } catch {
            isAuthenticated = false
            currentUser = nil
            currentCampground = nil
        }
    }

    func loadProfile() async {
        do {
            currentUser = try await apiClient.request(.getProfile)
        } catch {
            self.error = error
        }
    }

    func loadCampgrounds() async {
        do {
            campgrounds = try await apiClient.request(.getCampgrounds)

            // Auto-select if only one campground
            if campgrounds.count == 1 {
                currentCampground = campgrounds.first
            }
        } catch {
            self.error = error
        }
    }

    // MARK: - Login

    func login(email: String, password: String, deviceId: String? = nil) async throws {
        struct LoginResponse: Decodable {
            let accessToken: String
            let refreshToken: String
            let expiresIn: Int
        }

        let response: LoginResponse = try await apiClient.request(
            .mobileLogin(
                email: email,
                password: password,
                deviceId: deviceId,
                deviceName: UIDevice.current.name,
                platform: "ios",
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
            )
        )

        try await tokenManager.saveTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresIn: response.expiresIn
        )

        isAuthenticated = true
        await loadProfile()
        await loadCampgrounds()
    }

    // MARK: - Campground Selection

    func selectCampground(_ campground: Campground) {
        currentCampground = campground
    }

    // MARK: - Logout

    func logout() async {
        do {
            if let refreshToken = await tokenManager.getRefreshToken() {
                try await apiClient.request(.logout(refreshToken: refreshToken))
            }
        } catch {
            // Ignore logout errors
        }

        await tokenManager.clearTokens()
        isAuthenticated = false
        currentUser = nil
        currentCampground = nil
        campgrounds = []
    }

    // MARK: - API Access

    func getAPIClient() -> APIClient {
        return apiClient
    }

    func getCampgroundId() -> String? {
        return currentCampground?.id
    }
}

// MARK: - Configuration

enum AdminConfiguration {
    #if DEBUG
    static let apiBaseURL = "http://localhost:4000"
    #else
    static let apiBaseURL = "https://api.campreserv.com"
    #endif
}
