import SwiftUI
import CampreservCore
import CampreservUI

/// Admin dashboard with live metrics
struct AdminDashboardView: View {

    @EnvironmentObject private var appState: AdminAppState
    @State private var metrics: DashboardMetrics?
    @State private var isLoading = true
    @State private var selectedPeriod: TimePeriod = .today

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Period selector
                    periodSelector

                    // Key metrics
                    metricsGrid

                    // Revenue chart
                    revenueSection

                    // Occupancy chart
                    occupancySection

                    // Quick stats
                    quickStatsSection
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle(appState.currentCampground?.name ?? "Dashboard")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        appState.currentCampground = nil
                    } label: {
                        Image(systemName: "building.2")
                    }
                }
            }
            .refreshable {
                await loadMetrics()
            }
        }
        .task {
            await loadMetrics()
        }
        .onChange(of: selectedPeriod) { _ in
            Task { await loadMetrics() }
        }
    }

    // MARK: - Views

    private var periodSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TimePeriod.allCases, id: \.self) { period in
                    FilterChip(
                        title: period.title,
                        isSelected: selectedPeriod == period
                    ) {
                        selectedPeriod = period
                    }
                }
            }
        }
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            MetricCard(
                title: "Revenue",
                value: formatMoney(cents: metrics?.revenueCents ?? 0),
                change: metrics?.revenueChange,
                icon: "dollarsign.circle"
            )

            MetricCard(
                title: "Occupancy",
                value: "\(metrics?.occupancyPercent ?? 0)%",
                change: metrics?.occupancyChange,
                icon: "chart.pie"
            )

            MetricCard(
                title: "Bookings",
                value: "\(metrics?.bookingsCount ?? 0)",
                change: metrics?.bookingsChange,
                icon: "calendar.badge.plus"
            )

            MetricCard(
                title: "Avg Stay",
                value: "\(metrics?.avgNights ?? 0) nights",
                change: nil,
                icon: "moon.stars"
            )
        }
    }

    private var revenueSection: some View {
        SectionCard(title: "Revenue Trend") {
            if isLoading {
                SkeletonView().frame(height: 200)
            } else {
                // Placeholder for chart
                VStack(spacing: 8) {
                    Text(formatMoney(cents: metrics?.revenueCents ?? 0))
                        .font(.campDisplayMedium)
                        .foregroundColor(.campPrimary)

                    Text(selectedPeriod.title)
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)

                    // Simple bar chart placeholder
                    HStack(alignment: .bottom, spacing: 4) {
                        ForEach(0..<7, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.campPrimary.opacity(0.3 + Double.random(in: 0...0.7)))
                                .frame(height: CGFloat.random(in: 50...150))
                        }
                    }
                    .frame(height: 150)
                }
                .padding(.vertical, 16)
            }
        }
    }

    private var occupancySection: some View {
        SectionCard(title: "Occupancy Overview") {
            if isLoading {
                SkeletonView().frame(height: 100)
            } else {
                VStack(spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Current")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("\(metrics?.occupancyPercent ?? 0)%")
                                .font(.campDisplaySmall)
                                .foregroundColor(.campPrimary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("Available")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("\(metrics?.availableSites ?? 0) sites")
                                .font(.campHeading3)
                                .foregroundColor(.campTextPrimary)
                        }
                    }

                    // Occupancy bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.campBorder)
                                .frame(height: 16)

                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.campPrimary)
                                .frame(width: geometry.size.width * CGFloat(metrics?.occupancyPercent ?? 0) / 100, height: 16)
                        }
                    }
                    .frame(height: 16)
                }
            }
        }
    }

    private var quickStatsSection: some View {
        SectionCard(title: "Today's Activity") {
            VStack(spacing: 12) {
                HStack {
                    Label("Arrivals", systemImage: "arrow.down.circle")
                        .foregroundColor(.campSuccess)
                    Spacer()
                    Text("\(metrics?.arrivalsToday ?? 0)")
                        .font(.campLabel)
                }

                HStack {
                    Label("Departures", systemImage: "arrow.up.circle")
                        .foregroundColor(.campWarning)
                    Spacer()
                    Text("\(metrics?.departuresToday ?? 0)")
                        .font(.campLabel)
                }

                HStack {
                    Label("Outstanding Balance", systemImage: "exclamationmark.circle")
                        .foregroundColor(.campError)
                    Spacer()
                    Text(formatMoney(cents: metrics?.outstandingBalanceCents ?? 0))
                        .font(.campLabel)
                        .foregroundColor(.campError)
                }
            }
            .font(.campBody)
        }
    }

    // MARK: - Data Loading

    private func loadMetrics() async {
        isLoading = true
        defer { isLoading = false }

        // Call API
        try? await Task.sleep(for: .seconds(1))

        metrics = DashboardMetrics(
            revenueCents: 1250000,
            revenueChange: 12.5,
            occupancyPercent: 72,
            occupancyChange: -3.2,
            bookingsCount: 45,
            bookingsChange: 8.0,
            avgNights: 3,
            availableSites: 28,
            arrivalsToday: 8,
            departuresToday: 5,
            outstandingBalanceCents: 125000
        )
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        if dollars >= 1000 {
            return "$\(String(format: "%.1fK", dollars / 1000))"
        }
        return "$\(String(format: "%.2f", dollars))"
    }
}

