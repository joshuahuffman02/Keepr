import SwiftUI
import CampreservCore
import CampreservUI

/// Staff dashboard with today's overview
struct StaffDashboardView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var summary: DashboardSummary?
    @State private var isLoading = true
    @State private var showNewBooking = false
    @State private var showGuestSearch = false
    @State private var showQuickSale = false
    @State private var showAllArrivals = false
    @State private var showAllDepartures = false
    @State private var showCampgroundSelector = false

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
                        showCampgroundSelector = true
                    } label: {
                        Image(systemName: "building.2")
                    }
                }
            }
            .sheet(isPresented: $showCampgroundSelector) {
                CampgroundSelectorSheet()
            }
            .sheet(isPresented: $showAllArrivals) {
                AllArrivalsSheet(arrivals: summary?.upcomingArrivals ?? [])
            }
            .sheet(isPresented: $showAllDepartures) {
                AllDeparturesSheet(departures: summary?.pendingDepartures ?? [])
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
            action: { showAllArrivals = true },
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
            action: { showAllDepartures = true },
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
                    showNewBooking = true
                }

                QuickActionButton(
                    icon: "magnifyingglass",
                    title: "Search",
                    subtitle: "Guest"
                ) {
                    showGuestSearch = true
                }

                QuickActionButton(
                    icon: "creditcard",
                    title: "Quick",
                    subtitle: "Sale"
                ) {
                    showQuickSale = true
                }
            }
        }
        .sheet(isPresented: $showNewBooking) {
            NewBookingSheet()
        }
        .sheet(isPresented: $showGuestSearch) {
            GuestSearchSheet()
        }
        .sheet(isPresented: $showQuickSale) {
            QuickSaleSheet()
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

// MARK: - New Booking Sheet

struct NewBookingSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var guestName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var selectedSite = ""
    @State private var arrivalDate = Date()
    @State private var departureDate = Date().addingTimeInterval(86400 * 2)
    @State private var adults = 2
    @State private var children = 0
    @State private var notes = ""
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Guest information
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Guest Information")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        VStack(spacing: 12) {
                            FormTextField(label: "Guest Name", text: $guestName, placeholder: "John Smith")
                            FormTextField(label: "Phone", text: $phone, placeholder: "(555) 123-4567", keyboardType: .phonePad)
                            FormTextField(label: "Email", text: $email, placeholder: "john@example.com", keyboardType: .emailAddress)
                        }
                    }
                    .padding(20)
                    .background(Color.campSurface)
                    .cornerRadius(16)

                    // Reservation details
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Reservation Details")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        VStack(spacing: 16) {
                            // Site selection
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Site")
                                    .font(.campLabel)
                                    .foregroundColor(.campTextSecondary)

                                Menu {
                                    ForEach(["A-01", "A-02", "A-03", "B-01", "B-02", "C-01"], id: \.self) { site in
                                        Button(site) { selectedSite = site }
                                    }
                                } label: {
                                    HStack {
                                        Text(selectedSite.isEmpty ? "Select a site" : selectedSite)
                                            .foregroundColor(selectedSite.isEmpty ? .campTextHint : .campTextPrimary)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .foregroundColor(.campTextHint)
                                    }
                                    .font(.campBody)
                                    .padding(14)
                                    .background(Color.campBackground)
                                    .cornerRadius(10)
                                }
                            }

                            HStack(spacing: 16) {
                                DatePickerField(label: "Arrival", date: $arrivalDate)
                                DatePickerField(label: "Departure", date: $departureDate)
                            }

                            HStack(spacing: 16) {
                                StepperField(label: "Adults", value: $adults, range: 1...10)
                                StepperField(label: "Children", value: $children, range: 0...10)
                            }
                        }
                    }
                    .padding(20)
                    .background(Color.campSurface)
                    .cornerRadius(16)

                    // Notes
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes (Optional)")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        TextEditor(text: $notes)
                            .font(.campBody)
                            .frame(height: 80)
                            .padding(10)
                            .background(Color.campBackground)
                            .cornerRadius(10)
                    }
                    .padding(20)
                    .background(Color.campSurface)
                    .cornerRadius(16)

                    // Create button
                    PrimaryButton("Create Reservation", icon: "checkmark.circle", isLoading: isCreating) {
                        Task { await createBooking() }
                    }
                    .disabled(guestName.isEmpty || selectedSite.isEmpty)
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("New Booking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func createBooking() async {
        isCreating = true
        try? await Task.sleep(for: .seconds(1))
        isCreating = false
        dismiss()
    }
}

