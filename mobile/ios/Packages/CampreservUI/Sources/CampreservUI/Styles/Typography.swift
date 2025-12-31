import SwiftUI

/// Campreserv typography styles
public extension Font {

    // MARK: - Display

    /// Large display title
    static let campDisplayLarge = Font.system(size: 34, weight: .bold, design: .default)

    /// Medium display title
    static let campDisplayMedium = Font.system(size: 28, weight: .bold, design: .default)

    /// Small display title
    static let campDisplaySmall = Font.system(size: 24, weight: .bold, design: .default)

    // MARK: - Headings

    /// Heading 1
    static let campHeading1 = Font.system(size: 22, weight: .semibold, design: .default)

    /// Heading 2
    static let campHeading2 = Font.system(size: 20, weight: .semibold, design: .default)

    /// Heading 3
    static let campHeading3 = Font.system(size: 18, weight: .semibold, design: .default)

    // MARK: - Body

    /// Large body text
    static let campBodyLarge = Font.system(size: 17, weight: .regular, design: .default)

    /// Medium body text (default)
    static let campBody = Font.system(size: 15, weight: .regular, design: .default)

    /// Small body text
    static let campBodySmall = Font.system(size: 13, weight: .regular, design: .default)

    // MARK: - Labels

    /// Large label
    static let campLabelLarge = Font.system(size: 15, weight: .medium, design: .default)

    /// Medium label
    static let campLabel = Font.system(size: 13, weight: .medium, design: .default)

    /// Small label
    static let campLabelSmall = Font.system(size: 11, weight: .medium, design: .default)

    // MARK: - Special

    /// Caption text
    static let campCaption = Font.system(size: 12, weight: .regular, design: .default)

    /// Button text
    static let campButton = Font.system(size: 15, weight: .semibold, design: .default)

    /// Tab bar text
    static let campTabBar = Font.system(size: 10, weight: .medium, design: .default)

    /// Badge text
    static let campBadge = Font.system(size: 11, weight: .bold, design: .default)
}

// MARK: - Text Style Modifiers

public extension View {
    /// Apply primary text style
    func campTextPrimary() -> some View {
        self
            .font(.campBody)
            .foregroundColor(.campTextPrimary)
    }

    /// Apply secondary text style
    func campTextSecondary() -> some View {
        self
            .font(.campBody)
            .foregroundColor(.campTextSecondary)
    }

    /// Apply heading style
    func campHeading(_ level: Int = 1) -> some View {
        let font: Font = switch level {
        case 1: .campHeading1
        case 2: .campHeading2
        case 3: .campHeading3
        default: .campHeading1
        }

        return self
            .font(font)
            .foregroundColor(.campTextPrimary)
    }
}
