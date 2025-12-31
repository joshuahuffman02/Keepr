import SwiftUI
import CampreservCore
import CampreservUI

/// Campground search and availability view
struct BookingSearchView: View {

    @State private var searchText = ""
    @State private var checkInDate = Date()
    @State private var checkOutDate = Date().addingTimeInterval(86400 * 3)
    @State private var guestCount = 2
    @State private var campgrounds: [Campground] = []
    @State private var isSearching = false
    @State private var hasSearched = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search form
                searchForm

                // Results
                if isSearching {
                    LoadingView(message: "Searching campgrounds...")
                } else if hasSearched && campgrounds.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Results",
                        message: "Try adjusting your dates or search criteria."
                    )
                } else if !campgrounds.isEmpty {
                    campgroundList
                }

                Spacer()
            }
            .background(Color.campBackground)
            .navigationTitle("Find Campgrounds")
        }
    }

    private var searchForm: some View {
        VStack(spacing: 16) {
            // Search field
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.campTextHint)
                TextField("Search campgrounds...", text: $searchText)
            }
            .padding(12)
            .background(Color.campSurface)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.campBorder, lineWidth: 1)
            )

            // Date pickers
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Check In")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    DatePicker("", selection: $checkInDate, in: Date()..., displayedComponents: .date)
                        .labelsHidden()
                }
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.campSurface)
                .cornerRadius(8)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Check Out")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    DatePicker("", selection: $checkOutDate, in: checkInDate.addingTimeInterval(86400)..., displayedComponents: .date)
                        .labelsHidden()
                }
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(Color.campSurface)
                .cornerRadius(8)
            }

            // Guest count
            HStack {
                Text("Guests")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Spacer()

                Stepper("\(guestCount)", value: $guestCount, in: 1...20)
                    .labelsHidden()

                Text("\(guestCount)")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .frame(width: 24)
            }
            .padding(12)
            .background(Color.campSurface)
            .cornerRadius(8)

            // Search button
            PrimaryButton("Search", icon: "magnifyingglass", isLoading: isSearching) {
                Task { await performSearch() }
            }
        }
        .padding(16)
        .background(Color.campSurface)
    }

    private var campgroundList: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(campgrounds, id: \.id) { campground in
                    NavigationLink(destination: CampgroundDetailView(
                        campground: campground,
                        checkInDate: checkInDate,
                        checkOutDate: checkOutDate,
                        guestCount: guestCount
                    )) {
                        CampgroundSearchResultCard(campground: campground)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
    }

    private func performSearch() async {
        isSearching = true
        hasSearched = true

        do {
            // Call API to search campgrounds
            // campgrounds = try await apiClient.request(.getPublicCampgrounds)

            // For now, simulate
            try await Task.sleep(for: .seconds(1))
            campgrounds = []
        } catch {
            campgrounds = []
        }

        isSearching = false
    }
}

/// Campground card in search results
struct CampgroundSearchResultCard: View {

    let campground: Campground

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image placeholder
            Rectangle()
                .fill(Color.campPrimary.opacity(0.1))
                .frame(height: 160)
                .overlay(
                    Image(systemName: "photo")
                        .font(.system(size: 32))
                        .foregroundColor(.campPrimary.opacity(0.5))
                )

            VStack(alignment: .leading, spacing: 8) {
                Text(campground.name)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)

                if let city = campground.city, let state = campground.state {
                    Label("\(city), \(state)", systemImage: "location")
                        .font(.campBodySmall)
                        .foregroundColor(.campTextSecondary)
                }

                HStack {
                    // Rating
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.campWarning)
                        Text("4.5")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                        Text("(42)")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }

                    Spacer()

                    // Starting price
                    Text("From $45/night")
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                }
            }
            .padding(12)
        }
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}

/// Detailed campground view with site selection
struct CampgroundDetailView: View {

    let campground: Campground
    let checkInDate: Date
    let checkOutDate: Date
    let guestCount: Int

    @State private var availableSites: [Site] = []
    @State private var isLoading = true
    @State private var selectedSite: Site?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header image
                Rectangle()
                    .fill(Color.campPrimary.opacity(0.1))
                    .frame(height: 200)
                    .overlay(
                        Image(systemName: "tent.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.campPrimary)
                    )

                VStack(alignment: .leading, spacing: 16) {
                    // Title and location
                    VStack(alignment: .leading, spacing: 4) {
                        Text(campground.name)
                            .font(.campDisplaySmall)
                            .foregroundColor(.campTextPrimary)

                        if let city = campground.city, let state = campground.state {
                            Label("\(city), \(state)", systemImage: "location")
                                .font(.campBody)
                                .foregroundColor(.campTextSecondary)
                        }
                    }

                    Divider()

                    // Selected dates summary
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Check In")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text(formatDate(checkInDate))
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Check Out")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text(formatDate(checkOutDate))
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("Guests")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("\(guestCount)")
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                        }
                    }
                    .padding(16)
                    .background(Color.campSurface)
                    .cornerRadius(12)