// MARK: - Guest Search Sheet

struct GuestSearchSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @State private var searchResults: [GuestSearchResult] = []
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                HStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.campTextHint)

                    TextField("Search by name, phone, email, or confirmation #", text: $searchText)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()

                    if !searchText.isEmpty {
                        Button {
                            searchText = ""
                            searchResults = []
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.campTextHint)
                        }
                    }
                }
                .padding(14)
                .background(Color.campBackground)
                .cornerRadius(12)
                .padding(16)

                Divider()

                // Results
                if isSearching {
                    VStack {
                        Spacer()
                        ProgressView()
                        Text("Searching...")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                        Spacer()
                    }
                } else if searchResults.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "person.crop.circle.badge.questionmark")
                            .font(.system(size: 48))
                            .foregroundColor(.campTextHint)
                        Text("No guests found")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                        Text("Try searching with different criteria")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                        Spacer()
                    }
                } else if searchResults.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(.campTextHint)
                        Text("Search for a guest")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                        Text("Enter name, phone, email, or confirmation #")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                        Spacer()
                    }
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(searchResults) { guest in
                                GuestSearchRow(guest: guest) {
                                    // Navigate to guest detail or reservation
                                    dismiss()
                                }

                                if guest.id != searchResults.last?.id {
                                    Divider()
                                        .padding(.leading, 60)
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campSurface)
            .navigationTitle("Search Guests")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onChange(of: searchText) { _ in
                performSearch()
            }
        }
    }

    private func performSearch() {
        guard searchText.count >= 2 else {
            searchResults = []
            return
        }

        isSearching = true

        // Simulate API delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            // Demo results
            searchResults = GuestSearchResult.samples.filter { guest in
                guest.name.localizedCaseInsensitiveContains(searchText) ||
                guest.email.localizedCaseInsensitiveContains(searchText) ||
                guest.phone.contains(searchText) ||
                guest.confirmationNumber.localizedCaseInsensitiveContains(searchText)
            }
            isSearching = false
        }
    }
}

struct GuestSearchResult: Identifiable {
    let id: String
    let name: String
    let email: String
    let phone: String
    let siteName: String
    let confirmationNumber: String
    let status: String
    let arrivalDate: Date

    static let samples: [GuestSearchResult] = [
        GuestSearchResult(id: "g1", name: "John Smith", email: "john@example.com", phone: "(555) 123-4567", siteName: "A-01", confirmationNumber: "CAMP-001234", status: "confirmed", arrivalDate: Date()),
        GuestSearchResult(id: "g2", name: "Sarah Johnson", email: "sarah.j@email.com", phone: "(555) 987-6543", siteName: "B-03", confirmationNumber: "CAMP-001235", status: "checked_in", arrivalDate: Date().addingTimeInterval(-86400)),
        GuestSearchResult(id: "g3", name: "Mike Williams", email: "mike.w@gmail.com", phone: "(555) 456-7890", siteName: "C-02", confirmationNumber: "CAMP-001236", status: "pending", arrivalDate: Date().addingTimeInterval(86400)),
        GuestSearchResult(id: "g4", name: "Emily Davis", email: "emily.d@work.com", phone: "(555) 321-0987", siteName: "A-05", confirmationNumber: "CAMP-001237", status: "confirmed", arrivalDate: Date().addingTimeInterval(86400 * 2))
    ]
}

