import SwiftUI
import CampreservCore
import CampreservUI

/// Staff reservations management view
struct StaffReservationsView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var searchText = ""
    @State private var reservations: [Reservation] = []
    @State private var isLoading = true
    @State private var selectedFilter: StaffReservationFilter = .today
    @State private var showNewBooking = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                searchBar

                // Filter tabs
                filterTabs

                // Content
                if isLoading {
                    LoadingView(message: "Loading reservations...")
                } else if filteredReservations.isEmpty {
                    EmptyStateView(
                        icon: "calendar",
                        title: "No Reservations",
                        message: selectedFilter.emptyMessage,
                        actionTitle: "Create Booking"
                    ) {
                        showNewBooking = true
                    }
                } else {
                    reservationsList
                }
            }
            .background(Color.campBackground)
            .navigationTitle("Reservations")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewBooking = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewBooking) {
                NewBookingView()
            }
            .refreshable {
                await loadReservations()
            }
        }
        .task {
            await loadReservations()
        }
    }

    // MARK: - Views

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.campTextHint)
            TextField("Search guest, confirmation #, site...", text: $searchText)
                .textFieldStyle(.plain)
        }
        .padding(12)
        .background(Color.campSurface)
        .cornerRadius(8)
        .padding()
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(StaffReservationFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.title,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    private var reservationsList: some View {
        List {
            ForEach(filteredReservations, id: \.id) { reservation in
                NavigationLink(destination: StaffReservationDetailView(reservation: reservation)) {
                    StaffReservationRow(reservation: reservation)
                }
            }
        }
        .listStyle(.plain)
    }

    private var filteredReservations: [Reservation] {
        var result = reservations

        // Apply search filter
        if !searchText.isEmpty {
            result = result.filter { reservation in
                (reservation.guestName?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (reservation.confirmationNumber?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (reservation.siteName?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        // Apply status filter
        let today = Date()
        switch selectedFilter {
        case .today:
            result = result.filter { reservation in
                (reservation.status == "confirmed" && Calendar.current.isDateInToday(reservation.startDate)) ||
                (reservation.status == "checked_in" && Calendar.current.isDateInToday(reservation.endDate))
            }
        case .arrivals:
            result = result.filter { reservation in
                reservation.status == "confirmed" && reservation.startDate >= today
            }
        case .inHouse:
            result = result.filter { $0.status == "checked_in" }
        case .departures:
            result = result.filter { reservation in
                reservation.status == "checked_in" && Calendar.current.isDateInToday(reservation.endDate)
            }
        case .all:
            break
        }

        return result
    }

    private func loadReservations() async {
        isLoading = true
        defer { isLoading = false }

        // Call API
        // reservations = try await apiClient.request(.getReservations(campgroundId: campgroundId, ...))

        try? await Task.sleep(for: .seconds(1))
        reservations = []
    }
}

// MARK: - Filter

enum StaffReservationFilter: CaseIterable {
    case today, arrivals, inHouse, departures, all

    var title: String {
        switch self {
        case .today: return "Today"
        case .arrivals: return "Arrivals"
        case .inHouse: return "In House"
        case .departures: return "Departures"
        case .all: return "All"
        }
    }

    var emptyMessage: String {
        switch self {
        case .today: return "No reservations scheduled for today."
        case .arrivals: return "No upcoming arrivals."
        case .inHouse: return "No guests currently checked in."
        case .departures: return "No departures today."
        case .all: return "No reservations found."
        }
    }
}

// MARK: - Components

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.campLabel)
                .foregroundColor(isSelected ? .white : .campTextPrimary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.campPrimary : Color.campSurface)
                .cornerRadius(20)
        }
    }
}

struct StaffReservationRow: View {
    let reservation: Reservation

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(reservation.guestName ?? "Guest")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                HStack(spacing: 8) {
                    Text(reservation.siteName ?? "Site")
                    Text("-")
                    Text(formatDateRange())
                }
                .font(.campCaption)
                .foregroundColor(.campTextSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                StatusBadge(rawValue: reservation.status, size: .small)

                if reservation.balanceAmountCents > 0 {
                    Text("$\(String(format: "%.2f", Double(reservation.balanceAmountCents) / 100.0)) due")
                        .font(.campCaption)
                        .foregroundColor(.campError)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return "\(formatter.string(from: reservation.startDate)) - \(formatter.string(from: reservation.endDate))"
    }
}

/// Staff reservation detail with action buttons
struct StaffReservationDetailView: View {
    let reservation: Reservation
    @State private var isLoading = false
    @State private var showPaymentCollection = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(reservation.guestName ?? "Guest")
                                    .font(.campHeading2)
                                Text(reservation.guestEmail ?? "")
                                    .font(.campBody)
                                    .foregroundColor(.campTextSecondary)
                            }
                            Spacer()
                            StatusBadge(rawValue: reservation.status)
                        }

                        Divider()

                        HStack {
                            Label(reservation.siteName ?? "Site", systemImage: "tent")
                            Spacer()
                            Text(reservation.confirmationNumber ?? "")
                                .font(.campLabel)
                        }
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    }
                }

                // Action buttons based on status
                actionButtons

                // Payment summary
                paymentSection

                // Guest notes
                if let notes = reservation.notes, !notes.isEmpty {
                    SectionCard(title: "Notes") {
                        Text(notes)
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Reservation")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPaymentCollection) {
            PaymentCollectionView(reservation: reservation)
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            switch reservation.status {
            case "confirmed":
                PrimaryButton("Check In", icon: "arrow.down.circle") {
                    Task { await performCheckIn() }
                }
            case "checked_in":
                PrimaryButton("Check Out", icon: "arrow.up.circle") {
                    Task { await performCheckOut() }
                }
            default:
                EmptyView()
            }

            if reservation.balanceAmountCents > 0 {
                SecondaryButton("Collect Payment") {
                    showPaymentCollection = true
                }
            }
        }
    }

    private var paymentSection: some View {
        SectionCard(title: "Payment") {
            VStack(spacing: 8) {
                PaymentRow(label: "Total", amount: reservation.totalAmountCents)
                PaymentRow(label: "Paid", amount: reservation.paidAmountCents, color: .campSuccess)
                if reservation.balanceAmountCents > 0 {
                    Divider()
                    PaymentRow(label: "Balance Due", amount: reservation.balanceAmountCents, color: .campError, isLarge: true)
                }
            }
        }
    }

    private func performCheckIn() async {
        isLoading = true
        // Call API
        isLoading = false
    }

    private func performCheckOut() async {
        isLoading = true
        // Call API
        isLoading = false
    }
}

struct PaymentRow: View {
    let label: String
    let amount: Int
    var color: Color = .campTextPrimary
    var isLarge: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(isLarge ? .campLabel : .campBody)
                .foregroundColor(.campTextSecondary)
            Spacer()
            Text("$\(String(format: "%.2f", Double(amount) / 100.0))")
                .font(isLarge ? .campHeading3 : .campLabel)
                .foregroundColor(color)
        }
    }
}

/// New booking flow for walk-ins
struct NewBookingView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("New Booking Form")
                .navigationTitle("New Booking")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

/// Payment collection view
struct PaymentCollectionView: View {
    let reservation: Reservation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("Payment Collection")
                .navigationTitle("Collect Payment")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}
