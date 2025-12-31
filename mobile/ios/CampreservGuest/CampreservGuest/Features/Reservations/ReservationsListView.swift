import SwiftUI
import CampreservCore
import CampreservUI

// MARK: - Demo Trip Model

/// Demo reservation for UI development
struct DemoTrip: Identifiable {
    let id: String
    let confirmationNumber: String
    let campgroundName: String
    let campgroundLocation: String
    let siteName: String
    let siteType: String
    let startDate: Date
    let endDate: Date
    let guestCount: Int
    let status: TripStatus
    let totalCents: Int
    let paidCents: Int
    let imageColor: Color
    let hasUnreadMessages: Bool
    let amenities: [String]

    var balanceCents: Int { totalCents - paidCents }
    var isPaid: Bool { balanceCents <= 0 }

    var nightCount: Int {
        Calendar.current.dateComponents([.day], from: startDate, to: endDate).day ?? 1
    }
}

enum TripStatus: String {
    case confirmed
    case checkedIn = "checked_in"
    case checkedOut = "checked_out"
    case cancelled

    var label: String {
        switch self {
        case .confirmed: return "Confirmed"
        case .checkedIn: return "Checked In"
        case .checkedOut: return "Checked Out"
        case .cancelled: return "Cancelled"
        }
    }

    var color: Color {
        switch self {
        case .confirmed: return .campSuccess
        case .checkedIn: return .campPrimary
        case .checkedOut: return .campTextSecondary
        case .cancelled: return .campError
        }
    }

    var icon: String {
        switch self {
        case .confirmed: return "checkmark.circle.fill"
        case .checkedIn: return "tent.fill"
        case .checkedOut: return "arrow.right.circle.fill"
        case .cancelled: return "xmark.circle.fill"
        }
    }
}

// MARK: - Demo Data

extension DemoTrip {
    static let upcoming: [DemoTrip] = [
        DemoTrip(
            id: "trip-1",
            confirmationNumber: "CR-2024-1234",
            campgroundName: "Yosemite Pines Resort",
            campgroundLocation: "Yosemite, CA",
            siteName: "Site A-12",
            siteType: "Premium Full Hookup",
            startDate: Calendar.current.date(byAdding: .day, value: 3, to: Date())!,
            endDate: Calendar.current.date(byAdding: .day, value: 7, to: Date())!,
            guestCount: 4,
            status: .confirmed,
            totalCents: 32000,
            paidCents: 32000,
            imageColor: .green,
            hasUnreadMessages: true,
            amenities: ["50 Amp", "Full Hookup", "WiFi", "Pull-Through"]
        ),
        DemoTrip(
            id: "trip-2",
            confirmationNumber: "CR-2024-5678",
            campgroundName: "Lake Tahoe RV Resort",
            campgroundLocation: "South Lake Tahoe, CA",
            siteName: "Lakefront 7",
            siteType: "Waterfront Premium",
            startDate: Calendar.current.date(byAdding: .day, value: 14, to: Date())!,
            endDate: Calendar.current.date(byAdding: .day, value: 17, to: Date())!,
            guestCount: 2,
            status: .confirmed,
            totalCents: 45000,
            paidCents: 22500,
            imageColor: .blue,
            hasUnreadMessages: false,
            amenities: ["30 Amp", "Water", "Sewer", "Waterfront"]
        )
    ]

    static let current: [DemoTrip] = [
        DemoTrip(
            id: "trip-current",
            confirmationNumber: "CR-2024-9999",
            campgroundName: "Redwood Coast Campground",
            campgroundLocation: "Crescent City, CA",
            siteName: "Redwood 15",
            siteType: "Forest Premium",
            startDate: Calendar.current.date(byAdding: .day, value: -2, to: Date())!,
            endDate: Calendar.current.date(byAdding: .day, value: 2, to: Date())!,
            guestCount: 3,
            status: .checkedIn,
            totalCents: 28000,
            paidCents: 28000,
            imageColor: .brown,
            hasUnreadMessages: false,
            amenities: ["50 Amp", "Full Hookup", "Shaded", "Fire Pit"]
        )
    ]

