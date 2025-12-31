import SwiftUI

/// Card container view
public struct Card<Content: View>: View {

    private let content: Content
    private let padding: CGFloat
    private let cornerRadius: CGFloat

    public init(
        padding: CGFloat = 16,
        cornerRadius: CGFloat = 12,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.padding = padding
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        content
            .padding(padding)
            .background(Color.campSurface)
            .cornerRadius(cornerRadius)
            .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 2)
    }
}

/// Tappable card with action
public struct TappableCard<Content: View>: View {

    private let content: Content
    private let padding: CGFloat
    private let cornerRadius: CGFloat
    private let action: () -> Void

    public init(
        padding: CGFloat = 16,
        cornerRadius: CGFloat = 12,
        action: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            content
                .padding(padding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.campSurface)
                .cornerRadius(cornerRadius)
                .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 2)
        }
        .buttonStyle(CardButtonStyle())
    }
}

/// Button style for tappable cards
private struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Section card with header
public struct SectionCard<Content: View>: View {

    private let title: String
    private let subtitle: String?
    private let action: (() -> Void)?
    private let actionLabel: String?
    private let content: Content

    public init(
        title: String,
        subtitle: String? = nil,
        action: (() -> Void)? = nil,
        actionLabel: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.action = action
        self.actionLabel = actionLabel
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }
                }

                Spacer()

                if let action = action, let label = actionLabel {
                    Button(action: action) {
                        Text(label)
                            .font(.campLabel)
                            .foregroundColor(.campPrimary)
                    }
                }
            }

            // Content
            content
        }
        .padding(16)
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Simple Card")
                        .font(.campHeading3)
                    Text("This is a basic card component")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            TappableCard(action: { print("Tapped!") }) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Tappable Card")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)
                        Text("Tap me!")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(.campTextSecondary)
                }
            }

            SectionCard(
                title: "Today's Arrivals",
                subtitle: "5 guests arriving",
                action: { print("View all") },
                actionLabel: "View All"
            ) {
                Text("Content goes here")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .padding()
    }
    .background(Color.campBackground)
}
