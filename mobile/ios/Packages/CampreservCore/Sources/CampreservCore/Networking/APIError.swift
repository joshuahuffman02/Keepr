import Foundation

/// API error types
public enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case conflict(String)
    case validationError(String)
    case serverError(Int)
    case networkError(Error)
    case decodingError(Error)
    case unknown(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .conflict(let message):
            return message
        case .validationError(let message):
            return message
        case .serverError(let code):
            return "Server error (\(code))"
        case .networkError(let error):
            return error.localizedDescription
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .unknown(let message):
            return message
        }
    }

    public var isAuthError: Bool {
        if case .unauthorized = self { return true }
        return false
    }

    public var isNetworkError: Bool {
        if case .networkError = self { return true }
        return false
    }
}

/// API error response from server
struct APIErrorResponse: Decodable {
    let message: String?
    let error: String?
    let statusCode: Int?

    var displayMessage: String {
        message ?? error ?? "Unknown error"
    }
}
