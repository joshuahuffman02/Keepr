import SwiftUI
import CampreservCore
import CampreservUI

/// Staff reservations management view - full screen layout
struct StaffReservationsView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var searchText = ""
    @State private var reservations: [DemoReservation] = []
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
                    Spacer()
                    LoadingView(message: "Loading reservations...")
                    Spacer()
                } else if filteredReservations.isEmpty {
                    Spacer()
                    EmptyStateView(
                        icon: "calendar",
                        title: "No Reservations",
                        message: selectedFilter.emptyMessage,
                        actionTitle: "Create Booking"
                    ) {
                        showNewBooking = true
                    }
                    Spacer()
                } else {
                    reservationsList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.campTextHint)
                }
            }
        }
        .padding(12)
        .background(Color.campSurface)
        .cornerRadius(10)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(StaffReservationFilter.allCases, id: \.self) { filter in
                    ReservationFilterChip(
                        title: filter.title,
                        count: countFor(filter),
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.campSurface)
    }

    private func countFor(_ filter: StaffReservationFilter) -> Int {
        let today = Date()
        switch filter {
        case .today:
            return reservations.filter { res in
                (res.status == "confirmed" && Calendar.current.isDateInToday(res.startDate)) ||
                (res.status == "checked_in" && Calendar.current.isDateInToday(res.endDate))
            }.count
        case .arrivals:
            return reservations.filter { res in
                res.status == "confirmed" && res.startDate >= today
            }.count
        case .inHouse:
            return reservations.filter { $0.status == "checked_in" }.count
        case .departures:
            return reservations.filter { res in
                res.status == "checked_in" && Calendar.current.isDateInToday(res.endDate)
            }.count
        case .all:
            return reservations.count
        }
    }

    private var reservationsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredReservations) { reservation in
                    NavigationLink(destination: StaffReservationDetailView(reservation: reservation)) {
                        ReservationCard(reservation: reservation)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
    }

    private var filteredReservations: [DemoReservation] {
        var result = reservations

        // Apply search filter
        if !searchText.isEmpty {
            result = result.filter { reservation in
                reservation.guestName.localizedCaseInsensitiveContains(searchText) ||
                reservation.confirmationNumber.localizedCaseInsensitiveContains(searchText) ||
                reservation.siteName.localizedCaseInsensitiveContains(searchText)
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

        // Simulate loading demo reservations
        try? await Task.sleep(for: .seconds(0.5))
        reservations = DemoReservation.samples
    }
}

// MARK: - Demo Model

struct DemoReservation: Identifiable {
    let id: String
    let guestName: String
    let guestEmail: String
    let guestPhone: String?
    let siteName: String
    let siteClassName: String
    let confirmationNumber: String
    let status: String
    let startDate: Date
    let endDate: Date
    let nights: Int
    let adults: Int
    let children: Int
    let pets: Int
    let totalAmountCents: Int
    let paidAmountCents: Int
    let balanceAmountCents: Int
    let notes: String?
    let vehicleType: String?
    let vehicleLicense: String?

    static let samples: [DemoReservation] = {
        let today = Date()
        let calendar = Calendar.current

        return [
            // Today's arrivals
            DemoReservation(
                id: "res-1",
                guestName: "Michael Johnson",
                guestEmail: "michael.j@email.com",
                guestPhone: "(555) 123-4567",
                siteName: "Site 15",
                siteClassName: "Premium RV",
                confirmationNumber: "CAMP-2024-1001",
                status: "confirmed",
                startDate: today,
                endDate: calendar.date(byAdding: .day, value: 3, to: today)!,
                nights: 3,
                adults: 2,
                children: 0,
                pets: 1,
                totalAmountCents: 27500,
                paidAmountCents: 27500,
                balanceAmountCents: 0,
                notes: "Celebrating anniversary. Please set up welcome package.",
                vehicleType: "Class A Motorhome",
                vehicleLicense: "ABC 1234"
            ),
            DemoReservation(
                id: "res-2",
                guestName: "Sarah Williams",
                guestEmail: "sarah.w@email.com",
                guestPhone: "(555) 234-5678",
                siteName: "Cabin 3",
                siteClassName: "Deluxe Cabin",
                confirmationNumber: "CAMP-2024-1002",
                status: "confirmed",
                startDate: today,
                endDate: calendar.date(byAdding: .day, value: 2, to: today)!,
                nights: 2,
                adults: 4,
                children: 2,
                pets: 0,
                totalAmountCents: 45000,
                paidAmountCents: 22500,
                balanceAmountCents: 22500,
                notes: nil,
                vehicleType: nil,
                vehicleLicense: nil
            ),

            // In house
            DemoReservation(
                id: "res-3",
                guestName: "Robert Chen",
                guestEmail: "robert.c@email.com",
                guestPhone: "(555) 345-6789",
                siteName: "Site 22",
                siteClassName: "Standard RV",
                confirmationNumber: "CAMP-2024-0998",
                status: "checked_in",
                startDate: calendar.date(byAdding: .day, value: -2, to: today)!,
                endDate: calendar.date(byAdding: .day, value: 1, to: today)!,
                nights: 3,
                adults: 2,
                children: 1,
                pets: 0,
                totalAmountCents: 18500,
                paidAmountCents: 18500,
                balanceAmountCents: 0,
                notes: "Early check-out requested around 9am",
                vehicleType: "Travel Trailer",
                vehicleLicense: "XYZ 9876"
            ),
            DemoReservation(
                id: "res-4",
                guestName: "Emily Davis",
                guestEmail: "emily.d@email.com",
                guestPhone: "(555) 456-7890",
                siteName: "Tent Site 5",
                siteClassName: "Tent Site",
                confirmationNumber: "CAMP-2024-0999",
                status: "checked_in",
                startDate: calendar.date(byAdding: .day, value: -1, to: today)!,
                endDate: calendar.date(byAdding: .day, value: 2, to: today)!,
                nights: 3,
                adults: 2,
                children: 0,
                pets: 2,
                totalAmountCents: 9000,
                paidAmountCents: 9000,
                balanceAmountCents: 0,
                notes: nil,
                vehicleType: nil,
                vehicleLicense: nil
            ),

            // Today's departure
            DemoReservation(
                id: "res-5",
                guestName: "James Wilson",
                guestEmail: "james.w@email.com",
                guestPhone: "(555) 567-8901",
                siteName: "Site 8",
                siteClassName: "Premium RV",
                confirmationNumber: "CAMP-2024-0995",
                status: "checked_in",
                startDate: calendar.date(byAdding: .day, value: -4, to: today)!,
                endDate: today,
                nights: 4,
                adults: 2,
                children: 3,
                pets: 1,
                totalAmountCents: 42000,
                paidAmountCents: 35000,
                balanceAmountCents: 7000,
                notes: "Purchased firewood yesterday - add to final bill",
                vehicleType: "Fifth Wheel",
                vehicleLicense: "CAMP 123"
            ),

            // Future arrivals
            DemoReservation(
                id: "res-6",
                guestName: "Lisa Thompson",
                guestEmail: "lisa.t@email.com",
                guestPhone: "(555) 678-9012",
                siteName: "Cabin 1",
                siteClassName: "Premium Cabin",
                confirmationNumber: "CAMP-2024-1005",
                status: "confirmed",
                startDate: calendar.date(byAdding: .day, value: 1, to: today)!,
                endDate: calendar.date(byAdding: .day, value: 4, to: today)!,
                nights: 3,
                adults: 2,
                children: 0,
                pets: 0,
                totalAmountCents: 67500,
                paidAmountCents: 67500,
                balanceAmountCents: 0,
                notes: "Honeymoon couple - upgrade if possible",
                vehicleType: nil,
                vehicleLicense: nil
            ),
            DemoReservation(
                id: "res-7",
                guestName: "David Martinez",
                guestEmail: "david.m@email.com",
                guestPhone: "(555) 789-0123",
                siteName: "Site 30",
                siteClassName: "Full Hookup",
                confirmationNumber: "CAMP-2024-1010",
                status: "confirmed",
                startDate: calendar.date(byAdding: .day, value: 2, to: today)!,
                endDate: calendar.date(byAdding: .day, value: 9, to: today)!,
                nights: 7,
                adults: 2,
                children: 2,
                pets: 1,
                totalAmountCents: 59500,
                paidAmountCents: 29750,
                balanceAmountCents: 29750,
                notes: "Returning guest. Long-term stay discount applied.",
                vehicleType: "Class C Motorhome",
                vehicleLicense: "RV LIFE"
            )
        ]
    }()
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

struct ReservationFilterChip: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(isSelected ? .campPrimary : .white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white : Color.campPrimary)
                        .cornerRadius(10)
                }
            }
            .font(.campLabel)
            .foregroundColor(isSelected ? .white : .campTextPrimary)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? Color.campPrimary : Color.campBackground)
            .cornerRadius(20)
        }
    }
}

