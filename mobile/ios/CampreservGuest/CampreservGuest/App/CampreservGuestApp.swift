import SwiftUI
import CampreservCore
import CampreservUI

@main
struct CampreservGuestApp: App {

    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
        }
    }
}

/// Root view - always shows main app, auth is optional
struct RootView: View {

    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if appState.isLoading {
                LoadingView(message: "Loading...")
            } else {
                MainTabView()
            }
        }
        .task {
            await appState.checkAuthState()
        }
    }
}

/// Main tab navigation - browse without signing in
struct MainTabView: View {

    @EnvironmentObject private var appState: AppState
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            ExploreView()
                .tabItem {
                    Label("Explore", systemImage: "tent")
                }
                .tag(0)

            BookingSearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tag(1)

            // Reservations requires auth
            AuthRequiredView(
                feature: "Reservations",
                icon: "calendar",
                description: "Sign in to view your upcoming and past stays."
            ) {
                ReservationsListView()
            }
            .tabItem {
                Label("Trips", systemImage: "calendar")
            }
            .tag(2)

            // Profile/Account
            AuthRequiredView(
                feature: "Account",
                icon: "person.circle",
                description: "Sign in to manage your profile and settings."
            ) {
                ProfileView()
            }
            .tabItem {
                Label("Account", systemImage: "person.circle")
            }
            .tag(3)
        }
        .tint(.campPrimary)
    }
}

/// Wrapper that shows sign-in prompt if not authenticated
struct AuthRequiredView<Content: View>: View {

    @EnvironmentObject private var appState: AppState

    let feature: String
    let icon: String
    let description: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        if appState.isAuthenticated {
            content()
        } else {
            SignInPromptView(feature: feature, icon: icon, description: description)
        }
    }
}

/// Prompt to sign in for protected features
struct SignInPromptView: View {

    @EnvironmentObject private var appState: AppState
    @State private var showAuthSheet = false

    let feature: String
    let icon: String
    let description: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                Image(systemName: icon)
                    .font(.system(size: 64))
                    .foregroundColor(.campPrimary.opacity(0.6))

                VStack(spacing: 8) {
                    Text("Sign in to view \(feature)")
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    Text(description)
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                PrimaryButton("Sign In") {
                    showAuthSheet = true
                }
                .padding(.horizontal, 48)

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle(feature)
            .sheet(isPresented: $showAuthSheet) {
                AuthView()
            }
        }
    }
}
