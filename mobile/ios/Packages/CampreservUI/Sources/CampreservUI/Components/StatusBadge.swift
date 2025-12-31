import SwiftUI

/// Status badge for displaying reservation/booking status
public struct StatusBadge: View {

    public enum Status: String, CaseIterable {
        case pending
        case confirmed
        case checkedIn = "checked_in"
        case checkedOut = "checked_out"
        case cancelled

        public var displayName: String {
            switch self {
            case .pending: return "Pending"
            case .confirmed: return "Confirmed"
            case .checkedIn: return "Checked In"
            case .checkedOut: return "Checked Out"
            case .cancelled: return "Cancelled"
            }
        }

        public var color: Color {
            switch self {
            case .pending: return .statusPending
            case .confirmed: return .statusConfirmed
            case .checkedIn: return .statusCheckedIn
            case .checkedOut: return .statusCheckedOut
            case .cancelled: return .statusCancelled
            }
        }

        public var icon: String {
            switch self {
            case .pending: return "clock"
            case .confirmed: return "checkmark.circle"
            case .checkedIn: return "arrow.down.circle"
            case .checkedOut: return "arrow.up.circle"
            case .cancelled: return "xmark.circle"
            }
        }
    }

    private let status: Status
    private let showIcon: Bool
    private let size: Size

    public enum Size {
        case small
        case medium
        case large

        var font: Font {
            switch self {
            case .small: return .campLabelSmall
            case .medium: return .campLabel
            case .large: return .campLabelLarge
            }
        }

        var iconSize: CGFloat {
            switch self {
            case .small: return 10
            case .medium: return 12
            case .large: return 14
            }
        }

        var horizontalPadding: CGFloat {
            switch self {
            case .small: return 6
            case .medium: return 8
            case .large: return 10
            }
        }

        var verticalPadding: CGFloat {
            switch self {
            case .small: return 3
            case .medium: return 4
            case .large: return 6
            }
        }
    }

    public init(_ status: Status, showIcon: Bool = true, size: Size = .medium) {
        self.status = status
        self.showIcon = showIcon
        self.size = size
    }

    public init(rawValue: String, showIcon: Bool = true, size: Size = .medium) {
        self.status = Status(rawValue: rawValue) ?? .pending
        self.showIcon = showIcon
        self.size = size
    }

    public var body: some View {
        HStack(spacing: 4) {
            if showIcon {
                Image(systemName: status.icon)
                    .font(.system(size: size.iconSize, weight: .semibold))
            }
            Text(status.displayName)
                .font(size.font)
        }
        .foregroundColor(status.color)
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, size.verticalPadding)
        .background(status.color.opacity(0.15))
        .cornerRadius(6)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        ForEach(StatusBadge.Status.allCases, id: \.self) { status in
            HStack {
                StatusBadge(status, size: .small)
                StatusBadge(status, size: .medium)
                StatusBadge(status, size: .large)
            }
        }
    }
    .padding()
}