struct ReservationCard: View {
    let reservation: DemoReservation

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(reservation.guestName)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                    Text(reservation.confirmationNumber)
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                }

                Spacer()

                ReservationStatusBadge(status: reservation.status)
            }

            // Site info
            HStack(spacing: 16) {
                Label(reservation.siteName, systemImage: "tent.fill")
                Label(reservation.siteClassName, systemImage: "tag.fill")
            }
            .font(.campCaption)
            .foregroundColor(.campTextSecondary)

            // Date and guest count
            HStack {
                Label(formatDateRange(), systemImage: "calendar")
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)

                Spacer()

                HStack(spacing: 8) {
                    if reservation.adults > 0 {
                        Label("\(reservation.adults)", systemImage: "person.fill")
                    }
                    if reservation.children > 0 {
                        Label("\(reservation.children)", systemImage: "figure.and.child.holdinghands")
                    }
                    if reservation.pets > 0 {
                        Label("\(reservation.pets)", systemImage: "pawprint.fill")
                    }
                }
                .font(.campCaption)
                .foregroundColor(.campTextHint)
            }

            // Balance due indicator
            if reservation.balanceAmountCents > 0 {
                HStack {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(.campWarning)
                    Text("$\(String(format: "%.2f", Double(reservation.balanceAmountCents) / 100.0)) balance due")
                        .font(.campCaption)
                        .foregroundColor(.campWarning)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }

    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let start = formatter.string(from: reservation.startDate)
        let end = formatter.string(from: reservation.endDate)
        return "\(start) - \(end) (\(reservation.nights) nights)"
    }
}

