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

            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "message")
                }
                .tag(2)

            StaffPOSView()
                .tabItem {
                    Label("POS", systemImage: "creditcard")
                }
                .tag(3)

            MoreView()
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
                .tag(4)
        }
        .tint(.campPrimary)
    }
}

/// More menu with additional features
struct MoreView: View {

    @EnvironmentObject private var appState: StaffAppState

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink(destination: MaintenanceListView()) {
                        Label("Maintenance Tasks", systemImage: "wrench.and.screwdriver")
                    }

                    NavigationLink(destination: ShiftClockView()) {
                        Label("Time Clock", systemImage: "clock")
                    }

                    NavigationLink(destination: IncidentsView()) {
                        Label("Incidents", systemImage: "exclamationmark.triangle")
                    }
                }

                Section {
                    NavigationLink(destination: SettingsView()) {
                        Label("Settings", systemImage: "gear")
                    }

                    Button {
                        Task { await appState.logout() }
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            .foregroundColor(.campError)
                    }
                }
            }
            .navigationTitle("More")
        }
    }
}

/// Placeholder settings view
struct SettingsView: View {
    var body: some View {
        List {
            Section("Account") {
                Text("Profile")
                Text("Notifications")
            }

            Section("App") {
                Text("Appearance")
                Text("About")
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
