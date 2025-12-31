import SwiftUI
import CampreservCore
import CampreservUI

@main
struct CampreservAdminApp: App {

    @StateObject private var appState = AdminAppState()

    var body: some Scene {
        WindowGroup {
            AdminRootView()
                .environmentObject(appState)
        }
    }
}

/// Root view that handles navigation based on auth state
struct AdminRootView: View {

    @EnvironmentObject private var appState: AdminAppState

    var body: some View {
        Group {
            if appState.isLoading {
                LoadingView(message: "Loading...")
            } else if appState.isAuthenticated {
                if appState.currentCampground == nil {
                    AdminCampgroundSelectorView()
                } else {
                    AdminMainTabView()
                }
            } else {
                AdminAuthView()
            }
        }
        .task {
            await appState.checkAuthState()
        }
    }
}

/// Main tab navigation for admin
struct AdminMainTabView: View {

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            AdminDashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar")
                }
                .tag(0)

            ReportsListView()
                .tabItem {
                    Label("Reports", systemImage: "doc.text.magnifyingglass")
                }
                .tag(1)

            AdminSettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
        .tint(.campPrimary)
    }
}