struct ReservationStatusBadge: View {
    let status: String

    var body: some View {
        Text(displayText)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .cornerRadius(6)
    }

    private var displayText: String {
        switch status {
        case "pending": return "Pending"
        case "confirmed": return "Confirmed"
        case "checked_in": return "Checked In"
        case "checked_out": return "Checked Out"
        case "cancelled": return "Cancelled"
        default: return status.capitalized
        }
    }

    private var color: Color {
        switch status {
        case "pending": return .campWarning
        case "confirmed": return .campInfo
        case "checked_in": return .campSuccess
        case "checked_out": return .campTextSecondary
        case "cancelled": return .campError
        default: return .campTextSecondary
        }
    }
}

/// Staff reservation detail with action buttons
struct StaffReservationDetailView: View {
    let reservation: DemoReservation
    @State private var isLoading = false
    @State private var showPaymentCollection = false
    @State private var showMessages = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Guest header card
                guestCard

                // Quick action buttons
                quickActions

                // Reservation details
                detailsCard

                // Payment summary
                paymentCard

                // Notes
                if let notes = reservation.notes {
                    notesCard(notes)
                }
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
        .navigationTitle("Reservation")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPaymentCollection) {
            PaymentCollectionView(reservation: reservation)
        }
        .sheet(isPresented: $showMessages) {
            GuestMessagesView(guestName: reservation.guestName)
        }
    }

    private var guestCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(reservation.guestName)
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)
                    Text(reservation.guestEmail)
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    if let phone = reservation.guestPhone {
                        Text(phone)
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                }
                Spacer()
                ReservationStatusBadge(status: reservation.status)
            }

            Divider()

            HStack {
                Text(reservation.confirmationNumber)
                    .font(.campLabel)
                    .foregroundColor(.campPrimary)
                Spacer()
                Text("\(reservation.siteName) - \(reservation.siteClassName)")
                    .font(.campLabel)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var quickActions: some View {
        VStack(spacing: 12) {
            // Primary action based on status
            switch reservation.status {
            case "confirmed":
                PrimaryButton("Check In Guest", icon: "arrow.down.circle.fill") {
                    Task { await performCheckIn() }
                }
            case "checked_in":
                PrimaryButton("Check Out Guest", icon: "arrow.up.circle.fill") {
                    Task { await performCheckOut() }
                }
            default:
                EmptyView()
            }

            // Secondary actions
            HStack(spacing: 12) {
                if reservation.balanceAmountCents > 0 {
                    SecondaryButton("Collect Payment") {
                        showPaymentCollection = true
                    }
                }
                SecondaryButton("Message Guest") {
                    showMessages = true
                }
            }
        }
    }

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Reservation Details")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                DetailItem(icon: "calendar", label: "Check-in", value: formatDate(reservation.startDate))
                DetailItem(icon: "calendar.badge.clock", label: "Check-out", value: formatDate(reservation.endDate))
                DetailItem(icon: "moon.fill", label: "Nights", value: "\(reservation.nights)")
                DetailItem(icon: "person.2.fill", label: "Guests", value: "\(reservation.adults) adults, \(reservation.children) kids")
            }

            if reservation.pets > 0 {
                HStack {
                    Image(systemName: "pawprint.fill")
                        .foregroundColor(.campPrimary)
                    Text("\(reservation.pets) pet(s)")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                }
            }

            if let vehicleType = reservation.vehicleType {
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("Vehicle")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(vehicleType)
                        .font(.campBody)
                        .foregroundColor(.campTextPrimary)
                    if let license = reservation.vehicleLicense {
                        Text("License: \(license)")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var paymentCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Payment")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            VStack(spacing: 8) {
                PaymentRow(label: "Total", amount: reservation.totalAmountCents)
                PaymentRow(label: "Paid", amount: reservation.paidAmountCents, color: .campSuccess)
                if reservation.balanceAmountCents > 0 {
                    Divider()
                    PaymentRow(label: "Balance Due", amount: reservation.balanceAmountCents, color: .campError, isLarge: true)
                } else {
                    Divider()
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.campSuccess)
                        Text("Paid in Full")
                            .font(.campLabel)
                            .foregroundColor(.campSuccess)
                    }
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private func notesCard(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "note.text")
                    .foregroundColor(.campPrimary)
                Text("Notes")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
            }
            Text(notes)
                .font(.campBody)
                .foregroundColor(.campTextSecondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    private func performCheckIn() async {
        isLoading = true
        try? await Task.sleep(for: .seconds(1))
        isLoading = false
        // Would update status
    }

    private func performCheckOut() async {
        isLoading = true
        try? await Task.sleep(for: .seconds(1))
        isLoading = false
        // Would update status
    }
}