    static let past: [DemoTrip] = [
        DemoTrip(
            id: "trip-past-1",
            confirmationNumber: "CR-2024-1111",
            campgroundName: "Joshua Tree Desert Camp",
            campgroundLocation: "Joshua Tree, CA",
            siteName: "Desert View 4",
            siteType: "Dry Camping",
            startDate: Calendar.current.date(byAdding: .day, value: -30, to: Date())!,
            endDate: Calendar.current.date(byAdding: .day, value: -27, to: Date())!,
            guestCount: 2,
            status: .checkedOut,
            totalCents: 15000,
            paidCents: 15000,
            imageColor: .orange,
            hasUnreadMessages: false,
            amenities: ["Fire Pit", "Picnic Table"]
        ),
        DemoTrip(
            id: "trip-past-2",
            confirmationNumber: "CR-2024-2222",
            campgroundName: "Big Sur Coastal Camp",
            campgroundLocation: "Big Sur, CA",
            siteName: "Ocean View 8",
            siteType: "Premium Tent",
            startDate: Calendar.current.date(byAdding: .day, value: -60, to: Date())!,
            endDate: Calendar.current.date(byAdding: .day, value: -57, to: Date())!,
            guestCount: 4,
            status: .checkedOut,
            totalCents: 36000,
            paidCents: 36000,
            imageColor: .cyan,
            hasUnreadMessages: false,
            amenities: ["Waterfront", "Fire Pit", "Shaded"]
        )
    ]
}

// MARK: - Trips List View

/// List of all guest reservations with beautiful trip cards
struct ReservationsListView: View {

    @State private var selectedFilter: TripFilter = .upcoming
    @State private var isLoading = false

    private var allTrips: [DemoTrip] {
        DemoTrip.current + DemoTrip.upcoming + DemoTrip.past
    }