struct GuestSearchRow: View {
    let guest: GuestSearchResult
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                // Avatar
                Circle()
                    .fill(Color.campPrimary.opacity(0.15))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Text(initials)
                            .font(.campLabel)
                            .foregroundColor(.campPrimary)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(guest.name)
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)

                        StatusBadge(rawValue: guest.status, size: .small)
                    }

                    HStack(spacing: 8) {
                        Text(guest.siteName)
                            .font(.campCaption)
                            .foregroundColor(.campInfo)

                        Text(guest.confirmationNumber)
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(.campTextHint)
            }
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }

    private var initials: String {
        let parts = guest.name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(guest.name.prefix(2))
    }
}

// MARK: - Quick Sale Sheet

struct QuickSaleSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var description = ""
    @State private var selectedCategory = "General"
    @State private var linkToReservation = ""
    @State private var isProcessing = false
    @State private var showSuccess = false

    let categories = ["General", "Firewood", "Ice", "Store", "Services", "Other"]

    var body: some View {
        NavigationStack {
            if showSuccess {
                successView
            } else {
                saleForm
            }
        }
    }

    private var saleForm: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Amount entry
                VStack(spacing: 8) {
                    Text("Amount")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("$")
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(.campTextSecondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 56, weight: .semibold))
                            .foregroundColor(.campTextPrimary)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 200)
                    }
                }
                .padding(32)
                .frame(maxWidth: .infinity)
                .background(Color.campSurface)
                .cornerRadius(20)

                // Description
                VStack(alignment: .leading, spacing: 12) {
                    FormTextField(label: "Description", text: $description, placeholder: "What's this for?")

                    // Category
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Category")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(categories, id: \.self) { category in
                                    Button {
                                        selectedCategory = category
                                    } label: {
                                        Text(category)
                                            .font(.campCaption)
                                            .foregroundColor(selectedCategory == category ? .white : .campTextPrimary)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .background(selectedCategory == category ? Color.campPrimary : Color.campBackground)
                                            .cornerRadius(20)
                                    }
                                }
                            }
                        }
                    }

                    // Link to reservation (optional)
                    FormTextField(label: "Link to Reservation (Optional)", text: $linkToReservation, placeholder: "Confirmation # or guest name")
                }
                .padding(20)
                .background(Color.campSurface)
                .cornerRadius(16)

                // Charge button
                PrimaryButton("Charge \(formattedAmount)", icon: "creditcard", isLoading: isProcessing) {
                    Task { await processSale() }
                }
                .disabled(amount.isEmpty || Double(amount) == nil || Double(amount)! <= 0)
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Quick Sale")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var successView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.campSuccess)

            Text("Sale Complete")
                .font(.campDisplaySmall)
                .foregroundColor(.campTextPrimary)

            Text(formattedAmount)
                .font(.campHeading2)
                .foregroundColor(.campPrimary)

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton("New Sale", icon: "plus") {
                    amount = ""
                    description = ""
                    linkToReservation = ""
                    showSuccess = false
                }

                SecondaryButton("Done") {
                    dismiss()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
    }

    private var formattedAmount: String {
        guard let value = Double(amount), value > 0 else { return "$0.00" }
        return String(format: "$%.2f", value)
    }

    private func processSale() async {
        isProcessing = true
        try? await Task.sleep(for: .seconds(1.5))
        isProcessing = false
        showSuccess = true
    }
}

// MARK: - Form Components

struct FormTextField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var keyboardType: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextSecondary)

            TextField(placeholder, text: $text)
                .font(.campBody)
                .keyboardType(keyboardType)
                .autocorrectionDisabled(keyboardType != .default)
                .textInputAutocapitalization(keyboardType == .emailAddress ? .never : .words)
                .padding(14)
                .background(Color.campBackground)
                .cornerRadius(10)
        }
    }
}