struct DetailItem: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .foregroundColor(.campPrimary)
                    .font(.system(size: 12))
                Text(label)
                    .foregroundColor(.campTextHint)
            }
            .font(.campCaption)

            Text(value)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campBackground)
        .cornerRadius(10)
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
    @State private var guestName = ""
    @State private var guestEmail = ""
    @State private var guestPhone = ""
    @State private var selectedSite = ""
    @State private var startDate = Date()
    @State private var endDate = Date().addingTimeInterval(86400)
    @State private var adults = 2
    @State private var children = 0

    var body: some View {
        NavigationStack {
            Form {
                Section("Guest Information") {
                    TextField("Guest Name", text: $guestName)
                    TextField("Email", text: $guestEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                    TextField("Phone", text: $guestPhone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                }

                Section("Reservation Details") {
                    DatePicker("Check-in", selection: $startDate, displayedComponents: .date)
                    DatePicker("Check-out", selection: $endDate, displayedComponents: .date)
                    Stepper("Adults: \(adults)", value: $adults, in: 1...10)
                    Stepper("Children: \(children)", value: $children, in: 0...10)
                }

                Section("Site") {
                    Picker("Select Site", selection: $selectedSite) {
                        Text("Site 15 - Premium RV").tag("site-15")
                        Text("Site 22 - Standard RV").tag("site-22")
                        Text("Cabin 1 - Premium Cabin").tag("cabin-1")
                        Text("Tent Site 5").tag("tent-5")
                    }
                }
            }
            .navigationTitle("New Booking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        // Create booking
                        dismiss()
                    }
                    .disabled(guestName.isEmpty)
                }
            }
        }
    }
}

/// Payment collection view
struct PaymentCollectionView: View {
    let reservation: DemoReservation
    @Environment(\.dismiss) private var dismiss
    @State private var paymentMethod = "card"
    @State private var amountText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Amount due
                VStack(spacing: 8) {
                    Text("Balance Due")
                        .font(.campLabel)
                        .foregroundColor(.campTextSecondary)
                    Text("$\(String(format: "%.2f", Double(reservation.balanceAmountCents) / 100.0))")
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.campTextPrimary)
                }
                .padding(.top, 32)

                // Payment method
                VStack(alignment: .leading, spacing: 12) {
                    Text("Payment Method")
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    Picker("Method", selection: $paymentMethod) {
                        Text("Card (Tap to Pay)").tag("card")
                        Text("Cash").tag("cash")
                        Text("Check").tag("check")
                    }
                    .pickerStyle(.segmented)
                }
                .padding(.horizontal)

                Spacer()

                // Collect button
                VStack(spacing: 12) {
                    if paymentMethod == "card" {
                        PrimaryButton("Tap to Collect $\(String(format: "%.2f", Double(reservation.balanceAmountCents) / 100.0))", icon: "wave.3.right") {
                            // Initiate Stripe Terminal
                        }
                        Text("Hold customer's card near device")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    } else {
                        PrimaryButton("Record \(paymentMethod.capitalized) Payment") {
                            // Record manual payment
                            dismiss()
                        }
                    }
                }
                .padding()
            }
            .background(Color.campBackground)
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

/// Guest messages view (placeholder for full messaging)
struct GuestMessagesView: View {
    let guestName: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Text("Messages with \(guestName)")
                .foregroundColor(.campTextSecondary)
                .navigationTitle("Messages")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}
