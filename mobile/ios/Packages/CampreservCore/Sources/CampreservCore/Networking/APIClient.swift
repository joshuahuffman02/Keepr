import Foundation

/// Protocol for API client
public protocol APIClientProtocol: Sendable {
    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T
    func request(_ endpoint: APIEndpoint) async throws
}

/// Main API client for Campreserv
public actor APIClient: APIClientProtocol {

    private let baseURL: URL
    private let session: URLSession
    private let tokenManager: TokenManager
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(
        baseURL: URL,
        tokenManager: TokenManager,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.tokenManager = tokenManager
        self.session = session

        // Configure decoder for API responses
        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try ISO8601 with fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) {
                return date
            }

            // Try ISO8601 without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date format: \(dateString)")
        }
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        // Configure encoder for API requests
        self.encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Public Methods

    public func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let request = try await buildRequest(for: endpoint)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    public func request(_ endpoint: APIEndpoint) async throws {
        let request = try await buildRequest(for: endpoint)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    // MARK: - Private Methods

    private func buildRequest(for endpoint: APIEndpoint) async throws -> URLRequest {
        var url = baseURL.appendingPathComponent(endpoint.path)

        // Add query items if present
        if let queryItems = endpoint.queryItems, !queryItems.isEmpty {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: true)!
            components.queryItems = queryItems
            url = components.url!
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("CampreservApp/iOS", forHTTPHeaderField: "User-Agent")

        // Add auth header if required
        if endpoint.requiresAuth {
            let token = try await tokenManager.getValidToken()
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Add body for endpoints that need it
        if let body = buildBody(for: endpoint) {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        return request
    }

    private func buildBody(for endpoint: APIEndpoint) -> [String: Any]? {
        switch endpoint {
        case .mobileLogin(let email, let password, let deviceId, let deviceName, let platform, let appVersion):
            var body: [String: Any] = [
                "email": email,
                "password": password,
                "platform": platform
            ]
            if let deviceId = deviceId { body["deviceId"] = deviceId }
            if let deviceName = deviceName { body["deviceName"] = deviceName }
            if let appVersion = appVersion { body["appVersion"] = appVersion }
            return body

        case .refreshToken(let refreshToken):
            return ["refreshToken": refreshToken]

        case .logout(let refreshToken):
            return ["refreshToken": refreshToken]

        case .guestMagicLink(let email):
            return ["email": email]

        case .verifyMagicLink(let token):
            return ["token": token]

        case .createReservation(_, let data),
             .updateReservation(_, let data),
             .createGuest(_, let data),
             .updateGuest(_, let data),
             .recordPayment(_, let data),
             .refundPayment(_, _, let data),
             .createTerminalPayment(_, let data),
             .createStoreOrder(_, let data),
             .createTask(_, let data),
             .updateTask(_, let data),
             .getQuote(_, let data),
             .submitReview(let data):
            return data

        case .selfCheckin(_, let data),
             .selfCheckout(_, let data),
             .staffCheckin(_, let data),
             .staffCheckout(_, let data):
            return data

        case .sendMessage(_, let content):
            return ["content": content]

        case .processTerminalPayment(_, _, let readerId):
            return ["readerId": readerId]

        case .registerDevice(let deviceToken, let platform, let deviceId, let appBundle, let appVersion, let campgroundId):
            var body: [String: Any] = [
                "deviceToken": deviceToken,
                "platform": platform
            ]
            if let deviceId = deviceId { body["deviceId"] = deviceId }
            if let appBundle = appBundle { body["appBundle"] = appBundle }
            if let appVersion = appVersion { body["appVersion"] = appVersion }
            if let campgroundId = campgroundId { body["campgroundId"] = campgroundId }
            return body

        case .unregisterDevice(let deviceToken):
            return ["deviceToken": deviceToken]

        default:
            return nil
        }
    }

    private func performRequest(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 409:
            let message = parseErrorMessage(from: data)
            throw APIError.conflict(message)
        case 422:
            let message = parseErrorMessage(from: data)
            throw APIError.validationError(message)
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            let message = parseErrorMessage(from: data)
            throw APIError.unknown(message)
        }
    }

    private func parseErrorMessage(from data: Data) -> String {
        if let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data) {
            return errorResponse.displayMessage
        }
        return String(data: data, encoding: .utf8) ?? "Unknown error"
    }
}