struct DatePickerField: View {
    let label: String
    @Binding var date: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextSecondary)

            DatePicker("", selection: $date, displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
        }
    }
}

struct StepperField: View {
    let label: String
    @Binding var value: Int
    let range: ClosedRange<Int>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextSecondary)

            HStack {
                Button {
                    if value > range.lowerBound { value -= 1 }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(value <= range.lowerBound ? .campTextHint : .campPrimary)
                }
                .disabled(value <= range.lowerBound)

                Text("\(value)")
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
                    .frame(width: 40)

                Button {
                    if value < range.upperBound { value += 1 }
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(value >= range.upperBound ? .campTextHint : .campPrimary)
                }
                .disabled(value >= range.upperBound)
            }
            .padding(10)
            .background(Color.campBackground)
            .cornerRadius(10)
        }
    }
}

// MARK: - Campground Selector Sheet

struct CampgroundSelectorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: StaffAppState

    let campgrounds = [
        ("Pine Valley Resort", "123 Pine Rd"),
        ("Mountain View RV Park", "456 Mountain Ave"),
        ("Lakeside Campground", "789 Lake Dr")
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(campgrounds, id: \.0) { name, address in
                    Button {
                        // Would set appState.currentCampground
                        dismiss()
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "tent.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.campPrimary)
                                .frame(width: 40)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(name)
                                    .font(.campLabel)
                                    .foregroundColor(.campTextPrimary)
                                Text(address)
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                            }

                            Spacer()

                            if name == "Pine Valley Resort" {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.campPrimary)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Select Campground")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - All Arrivals Sheet

struct AllArrivalsSheet: View {
    let arrivals: [Reservation]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if arrivals.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "arrow.down.circle")
                            .font(.system(size: 48))
                            .foregroundColor(.campTextHint)
                        Text("No arrivals today")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(arrivals, id: \.id) { reservation in
                            ArrivalListRow(reservation: reservation)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color.campBackground)
            .navigationTitle("Today's Arrivals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

struct ArrivalListRow: View {
    let reservation: Reservation

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(Color.campSuccess.opacity(0.1))
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: "arrow.down.circle")
                        .foregroundColor(.campSuccess)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(reservation.guestName ?? "Guest")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                HStack(spacing: 8) {
                    Text(reservation.siteName ?? "Site")
                        .font(.campCaption)
                        .foregroundColor(.campInfo)

                    StatusBadge(rawValue: reservation.status, size: .small)
                }
            }

            Spacer()

            Button("Check In") {
                // Perform check-in
            }
            .font(.campLabel)
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.campSuccess)
            .cornerRadius(8)
        }
        .padding(.vertical, 8)
    }
}

// MARK: - All Departures Sheet

struct AllDeparturesSheet: View {
    let departures: [Reservation]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if departures.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "arrow.up.circle")
                            .font(.system(size: 48))
                            .foregroundColor(.campTextHint)
                        Text("No departures today")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(departures, id: \.id) { reservation in
                            DepartureListRow(reservation: reservation)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color.campBackground)
            .navigationTitle("Today's Departures")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

struct DepartureListRow: View {
    let reservation: Reservation

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(Color.campWarning.opacity(0.1))
                .frame(width: 44, height: 44)
                .overlay(
                    Image(systemName: "arrow.up.circle")
                        .foregroundColor(.campWarning)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(reservation.guestName ?? "Guest")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                HStack(spacing: 8) {
                    Text(reservation.siteName ?? "Site")
                        .font(.campCaption)
                        .foregroundColor(.campInfo)

                    StatusBadge(rawValue: reservation.status, size: .small)
                }
            }

            Spacer()

            Button("Check Out") {
                // Perform check-out
            }
            .font(.campLabel)
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.campWarning)
            .cornerRadius(8)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    StaffDashboardView()
        .environmentObject(StaffAppState())
}
