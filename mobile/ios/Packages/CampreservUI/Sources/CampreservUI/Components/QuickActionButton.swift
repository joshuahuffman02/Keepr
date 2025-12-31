import SwiftUI

/// Quick action button with icon, title, and subtitle
public struct QuickActionButton: View {

    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    public init(icon: String, title: String, subtitle: String, action: @escaping () -> Void) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.campPrimary)

                VStack(spacing: 2) {
                    Text(title)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                    Text(subtitle)
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.campSurface)
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        }
    }
}

#Preview {
    HStack(spacing: 12) {
        QuickActionButton(
            icon: "magnifyingglass",
            title: "Find",
            subtitle: "Campground"
        ) {}

        QuickActionButton(
            icon: "calendar.badge.plus",
            title: "Book",
            subtitle: "New Stay"
        ) {}
    }
    .padding()
}
