import Foundation

/// Utility for formatting money amounts (stored in cents)
public enum MoneyFormatter {

    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale.current
        return formatter
    }()

    /// Format cents to currency string (e.g., 9999 -> "$99.99")
    public static func format(cents: Int, locale: Locale = .current) -> String {
        let dollars = Double(cents) / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = locale
        return formatter.string(from: NSNumber(value: dollars)) ?? "$\(String(format: "%.2f", dollars))"
    }

    /// Parse a currency string to cents (e.g., "$99.99" -> 9999)
    public static func parseToCents(_ string: String) -> Int? {
        // Remove currency symbols and whitespace
        let cleanedString = string
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)

        guard let value = Double(cleanedString) else { return nil }
        return Int(round(value * 100))
    }

    /// Format as compact (e.g., 999900 -> "$9,999")
    public static func formatCompact(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: dollars)) ?? "$\(Int(dollars))"
    }
}