    private var filteredTrips: [DemoTrip] {
        switch selectedFilter {
        case .upcoming:
            return DemoTrip.current + DemoTrip.upcoming
        case .past:
            return DemoTrip.past
        case .all:
            return allTrips
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter picker
                Picker("Filter", selection: $selectedFilter) {
                    ForEach(TripFilter.allCases, id: \.self) { filter in
                        Text(filter.title).tag(filter)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)

                // Trips list
                if isLoading {
                    LoadingView(message: "Loading trips...")
                } else if filteredTrips.isEmpty {
                    EmptyStateView(
                        icon: selectedFilter.emptyIcon,
                        title: selectedFilter.emptyTitle,
                        message: selectedFilter.emptyMessage,
                        actionTitle: selectedFilter == .upcoming ? "Find Campgrounds" : nil
                    ) {
                        // Navigate to search
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(filteredTrips) { trip in
                                NavigationLink(destination: TripDetailView(trip: trip)) {
                                    TripCard(trip: trip)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .background(Color.campBackground)
            .navigationTitle("My Trips")
        }
    }
}

// MARK: - Filter

enum TripFilter: CaseIterable {
    case upcoming
    case past
    case all

    var title: String {
        switch self {
        case .upcoming: return "Upcoming"
        case .past: return "Past"
        case .all: return "All"
        }
    }

    var emptyIcon: String {
        switch self {
        case .upcoming: return "calendar.badge.plus"
        case .past: return "clock.arrow.circlepath"
        case .all: return "calendar"
        }
    }

    var emptyTitle: String {
        switch self {
        case .upcoming: return "No Upcoming Trips"
        case .past: return "No Past Trips"
        case .all: return "No Trips"
        }
    }

    var emptyMessage: String {
        switch self {
        case .upcoming: return "Book your next adventure and it will appear here."
        case .past: return "Your past stays will appear here after check-out."
        case .all: return "You haven't made any reservations yet."
        }
    }
}

// MARK: - Trip Card

/// Beautiful card showing a trip with hero image and countdown
struct TripCard: View {

    let trip: DemoTrip

    private var countdownText: String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDay = calendar.startOfDay(for: trip.startDate)
        let endDay = calendar.startOfDay(for: trip.endDate)

        if trip.status == .checkedIn {
            let daysLeft = calendar.dateComponents([.day], from: today, to: endDay).day ?? 0
            if daysLeft == 0 {
                return "Checkout today"
            } else if daysLeft == 1 {
                return "1 day left"
            } else {
                return "\(daysLeft) days left"
            }
        } else if trip.status == .confirmed {
            let daysUntil = calendar.dateComponents([.day], from: today, to: startDay).day ?? 0
            if daysUntil == 0 {
                return "Arriving today"
            } else if daysUntil == 1 {
                return "Arriving tomorrow"
            } else {
                return "In \(daysUntil) days"
            }
        } else {
            return ""
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Hero image with overlay
            ZStack(alignment: .bottomLeading) {
                // Image placeholder
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [trip.imageColor.opacity(0.8), trip.imageColor.opacity(0.4)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 180)
                    .overlay(
                        Image(systemName: "tent.2.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.white.opacity(0.3))
                    )

                // Gradient overlay for text readability
                LinearGradient(
                    colors: [.clear, .black.opacity(0.6)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                // Status badge and countdown
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        // Status badge
                        HStack(spacing: 4) {
                            Image(systemName: trip.status.icon)
                            Text(trip.status.label)
                        }
                        .font(.campCaption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(trip.status.color)
                        .cornerRadius(20)

                        Spacer()

                        // Countdown
                        if !countdownText.isEmpty {
                            Text(countdownText)
                                .font(.campLabel)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(.ultraThinMaterial)
                                .cornerRadius(20)
                        }
                    }

                    Spacer()

                    // Campground name
                    Text(trip.campgroundName)
                        .font(.campHeading2)
                        .foregroundColor(.white)

                    Text(trip.campgroundLocation)
                        .font(.campBodySmall)
                        .foregroundColor(.white.opacity(0.9))
                }
                .padding(16)
            }
            .clipped()

            // Details section
            VStack(alignment: .leading, spacing: 12) {
                // Site info
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(trip.siteName)
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                        Text(trip.siteType)
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }

                    Spacer()

                    // Unread messages badge
                    if trip.hasUnreadMessages {
                        HStack(spacing: 4) {
                            Image(systemName: "message.fill")
                            Text("New")
                        }
                        .font(.campCaption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.campPrimary)
                        .cornerRadius(12)
                    }
                }

                Divider()

                // Date and guests
                HStack(spacing: 24) {
                    // Dates
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Dates")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                        Text(formatDateRange())
                            .font(.campBodySmall)
                            .foregroundColor(.campTextPrimary)
                    }

                    Spacer()

                    // Nights
                    VStack(alignment: .center, spacing: 2) {
                        Text("\(trip.nightCount)")
                            .font(.campHeading3)
                            .foregroundColor(.campPrimary)
                        Text("nights")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }

                    // Guests
                    VStack(alignment: .center, spacing: 2) {
                        Text("\(trip.guestCount)")
                            .font(.campHeading3)
                            .foregroundColor(.campPrimary)
                        Text("guests")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }

                // Balance warning if not paid
                if !trip.isPaid {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.campWarning)
                        Text("Balance due: \(formatMoney(cents: trip.balanceCents))")
                            .font(.campBodySmall)
                            .foregroundColor(.campWarning)
                        Spacer()
                        Text("Pay Now")
                            .font(.campLabel)
                            .foregroundColor(.campPrimary)
                    }
                    .padding(12)
                    .background(Color.campWarning.opacity(0.1))
                    .cornerRadius(8)
                }
            }
            .padding(16)
        }
        .background(Color.campSurface)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }

    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let start = formatter.string(from: trip.startDate)
        let end = formatter.string(from: trip.endDate)
        return "\(start) - \(end)"
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

// MARK: - Preview

#Preview {
    ReservationsListView()
}
