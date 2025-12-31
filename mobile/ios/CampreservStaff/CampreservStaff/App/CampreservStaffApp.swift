import SwiftUI
import CampreservCore
import CampreservUI

@main
struct CampreservStaffApp: App {

    @StateObject private var appState = StaffAppState()

    var body: some Scene {
        WindowGroup {
            StaffRootView()
                .environmentObject(appState)
        }
    }
}

/// Root view that handles navigation based on auth state
struct StaffRootView: View {

    @EnvironmentObject private var appState: StaffAppState

    var body: some View {
        Group {
            if appState.isLoading {
                LoadingView(message: "Loading...")
            } else if appState.isAuthenticated {
                if appState.currentCampground == nil {
                    CampgroundSelectorView()
                } else {
                    StaffMainTabView()
                }
            } else {
                StaffAuthView()
            }
        }
        .task {
            await appState.checkAuthState()
        }
    }
}

/// Main tab navigation for authenticated staff
struct StaffMainTabView: View {

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            StaffDashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2")
                }
                .tag(0)

            StaffReservationsView()
                .tabItem {
                    Label("Reservations", systemImage: "calendar")
                }
                .tag(1)

            StaffPOSView()
                .tabItem {
                    Label("POS", systemImage: "creditcard")
                }
                .tag(2)

            MaintenanceListView()
                .tabItem {
                    Label("Tasks", systemImage: "wrench.and.screwdriver")
                }
                .tag(3)
        }
        .tint(.campPrimary)
    }
}
