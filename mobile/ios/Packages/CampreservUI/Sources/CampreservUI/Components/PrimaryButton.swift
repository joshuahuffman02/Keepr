import SwiftUI

/// Primary action button style
public struct PrimaryButton: View {

    private let title: String
    private let icon: String?
    private let isLoading: Bool
    private let isDisabled: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Text(title)
                        .font(.campButton)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .padding(.horizontal, 24)
            .background(isDisabled ? Color.campDisabled : Color.campPrimary)
            .foregroundColor(.white)
            .cornerRadius(10)
        }
        .disabled(isDisabled || isLoading)
    }
}

/// Secondary button style
public struct SecondaryButton: View {

    private let title: String
    private let icon: String?
    private let isLoading: Bool
    private let isDisabled: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .campPrimary))
                        .scaleEffect(0.8)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Text(title)
                        .font(.campButton)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .padding(.horizontal, 24)
            .background(Color.clear)
            .foregroundColor(isDisabled ? .campDisabled : .campPrimary)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isDisabled ? Color.campDisabled : Color.campPrimary, lineWidth: 2)
            )
        }
        .disabled(isDisabled || isLoading)
    }
}

/// Destructive button style
public struct DestructiveButton: View {

    private let title: String
    private let icon: String?
    private let isLoading: Bool
    private let isDisabled: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Text(title)
                        .font(.campButton)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .padding(.horizontal, 24)
            .background(isDisabled ? Color.campDisabled : Color.campError)
            .foregroundColor(.white)
            .cornerRadius(10)
        }
        .disabled(isDisabled || isLoading)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        PrimaryButton("Continue", icon: "arrow.right") {}
        PrimaryButton("Loading...", isLoading: true) {}
        PrimaryButton("Disabled", isDisabled: true) {}

        SecondaryButton("Cancel") {}
        SecondaryButton("Disabled", isDisabled: true) {}

        DestructiveButton("Delete", icon: "trash") {}
    }
    .padding()
}
