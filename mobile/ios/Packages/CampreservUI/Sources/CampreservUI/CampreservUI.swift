/// CampreservUI - Shared UI components and styles for Campreserv iOS apps
///
/// This package provides a consistent design system across the Guest, Staff,
/// and Admin apps including:
///
/// - **Styles**: Brand colors and typography
/// - **Components**: Buttons, cards, forms, status badges, loading/error states
///
/// ## Usage
///
/// Import the package in your SwiftUI views:
/// ```swift
/// import CampreservUI
///
/// struct MyView: View {
///     var body: some View {
///         VStack {
///             Text("Welcome")
///                 .font(.campHeading1)
///                 .foregroundColor(.campTextPrimary)
///
///             PrimaryButton("Continue") {
///                 // action
///             }
///         }
///         .background(Color.campBackground)
///     }
/// }
/// ```

// Re-export all public components for easy importing

// MARK: - Styles
// Colors: campPrimary, campSecondary, campAccent, campSuccess, campWarning, campError, etc.
// Typography: campDisplayLarge, campHeading1-3, campBody, campLabel, campCaption, etc.

// MARK: - Components
// Buttons: PrimaryButton, SecondaryButton, DestructiveButton
// Cards: Card, TappableCard, SectionCard
// Forms: FormField, TextAreaField, PickerField
// Status: StatusBadge
// Loading: LoadingView, InlineLoader, SkeletonView
// Errors: ErrorView, InlineError, EmptyStateView, NetworkErrorView

/// The current version of CampreservUI
public let campreservUIVersion = "1.0.0"
