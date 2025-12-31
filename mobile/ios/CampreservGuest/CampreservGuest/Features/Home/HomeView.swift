import SwiftUI
import CampreservCore
import CampreservUI

/// Home screen showing upcoming reservations and quick actions
struct HomeView: View {

    @EnvironmentObject private var appState: AppState
    @State private var isLoading = false

    // Use demo trips from the new DemoTrip model
    private var upcomingTrips: [DemoTrip] {
        DemoTrip.current + DemoTrip.upcoming
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Welcome header
                    welcomeHeader

                    // Quick actions
                    quickActions

                    // Upcoming trips section
                    upcomingSection
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Home")
        }
    }

    // MARK: - Views

    private var welcomeHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome back,")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)

                Text(appState.currentGuest?.primaryFirstName ?? "Camper")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)
            }

            Spacer()

            Image(systemName: "tent.fill")
                .font(.system(size: 32))
                .foregroundColor(.campPrimary)
        }
        .padding(16)
        .background(Color.campSurface)
        .cornerRadius(12)
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            HomeQuickActionButton(
                icon: "magnifyingglass",
                title: "Find",
                subtitle: "Campground"
            ) {
                // Navigate to search
            }

            HomeQuickActionButton(
                icon: "calendar.badge.plus",
                title: "Book",
                subtitle: "New Stay"
            ) {
                // Navigate to booking
            }

            HomeQuickActionButton(
                icon: "arrow.down.circle",
                title: "Check",
                subtitle: "In"
            ) {
                // Navigate to check-in
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Upcoming Stays")
                    .font(.campHeading2)
                    .foregroundColor(.campTextPrimary)
                Spacer()
                NavigationLink(destination: ReservationsListView()) {
                    Text("See All")
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                }
            }

            if isLoading {
                VStack(spacing: 12) {
                    SkeletonView()
                        .frame(height: 120)
                    SkeletonView()
                        .frame(height: 120)
                }
            } else if upcomingTrips.isEmpty {
                EmptyStateView(
                    icon: "calendar",
                    title: "No Upcoming Stays",
                    message: "Book your next adventure and it will appear here.",
                    actionTitle: "Find Campgrounds"
                ) {
                    // Navigate to search
                }
            } else {
                ForEach(upcomingTrips.prefix(2)) { trip in
                    NavigationLink(destination: TripDetailView(trip: trip)) {
                        HomeTripCard(trip: trip)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// Quick action button for home screen
struct HomeQuickActionButton: View {

    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
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

/// Compact trip card for home screen
struct HomeTripCard: View {

    let trip: DemoTrip

    private var countdownText: String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDay = calendar.startOfDay(for: trip.startDate)
        let endDay = calendar.startOfDay(for: trip.endDate)

        if trip.status == .checkedIn {
            let daysLeft = calendar.dateComponents([.day], from: today, to: endDay).day ?? 0
            if daysLeft == 0 { return "Checkout today" }
            if daysLeft == 1 { return "1 day left" }
            return "\(daysLeft) days left"
        } else if trip.status == .confirmed {
            let daysUntil = calendar.dateComponents([.day], from: today, to: startDay).day ?? 0
            if daysUntil == 0 { return "Today!" }
            if daysUntil == 1 { return "Tomorrow" }
            return "In \(daysUntil) days"
        }
        return ""
    }

    var body: some View {
        HStack(spacing: 12) {
            // Image placeholder
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [trip.imageColor.opacity(0.8), trip.imageColor.opacity(0.5)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 80, height: 80)
                .overlay(
                    Image(systemName: "tent.fill")
                        .foregroundColor(.white.opacity(0.5))
                )
                .cornerRadius(12)

            VStack(alignment: .leading, spacing: 4) {
                // Status + countdown
                HStack(spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: trip.status.icon)
                        Text(trip.status.label)
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(trip.status.color)
                    .cornerRadius(12)

                    if !countdownText.isEmpty {
                        Text(countdownText)
                            .font(.campCaption)
                            .foregroundColor(.campPrimary)
                            .fontWeight(.medium)
                    }
                }

                Text(trip.campgroundName)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(1)

                Text(trip.siteName)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)

                Text(formatDateRange())
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(.campTextHint)
        }
        .padding(12)
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return "\(formatter.string(from: trip.startDate)) - \(formatter.string(from: trip.endDate))"
    }
}

#Preview {
    HomeView()
        .environmentObject(AppState())
}
