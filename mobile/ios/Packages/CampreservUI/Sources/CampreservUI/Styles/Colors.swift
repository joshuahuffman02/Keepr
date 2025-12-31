import SwiftUI

/// Campreserv brand colors
public extension Color {

    // MARK: - Primary Colors

    /// Primary brand color (forest green)
    static let campPrimary = Color(hex: "2D5A3D")

    /// Secondary brand color
    static let campSecondary = Color(hex: "4A7C59")

    /// Accent color
    static let campAccent = Color(hex: "8BC34A")

    // MARK: - Semantic Colors

    /// Success green
    static let campSuccess = Color(hex: "4CAF50")

    /// Warning yellow
    static let campWarning = Color(hex: "FF9800")

    /// Error red
    static let campError = Color(hex: "F44336")

    /// Info blue
    static let campInfo = Color(hex: "2196F3")

    // MARK: - Status Colors

    /// Pending status
    static let statusPending = Color(hex: "FFA726")

    /// Confirmed status
    static let statusConfirmed = Color(hex: "66BB6A")

    /// Checked in status
    static let statusCheckedIn = Color(hex: "42A5F5")

    /// Checked out status
    static let statusCheckedOut = Color(hex: "78909C")

    /// Cancelled status
    static let statusCancelled = Color(hex: "EF5350")

    // MARK: - Neutral Colors

    /// Background color
    static let campBackground = Color(hex: "F5F5F5")

    /// Surface color (cards, sheets)
    static let campSurface = Color.white

    /// Border color
    static let campBorder = Color(hex: "E0E0E0")

    /// Disabled state
    static let campDisabled = Color(hex: "BDBDBD")

    // MARK: - Text Colors

    /// Primary text
    static let campTextPrimary = Color(hex: "212121")

    /// Secondary text
    static let campTextSecondary = Color(hex: "757575")

    /// Hint text
    static let campTextHint = Color(hex: "9E9E9E")

    /// Text on primary color
    static let campTextOnPrimary = Color.white
}

// MARK: - Hex Color Extension

public extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