                    // Available sites
                    Text("Available Sites")
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    if isLoading {
                        VStack(spacing: 12) {
                            SkeletonView().frame(height: 80)
                            SkeletonView().frame(height: 80)
                        }
                    } else if availableSites.isEmpty {
                        EmptyStateView(
                            icon: "calendar.badge.exclamationmark",
                            title: "No Availability",
                            message: "No sites available for the selected dates. Try different dates."
                        )
                    } else {
                        ForEach(availableSites, id: \.id) { site in
                            SiteCard(site: site, isSelected: selectedSite?.id == site.id) {
                                selectedSite = site
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Color.campBackground)
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if selectedSite != nil {
                VStack(spacing: 0) {
                    Divider()
                    NavigationLink(destination: BookingConfirmationView(
                        campground: campground,
                        site: selectedSite!,
                        checkInDate: checkInDate,
                        checkOutDate: checkOutDate,
                        guestCount: guestCount
                    )) {
                        HStack {
                            Text("Continue to Booking")
                                .font(.campButton)
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .foregroundColor(.white)
                        .padding(16)
                        .background(Color.campPrimary)
                    }
                }
                .background(Color.campSurface)
            }
        }
        .task {
            await loadAvailability()
        }
    }

    private func loadAvailability() async {
        isLoading = true
        defer { isLoading = false }

        // Call API to get available sites
        // availableSites = try await apiClient.request(...)

        // Simulate
        try? await Task.sleep(for: .seconds(1))
        availableSites = []
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }
}

/// Site card in availability list
struct SiteCard: View {

    let site: Site
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(site.name)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    Text(site.siteClassName ?? "Site")
                        .font(.campBodySmall)
                        .foregroundColor(.campTextSecondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(formatMoney(cents: site.basePriceCents))
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                    Text("/night")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .campPrimary : .campBorder)
                    .font(.system(size: 24))
            }
            .padding(16)
            .background(isSelected ? Color.campPrimary.opacity(0.05) : Color.campSurface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

/// Booking confirmation view
struct BookingConfirmationView: View {

    let campground: Campground
    let site: Site
    let checkInDate: Date
    let checkOutDate: Date
    let guestCount: Int

    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Summary card
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(campground.name)
                            .font(.campHeading2)
                            .foregroundColor(.campTextPrimary)

                        Text(site.name)
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        Divider()

                        HStack {
                            VStack(alignment: .leading) {
                                Text("Check In")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                                Text(formatDate(checkInDate))
                                    .font(.campLabel)
                            }

                            Spacer()

                            VStack(alignment: .trailing) {
                                Text("Check Out")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                                Text(formatDate(checkOutDate))
                                    .font(.campLabel)
                            }
                        }
                    }
                }

                // Price breakdown
                SectionCard(title: "Price Breakdown") {
                    VStack(spacing: 8) {
                        HStack {
                            Text("\(nightCount) nights x \(formatMoney(cents: site.basePriceCents))")
                                .foregroundColor(.campTextSecondary)
                            Spacer()
                            Text(formatMoney(cents: subtotal))
                        }

                        HStack {
                            Text("Taxes & Fees")
                                .foregroundColor(.campTextSecondary)
                            Spacer()
                            Text(formatMoney(cents: taxes))
                        }

                        Divider()

                        HStack {
                            Text("Total")
                                .font(.campLabel)
                            Spacer()
                            Text(formatMoney(cents: total))
                                .font(.campHeading3)
                                .foregroundColor(.campPrimary)
                        }
                    }
                    .font(.campBody)
                }

                if let error = error {
                    InlineError(message: error) {
                        self.error = nil
                    }
                }

                PrimaryButton(
                    "Confirm Booking",
                    icon: "checkmark.circle",
                    isLoading: isLoading
                ) {
                    Task { await confirmBooking() }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Confirm Booking")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var nightCount: Int {
        Calendar.current.dateComponents([.day], from: checkInDate, to: checkOutDate).day ?? 1
    }

    private var subtotal: Int {
        nightCount * site.basePriceCents
    }

    private var taxes: Int {
        Int(Double(subtotal) * 0.10)
    }

    private var total: Int {
        subtotal + taxes
    }

    private func confirmBooking() async {
        isLoading = true
        error = nil

        do {
            // Call API to create reservation
            try await Task.sleep(for: .seconds(1))

            // Navigate to success/confirmation
            dismiss()
        } catch {
            self.error = "Failed to create booking. Please try again."
        }

        isLoading = false
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d, yyyy"
        return formatter.string(from: date)
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}
