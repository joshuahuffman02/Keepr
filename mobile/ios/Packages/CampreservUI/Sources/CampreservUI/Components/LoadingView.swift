import SwiftUI

/// Full-screen loading overlay
public struct LoadingView: View {

    private let message: String?

    public init(message: String? = nil) {
        self.message = message
    }

    public var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
                .tint(.campPrimary)

            if let message = message {
                Text(message)
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
    }
}

/// Inline loading indicator
public struct InlineLoader: View {

    private let message: String?
    private let size: CGFloat

    public init(message: String? = nil, size: CGFloat = 20) {
        self.message = message
        self.size = size
    }

    public var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(size / 20)
                .tint(.campPrimary)

            if let message = message {
                Text(message)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }
        }
    }
}

/// Loading overlay modifier
public struct LoadingOverlay: ViewModifier {

    let isLoading: Bool
    let message: String?

    public func body(content: Content) -> some View {
        ZStack {
            content
                .disabled(isLoading)
                .blur(radius: isLoading ? 2 : 0)

            if isLoading {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                        .tint(.white)

                    if let message = message {
                        Text(message)
                            .font(.campBody)
                            .foregroundColor(.white)
                    }
                }
                .padding(32)
                .background(Color.black.opacity(0.7))
                .cornerRadius(16)
            }
        }
    }
}

public extension View {
    /// Apply a loading overlay to the view
    func loadingOverlay(isLoading: Bool, message: String? = nil) -> some View {
        modifier(LoadingOverlay(isLoading: isLoading, message: message))
    }
}

/// Skeleton loading placeholder
public struct SkeletonView: View {

    private let cornerRadius: CGFloat
    @State private var isAnimating = false

    public init(cornerRadius: CGFloat = 8) {
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [
                        Color.campBorder.opacity(0.5),
                        Color.campBorder.opacity(0.8),
                        Color.campBorder.opacity(0.5)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(cornerRadius)
            .opacity(isAnimating ? 0.6 : 1.0)
            .animation(
                Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true),
                value: isAnimating
            )
            .onAppear {
                isAnimating = true
            }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 32) {
        LoadingView(message: "Loading reservations...")

        Divider()

        InlineLoader(message: "Refreshing...")

        Divider()

        VStack(spacing: 12) {
            SkeletonView()
                .frame(height: 20)
            SkeletonView()
                .frame(height: 20)
                .padding(.trailing, 40)
            SkeletonView()
                .frame(height: 100)
        }
        .padding()
    }
}
