import SwiftUI
import CampreservCore
import CampreservUI

/// Staff dashboard with today's overview
struct StaffDashboardView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var summary: DashboardSummary?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Today's stats grid
                    statsGrid

                    // Arrivals section
                    arrivalsSection

                    // Departures section
                    departuresSection

                    // Quick actions
                    quickActionsSection
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        // Switch campground
                    } label: {
                        Image(systemName: "building.2")
                    }
                }
            }
            .refreshable {
                await loadDashboard()
            }
        }
        .task {
            await loadDashboard()
        }
    }

    // MARK: - Views

    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            StatCard(
                title: "Arrivals Today",
                value: "\(summary?.arrivalsToday ?? 0)",
                icon: "arrow.down.circle",
                color: .campSuccess
            )

            StatCard(
                title: "Departures Today",
                value: "\(summary?.departuresToday ?? 0)",
                icon: "arrow.up.circle",
                color: .campWarning
            )

            StatCard(
                title: "Occupancy",
                value: "\(summary?.occupancyPercent ?? 0)%",
                icon: "chart.pie",
                color: .campPrimary
            )

            StatCard(
                title: "Available Sites",
                value: "\(summary?.availableSites ?? 0)",
                icon: "checkmark.circle",
                color: .campInfo
            )
        }
    }

    private var arrivalsSection: some View {
        SectionCard(
            title: "Today's Arrivals",
            subtitle: "\(summary?.arrivalsToday ?? 0) guests",
            action: { /* View all */ },
            actionLabel: "View All"
        ) {
            if isLoading {
                SkeletonView().frame(height: 60)
            } else if let arrivals = summary?.upcomingArrivals, !arrivals.isEmpty {
                ForEach(arrivals.prefix(3), id: \.id) { reservation in
                    ArrivalRow(reservation: reservation)
                }
            } else {
                Text("No arrivals today")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
            }
        }
    }

    private var departuresSection: some View {
        SectionCard(
            title: "Today's Departures",
            subtitle: "\(summary?.departuresToday ?? 0) guests",
            action: { /* View all */ },
            actionLabel: "View All"
        ) {
            if isLoading {
                SkeletonView().frame(height: 60)
            } else if let departures = summary?.pendingDepartures, !departures.isEmpty {
                ForEach(departures.prefix(3), id: \.id) { reservation in
                    DepartureRow(reservation: reservation)
                }
            } else {
                Text("No departures today")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
            }
        }
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.campHeading3)
                .foregroundColor(.campTextPrimary)

            HStack(spacing: 12) {
                QuickActionButton(
                    icon: "plus.circle",
                    title: "New",
                    subtitle: "Booking"
                ) {
                    // Navigate to new booking
                }

                QuickActionButton(
                    icon: "magnifyingglass",
                    title: "Search",
                    subtitle: "Guest"
                ) {
                    // Navigate to search
                }

                QuickActionButton(
                    icon: "creditcard",
                    title: "Quick",
                    subtitle: "Sale"
                ) {
                    // Navigate to POS
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadDashboard() async {
        isLoading = true
        defer { isLoading = false }

        // Call API to load dashboard summary
        // summary = try await apiClient.request(.getDashboardSummary(campgroundId: campgroundId))

        // Simulate with empty data
        try? await Task.sleep(for: .seconds(1))
        summary = DashboardSummary(
            arrivalsToday: 5,
            departuresToday: 3,
            occupancyPercent: 72,
            availableSites: 28,
            upcomingArrivals: [],
            pendingDepartures: []
        )
    }
}

// MARK: - Dashboard Models

struct DashboardSummary {
    let arrivalsToday: Int
    let departuresToday: Int
    let occupancyPercent: Int
    let availableSites: Int
    let upcomingArrivals: [Reservation]
    let pendingDepartures: [Reservation]
}

// MARK: - Components

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }

            Text(value)
                .font(.campDisplayMedium)
                .foregroundColor(.campTextPrimary)

            Text(title)
                .font(.campCaption)
                .foregroundColor(.campTextSecondary)
        }
        .padding(16)
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}

struct ArrivalRow: View {
    let reservation: Reservation

    var body: some View {
        HStack {
            Circle()
                .fill(Color.campSuccess.opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: "arrow.down.circle")
                        .foregroundColor(.campSuccess)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(reservation.guestName ?? "Guest")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Text(reservation.siteName ?? "Site")
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }

            Spacer()

            Button("Check In") {
                // Perform check-in
            }
            .font(.campLabel)
            .foregroundColor(.campPrimary)
        }
        .padding(.vertical, 8)
    }
}

struct DepartureRow: View {
    let reservation: Reservation

    var body: some View {
        HStack {
            Circle()
                .fill(Color.campWarning.opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: "arrow.up.circle")
                        .foregroundColor(.campWarning)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(reservation.guestName ?? "Guest")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Text(reservation.siteName ?? "Site")
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }

            Spacer()

            StatusBadge(rawValue: reservation.status, size: .small)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    StaffDashboardView()
        .environmentObject(StaffAppState())
}