// MARK: - Models

struct DashboardMetrics {
    let revenueCents: Int
    let revenueChange: Double?
    let occupancyPercent: Int
    let occupancyChange: Double?
    let bookingsCount: Int
    let bookingsChange: Double?
    let avgNights: Int
    let availableSites: Int
    let arrivalsToday: Int
    let departuresToday: Int
    let outstandingBalanceCents: Int
}

enum TimePeriod: CaseIterable {
    case today, week, month, quarter, year

    var title: String {
        switch self {
        case .today: return "Today"
        case .week: return "This Week"
        case .month: return "This Month"
        case .quarter: return "Quarter"
        case .year: return "Year"
        }
    }
}

// MARK: - Components

struct MetricCard: View {
    let title: String
    let value: String
    let change: Double?
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.campPrimary)
                Spacer()
                if let change = change {
                    HStack(spacing: 2) {
                        Image(systemName: change >= 0 ? "arrow.up.right" : "arrow.down.right")
                        Text("\(String(format: "%.1f", abs(change)))%")
                    }
                    .font(.campCaption)
                    .foregroundColor(change >= 0 ? .campSuccess : .campError)
                }
            }

            Text(value)
                .font(.campHeading2)
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

/// Admin settings view
struct AdminSettingsView: View {

    @EnvironmentObject private var appState: AdminAppState
    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Profile section
                Section {
                    HStack(spacing: 16) {
                        Circle()
                            .fill(Color.campPrimary.opacity(0.1))
                            .frame(width: 48, height: 48)
                            .overlay(
                                Text(userInitials)
                                    .font(.campHeading3)
                                    .foregroundColor(.campPrimary)
                            )

                        VStack(alignment: .leading, spacing: 4) {
                            Text(userDisplayName)
                                .font(.campLabel)
                            Text(appState.currentUser?.email ?? "")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }
                    }
                    .padding(.vertical, 8)
                }

                // Campground
                Section("Current Campground") {
                    HStack {
                        Label(appState.currentCampground?.name ?? "", systemImage: "tent")
                        Spacer()
                        Button("Switch") {
                            appState.currentCampground = nil
                        }
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                    }
                }

                // Support
                Section("Support") {
                    NavigationLink {
                        // Help center
                    } label: {
                        Label("Help Center", systemImage: "questionmark.circle")
                    }
                }

                // Logout
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }

                // App info
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundColor(.campTextSecondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog(
                "Sign Out",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await appState.logout() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var userDisplayName: String {
        appState.currentUser?.fullName ?? "Admin"
    }

    private var userInitials: String {
        appState.currentUser?.initials ?? "A"
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
