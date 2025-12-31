import SwiftUI

/// Full-screen error view with retry option
public struct ErrorView: View {

    private let title: String
    private let message: String
    private let icon: String
    private let retryAction: (() -> Void)?

    public init(
        title: String = "Something went wrong",
        message: String,
        icon: String = "exclamationmark.triangle",
        retryAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.icon = icon
        self.retryAction = retryAction
    }

    public var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(.campError)

            VStack(spacing: 8) {
                Text(title)
                    .font(.campHeading2)
                    .foregroundColor(.campTextPrimary)

                Text(message)
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            if let retry = retryAction {
                PrimaryButton("Try Again", icon: "arrow.clockwise", action: retry)
                    .padding(.horizontal, 48)
                    .padding(.top, 12)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
    }
}

/// Inline error message
public struct InlineError: View {

    private let message: String
    private let dismissAction: (() -> Void)?

    public init(message: String, dismissAction: (() -> Void)? = nil) {
        self.message = message
        self.dismissAction = dismissAction
    }

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.campError)

            Text(message)
                .font(.campBodySmall)
                .foregroundColor(.campTextPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let dismiss = dismissAction {
                Button(action: dismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.campTextSecondary)
                }
            }
        }
        .padding(12)
        .background(Color.campError.opacity(0.1))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.campError.opacity(0.3), lineWidth: 1)
        )
    }
}

/// Empty state view
public struct EmptyStateView: View {

    private let icon: String
    private let title: String
    private let message: String
    private let actionTitle: String?
    private let action: (() -> Void)?

    public init(
        icon: String,
        title: String,
        message: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(.campTextHint)

            VStack(spacing: 8) {
                Text(title)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)

                Text(message)
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
                    .multilineTextAlignment(.center)
            }

            if let title = actionTitle, let action = action {
                Button(action: action) {
                    Text(title)
                        .font(.campButton)
                        .foregroundColor(.campPrimary)
                }
                .padding(.top, 8)
            }
        }
        .padding(32)
    }
}

/// Network error view
public struct NetworkErrorView: View {

    private let retryAction: (() -> Void)?

    public init(retryAction: (() -> Void)? = nil) {
        self.retryAction = retryAction
    }

    public var body: some View {
        ErrorView(
            title: "No Connection",
            message: "Please check your internet connection and try again.",
            icon: "wifi.slash",
            retryAction: retryAction
        )
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 32) {
        ErrorView(
            message: "We couldn't load your reservations. Please try again.",
            retryAction: {}
        )

        Divider()

        InlineError(
            message: "Invalid email address",
            dismissAction: {}
        )
        .padding()

        Divider()

        EmptyStateView(
            icon: "calendar.badge.plus",
            title: "No Reservations",
            message: "You don't have any upcoming reservations.",
            actionTitle: "Browse Campgrounds",
            action: {}
        )
    }
}
