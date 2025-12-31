import SwiftUI
import CampreservCore
import CampreservUI

/// Main explore view for browsing campgrounds
struct ExploreView: View {

    @State private var searchText = ""
    @State private var featuredCampgrounds: [CampgroundPreview] = []
    @State private var nearbyCampgrounds: [CampgroundPreview] = []
    @State private var isLoading = true
    @State private var showFilters = false
    @State private var showSort = false

    // Filter state
    @State private var selectedSort: CampgroundSort = .recommended
    @State private var selectedFilters: Set<CampgroundFilter> = []
    @State private var priceRange: ClosedRange<Int> = 0...200
    @State private var minRating: Double = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Search bar
                    searchBar

                    // Filter & Sort bar
                    filterSortBar

                    // Active filters
                    if !selectedFilters.isEmpty || minRating > 0 {
                        activeFiltersView
                    }

                    if isLoading {
                        loadingState
                    } else {
                        // Featured section
                        featuredSection

                        // Nearby section
                        nearbySection

                        // Categories
                        categoriesSection
                    }
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Explore")
            .refreshable {
                await loadData()
            }
            .sheet(isPresented: $showFilters) {
                CampgroundFilterSheet(
                    selectedFilters: $selectedFilters,
                    priceRange: $priceRange,
                    minRating: $minRating
                )
            }
            .confirmationDialog("Sort By", isPresented: $showSort) {
                ForEach(CampgroundSort.allCases, id: \.self) { sort in
                    Button(sort.label) {
                        selectedSort = sort
                    }
                }
            }
        }
        .task {
            await loadData()
        }
    }

    private var filterSortBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Sort button
                Button {
                    showSort = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.arrow.down")
                        Text(selectedSort.label)
                    }
                    .font(.campCaption)
                    .foregroundColor(.campTextPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.campSurface)
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.campBorder, lineWidth: 1)
                    )
                }

                // Filter button
                Button {
                    showFilters = true
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "slider.horizontal.3")
                        Text("Filters")
                        if !selectedFilters.isEmpty {
                            Text("(\(selectedFilters.count))")
                                .foregroundColor(.campPrimary)
                        }
                    }
                    .font(.campCaption)
                    .foregroundColor(.campTextPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(selectedFilters.isEmpty ? Color.campSurface : Color.campPrimary.opacity(0.1))
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(selectedFilters.isEmpty ? Color.campBorder : Color.campPrimary, lineWidth: 1)
                    )
                }

                Divider()
                    .frame(height: 24)

                // Quick filter chips
                ForEach(CampgroundFilter.quickFilters, id: \.self) { filter in
                    FilterChipButton(
                        label: filter.label,
                        icon: filter.icon,
                        isSelected: selectedFilters.contains(filter)
                    ) {
                        if selectedFilters.contains(filter) {
                            selectedFilters.remove(filter)
                        } else {
                            selectedFilters.insert(filter)
                        }
                    }
                }
            }
        }
    }

    private var activeFiltersView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(selectedFilters), id: \.self) { filter in
                    HStack(spacing: 4) {
                        Image(systemName: filter.icon)
                            .font(.caption2)
                        Text(filter.label)
                            .font(.campCaption)
                        Button {
                            selectedFilters.remove(filter)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2)
                        }
                    }
                    .foregroundColor(.campPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.campPrimary.opacity(0.1))
                    .cornerRadius(16)
                }

                if minRating > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                        Text("\(String(format: "%.1f", minRating))+")
                            .font(.campCaption)
                        Button {
                            minRating = 0
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2)
                        }
                    }
                    .foregroundColor(.campPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.campPrimary.opacity(0.1))
                    .cornerRadius(16)
                }

                Button("Clear All") {
                    selectedFilters.removeAll()
                    minRating = 0
                }
                .font(.campCaption)
                .foregroundColor(.campTextSecondary)
            }
        }
    }

    // MARK: - Views

    private var searchBar: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.campTextSecondary)

            TextField("Search campgrounds...", text: $searchText)
                .font(.campBody)
        }
        .padding(12)
        .background(Color.campSurface)
        .cornerRadius(12)
    }

    private var loadingState: some View {
        VStack(spacing: 16) {
            ForEach(0..<3, id: \.self) { _ in
                SkeletonView()
                    .frame(height: 200)
                    .cornerRadius(12)
            }
        }
    }

    private var featuredSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Featured Campgrounds")
                .font(.campHeading2)
                .foregroundColor(.campTextPrimary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(featuredCampgrounds.isEmpty ? demoCampgrounds : featuredCampgrounds) { campground in
                        NavigationLink(destination: CampgroundPreviewDetailView(campground: campground)) {
                            CampgroundCard(campground: campground)
                                .frame(width: 280)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var nearbySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Nearby")
                    .font(.campHeading2)
                    .foregroundColor(.campTextPrimary)

                Spacer()

                NavigationLink("See All") {
                    AllCampgroundsView(campgrounds: nearbyCampgrounds.isEmpty ? demoCampgrounds : nearbyCampgrounds)
                }
                .font(.campLabel)
                .foregroundColor(.campPrimary)
            }

            let campgrounds = nearbyCampgrounds.isEmpty ? Array(demoCampgrounds.prefix(3)) : Array(nearbyCampgrounds.prefix(3))
            ForEach(campgrounds) { campground in
                NavigationLink(destination: CampgroundPreviewDetailView(campground: campground)) {
                    CampgroundListRow(campground: campground)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var categoriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Browse by Type")
                .font(.campHeading2)
                .foregroundColor(.campTextPrimary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                NavigationLink(destination: CategoryResultsView(category: "RV Parks", icon: "car")) {
                    CategoryCard(icon: "car", title: "RV Parks", color: .blue)
                }
                .buttonStyle(.plain)

                NavigationLink(destination: CategoryResultsView(category: "Tent Camping", icon: "tent")) {
                    CategoryCard(icon: "tent", title: "Tent Camping", color: .green)
                }
                .buttonStyle(.plain)

                NavigationLink(destination: CategoryResultsView(category: "Cabins", icon: "house")) {
                    CategoryCard(icon: "house", title: "Cabins", color: .orange)
                }
                .buttonStyle(.plain)

                NavigationLink(destination: CategoryResultsView(category: "Waterfront", icon: "water.waves")) {
                    CategoryCard(icon: "water.waves", title: "Waterfront", color: .cyan)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        // In a real app, fetch from API
        // For now, using demo data after a short delay
        try? await Task.sleep(for: .milliseconds(500))

        // Demo data is shown via the empty state handlers
    }

    // MARK: - Demo Data

    private var demoCampgrounds: [CampgroundPreview] {
        [
            CampgroundPreview(
                id: "1",
                name: "Pine Valley RV Resort",
                location: "Lake Tahoe, CA",
                imageUrl: nil,
                rating: 4.8,
                reviewCount: 324,
                pricePerNight: 4500,
                awards: [.topRated, .familyFavorite, .petFriendly]
            ),
            CampgroundPreview(
                id: "2",
                name: "Mountain View Campground",
                location: "Yosemite, CA",
                imageUrl: nil,
                rating: 4.6,
                reviewCount: 189,
                pricePerNight: 3500,
                awards: [.ecoFriendly, .bestValue]
            ),
            CampgroundPreview(
                id: "3",
                name: "Oceanside RV Park",
                location: "Santa Cruz, CA",
                imageUrl: nil,
                rating: 4.5,
                reviewCount: 256,
                pricePerNight: 5500,
                awards: [.waterfront, .superHost, .petFriendly]
            )
        ]
    }
}

// MARK: - All Campgrounds View

struct AllCampgroundsView: View {
    let campgrounds: [CampgroundPreview]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(campgrounds) { campground in
                    NavigationLink(destination: CampgroundPreviewDetailView(campground: campground)) {
                        CampgroundListRow(campground: campground)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("All Campgrounds")
    }
}

// MARK: - Category Results View

struct CategoryResultsView: View {
    let category: String
    let icon: String
    @State private var isLoading = true
    @State private var campgrounds: [CampgroundPreview] = []

    var body: some View {
        Group {
            if isLoading {
                VStack {
                    Spacer()
                    ProgressView("Finding \(category)...")
                    Spacer()
                }
            } else if campgrounds.isEmpty {
                VStack(spacing: 16) {
                    Spacer()
                    Image(systemName: icon)
                        .font(.system(size: 48))
                        .foregroundColor(.campTextSecondary)
                    Text("No \(category) found nearby")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    Spacer()
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(campgrounds) { campground in
                            NavigationLink(destination: CampgroundPreviewDetailView(campground: campground)) {
                                CampgroundListRow(campground: campground)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .background(Color.campBackground)
        .navigationTitle(category)
        .task {
            await loadCampgrounds()
        }
    }

    private func loadCampgrounds() async {
        isLoading = true
        try? await Task.sleep(for: .milliseconds(600))

        // Demo data based on category
        campgrounds = [
            CampgroundPreview(
                id: "cat1",
                name: "\(category) Paradise",
                location: "Near You",
                imageUrl: nil,
                rating: 4.7,
                reviewCount: 89,
                pricePerNight: 4500,
                awards: [.topRated, .petFriendly]
            ),
            CampgroundPreview(
                id: "cat2",
                name: "Scenic \(category)",
                location: "Mountain View, CA",
                imageUrl: nil,
                rating: 4.5,
                reviewCount: 156,
                pricePerNight: 5500,
                awards: [.familyFavorite, .newListing]
            ),
        ]
        isLoading = false
    }
}

// MARK: - Supporting Types

struct CampgroundPreview: Identifiable {
    let id: String
    let name: String
    let location: String
    let imageUrl: String?
    let rating: Double
    let reviewCount: Int
    let pricePerNight: Int // cents
    var awards: [CampgroundAward] = []
}

struct CampgroundAward: Identifiable {
    let id: String
    let name: String
    let icon: String
    let color: Color

    static let topRated = CampgroundAward(id: "top-rated", name: "Top Rated", icon: "star.fill", color: .yellow)
    static let familyFavorite = CampgroundAward(id: "family", name: "Family Favorite", icon: "figure.2.and.child.holdinghands", color: .blue)
    static let petFriendly = CampgroundAward(id: "pets", name: "Pet Friendly", icon: "pawprint.fill", color: .orange)
    static let waterfront = CampgroundAward(id: "waterfront", name: "Waterfront", icon: "water.waves", color: .cyan)
    static let bestValue = CampgroundAward(id: "value", name: "Best Value", icon: "tag.fill", color: .green)
    static let superHost = CampgroundAward(id: "superhost", name: "Super Host", icon: "medal.fill", color: .purple)
    static let ecoFriendly = CampgroundAward(id: "eco", name: "Eco Friendly", icon: "leaf.fill", color: .green)
    static let newListing = CampgroundAward(id: "new", name: "New", icon: "sparkles", color: .pink)
}

// MARK: - Campground Card

struct CampgroundCard: View {

    let campground: CampgroundPreview

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image placeholder with awards overlay
            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.campPrimary.opacity(0.3), .campPrimary.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 140)
                    .overlay(
                        Image(systemName: "tent.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.campPrimary.opacity(0.5))
                    )

                // Award badges
                if !campground.awards.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(campground.awards.prefix(3)) { award in
                            AwardBadge(award: award)
                        }
                    }
                    .padding(8)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(campground.name)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(1)

                Text(campground.location)
                    .font(.campBodySmall)
                    .foregroundColor(.campTextSecondary)

                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.caption)
                        Text(String(format: "%.1f", campground.rating))
                            .font(.campLabel)
                        Text("(\(campground.reviewCount))")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }

                    Spacer()

                    Text("From \(formatPrice(campground.pricePerNight))/night")
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

    private func formatPrice(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

struct AwardBadge: View {
    let award: CampgroundAward
    var compact: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: award.icon)
                .font(.caption2)
                .foregroundColor(award.color)

            if !compact {
                Text(award.name)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.campTextPrimary)
            }
        }
        .padding(.horizontal, compact ? 6 : 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}

// MARK: - Campground List Row

struct CampgroundListRow: View {

    let campground: CampgroundPreview

    var body: some View {
        HStack(spacing: 12) {
            // Image placeholder with award overlay
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.campPrimary.opacity(0.1))
                    .frame(width: 80, height: 80)
                    .overlay(
                        Image(systemName: "tent.fill")
                            .font(.title2)
                            .foregroundColor(.campPrimary.opacity(0.5))
                    )

                // Show first award as compact badge
                if let firstAward = campground.awards.first {
                    Image(systemName: firstAward.icon)
                        .font(.caption2)
                        .foregroundColor(.white)
                        .padding(4)
                        .background(firstAward.color)
                        .cornerRadius(4)
                        .offset(x: 4, y: 4)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(campground.name)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(1)

                Text(campground.location)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)

                HStack(spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.caption2)
                        Text(String(format: "%.1f", campground.rating))
                            .font(.campCaption)
                    }

                    // Show award icons
                    if !campground.awards.isEmpty {
                        HStack(spacing: 2) {
                            ForEach(campground.awards.prefix(3)) { award in
                                Image(systemName: award.icon)
                                    .font(.caption2)
                                    .foregroundColor(award.color)
                            }
                        }
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing) {
                Text(formatPrice(campground.pricePerNight))
                    .font(.campLabel)
                    .foregroundColor(.campPrimary)
                Text("/night")
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .padding(12)
        .background(Color.campSurface)
        .cornerRadius(12)
    }

    private func formatPrice(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

// MARK: - Category Card

struct CategoryCard: View {

    let icon: String
    let title: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)

            Text(title)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

// MARK: - Campground Preview Detail View

struct CampgroundPreviewDetailView: View {

    let campground: CampgroundPreview
    @State private var checkInDate = Date().addingTimeInterval(86400) // Tomorrow
    @State private var checkOutDate = Date().addingTimeInterval(86400 * 4) // 3 nights
    @State private var guestCount = 2
    @State private var isLoadingSiteClasses = false
    @State private var availableSiteClasses: [DemoSiteClass] = []
    @State private var selectedSiteClass: DemoSiteClass?

    // Site class filters
    @State private var siteClassSort: SiteClassSort = .recommended
    @State private var showSiteClassSort = false
    @State private var showSiteFilters = false
    @State private var selectedSiteTypes: Set<SiteTypeFilter> = []
    @State private var selectedAmenities: Set<SiteAmenityFilter> = []
    @State private var minSiteLength: Int = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Hero image
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.campPrimary.opacity(0.4), .campPrimary.opacity(0.1)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 240)
                    .overlay(
                        Image(systemName: "tent.fill")
                            .font(.system(size: 64))
                            .foregroundColor(.white.opacity(0.6))
                    )

                VStack(alignment: .leading, spacing: 20) {
                    // Title and rating
                    VStack(alignment: .leading, spacing: 8) {
                        Text(campground.name)
                            .font(.campDisplaySmall)
                            .foregroundColor(.campTextPrimary)

                        HStack(spacing: 16) {
                            Label(campground.location, systemImage: "location")
                                .font(.campBody)
                                .foregroundColor(.campTextSecondary)

                            HStack(spacing: 4) {
                                Image(systemName: "star.fill")
                                    .foregroundColor(.yellow)
                                Text(String(format: "%.1f", campground.rating))
                                    .fontWeight(.medium)
                                Text("(\(campground.reviewCount) reviews)")
                                    .foregroundColor(.campTextSecondary)
                            }
                            .font(.campBody)
                        }
                    }

                    Divider()

                    // Date & Guest Selection
                    VStack(spacing: 12) {
                        // Date pickers
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Check In")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
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
                                    .foregroundColor(.campTextSecondary)
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
                            Spacer()
                            Stepper("\(guestCount)", value: $guestCount, in: 1...10)
                        }
                        .padding(12)
                        .background(Color.campSurface)
                        .cornerRadius(8)
                    }
                    .onChange(of: checkInDate) { _ in
                        Task { await loadSiteClasses() }
                    }
                    .onChange(of: checkOutDate) { _ in
                        Task { await loadSiteClasses() }
                    }

                    // Available Site Classes
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Select Site Type")
                                .font(.campHeading3)
                                .foregroundColor(.campTextPrimary)

                            Spacer()

                            Text("\(nightCount) nights")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }

                        // Site class sort & filter bar
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                // Sort button
                                Button {
                                    showSiteClassSort = true
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: "arrow.up.arrow.down")
                                        Text(siteClassSort.label)
                                    }
                                    .font(.campCaption)
                                    .foregroundColor(.campTextPrimary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.campSurface)
                                    .cornerRadius(16)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(Color.campBorder, lineWidth: 1)
                                    )
                                }

                                // Filter button
                                Button {
                                    showSiteFilters = true
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: "slider.horizontal.3")
                                        Text("Filters")
                                        if activeFilterCount > 0 {
                                            Text("(\(activeFilterCount))")
                                                .foregroundColor(.campPrimary)
                                        }
                                    }
                                    .font(.campCaption)
                                    .foregroundColor(.campTextPrimary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(activeFilterCount > 0 ? Color.campPrimary.opacity(0.1) : Color.campSurface)
                                    .cornerRadius(16)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(activeFilterCount > 0 ? Color.campPrimary : Color.campBorder, lineWidth: 1)
                                    )
                                }

                                Divider()
                                    .frame(height: 20)

                                // Site type quick filters
                                ForEach(SiteTypeFilter.allCases, id: \.self) { type in
                                    SiteTypeChip(
                                        type: type,
                                        isSelected: selectedSiteTypes.contains(type)
                                    ) {
                                        if selectedSiteTypes.contains(type) {
                                            selectedSiteTypes.remove(type)
                                        } else {
                                            selectedSiteTypes.insert(type)
                                        }
                                    }
                                }

                                // Quick amenity chips
                                ForEach(SiteAmenityFilter.quickFilters, id: \.self) { amenity in
                                    Button {
                                        if selectedAmenities.contains(amenity) {
                                            selectedAmenities.remove(amenity)
                                        } else {
                                            selectedAmenities.insert(amenity)
                                        }
                                    } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: amenity.icon)
                                                .font(.caption2)
                                            Text(amenity.label)
                                        }
                                        .font(.campCaption)
                                        .foregroundColor(selectedAmenities.contains(amenity) ? .white : .campTextPrimary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(selectedAmenities.contains(amenity) ? Color.campPrimary : Color.campSurface)
                                        .cornerRadius(16)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 16)
                                                .stroke(selectedAmenities.contains(amenity) ? Color.campPrimary : Color.campBorder, lineWidth: 1)
                                        )
                                    }
                                }
                            }
                        }

                        // Active filters summary
                        if activeFilterCount > 0 {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(Array(selectedAmenities), id: \.self) { amenity in
                                        HStack(spacing: 4) {
                                            Image(systemName: amenity.icon)
                                                .font(.caption2)
                                            Text(amenity.label)
                                                .font(.caption)
                                            Button {
                                                selectedAmenities.remove(amenity)
                                            } label: {
                                                Image(systemName: "xmark")
                                                    .font(.caption2)
                                            }
                                        }
                                        .foregroundColor(.campPrimary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.campPrimary.opacity(0.1))
                                        .cornerRadius(12)
                                    }

                                    if minSiteLength > 0 {
                                        HStack(spacing: 4) {
                                            Image(systemName: "ruler")
                                                .font(.caption2)
                                            Text("\(minSiteLength)ft+")
                                                .font(.caption)
                                            Button {
                                                minSiteLength = 0
                                            } label: {
                                                Image(systemName: "xmark")
                                                    .font(.caption2)
                                            }
                                        }
                                        .foregroundColor(.campPrimary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.campPrimary.opacity(0.1))
                                        .cornerRadius(12)
                                    }

                                    Button("Clear") {
                                        selectedSiteTypes.removeAll()
                                        selectedAmenities.removeAll()
                                        minSiteLength = 0
                                    }
                                    .font(.caption)
                                    .foregroundColor(.campTextSecondary)
                                }
                            }
                        }

                        if isLoadingSiteClasses {
                            HStack {
                                Spacer()
                                ProgressView()
                                Spacer()
                            }
                            .padding(.vertical, 32)
                        } else if filteredSiteClasses.isEmpty {
                            VStack(spacing: 8) {
                                Text("No sites match your filters")
                                    .font(.campBody)
                                    .foregroundColor(.campTextSecondary)
                                if !selectedSiteTypes.isEmpty {
                                    Button("Clear Filters") {
                                        selectedSiteTypes.removeAll()
                                    }
                                    .font(.campCaption)
                                    .foregroundColor(.campPrimary)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 32)
                        } else {
                            ForEach(filteredSiteClasses) { siteClass in
                                SiteClassCard(
                                    siteClass: siteClass,
                                    nights: nightCount,
                                    isSelected: selectedSiteClass?.id == siteClass.id
                                ) {
                                    selectedSiteClass = siteClass
                                }
                            }
                        }
                    }

                    // Amenities
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Amenities")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            AmenityRow(icon: "wifi", title: "Free WiFi")
                            AmenityRow(icon: "bolt", title: "Electric Hookups")
                            AmenityRow(icon: "drop", title: "Water Hookups")
                            AmenityRow(icon: "shower", title: "Showers")
                            AmenityRow(icon: "cart", title: "Camp Store")
                            AmenityRow(icon: "flame", title: "Fire Pits")
                        }
                    }

                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("About")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        Text("Experience the great outdoors at \(campground.name). Located in beautiful \(campground.location), this campground offers stunning views and modern amenities for the perfect camping experience.")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                            .lineSpacing(4)
                    }
                }
                .padding(16)
            }
        }
        .background(Color.campBackground)
        .navigationTitle(campground.name)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if let siteClass = selectedSiteClass {
                VStack(spacing: 0) {
                    Divider()
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(siteClass.name)
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                            Text("\(nightCount) nights")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 2) {
                            Text(formatPrice(siteClass.pricePerNight * nightCount))
                                .font(.campHeading3)
                                .foregroundColor(.campPrimary)
                            Text("total")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }

                        NavigationLink(destination: CheckoutView(
                            campground: campground,
                            siteClass: siteClass,
                            checkInDate: checkInDate,
                            checkOutDate: checkOutDate,
                            guestCount: guestCount
                        )) {
                            Text("Book Now")
                                .font(.campButton)
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                                .background(Color.campPrimary)
                                .cornerRadius(8)
                        }
                    }
                    .padding(16)
                    .background(Color.campSurface)
                }
            }
        }
        .task {
            await loadSiteClasses()
        }
        .confirmationDialog("Sort Sites By", isPresented: $showSiteClassSort) {
            ForEach(SiteClassSort.allCases, id: \.self) { sort in
                Button(sort.label) {
                    siteClassSort = sort
                }
            }
        }
        .sheet(isPresented: $showSiteFilters) {
            SiteAmenityFilterSheet(
                selectedAmenities: $selectedAmenities,
                minSiteLength: $minSiteLength
            )
        }
    }

    private var nightCount: Int {
        max(1, Calendar.current.dateComponents([.day], from: checkInDate, to: checkOutDate).day ?? 1)
    }

    private var activeFilterCount: Int {
        selectedSiteTypes.count + selectedAmenities.count + (minSiteLength > 0 ? 1 : 0)
    }

    private var filteredSiteClasses: [DemoSiteClass] {
        var classes = availableSiteClasses

        // Filter by site type
        if !selectedSiteTypes.isEmpty {
            classes = classes.filter { siteClass in
                let name = siteClass.name.lowercased()
                return selectedSiteTypes.contains { type in
                    switch type {
                    case .rv: return name.contains("rv") || name.contains("hookup")
                    case .tent: return name.contains("tent")
                    case .cabin: return name.contains("cabin")
                    }
                }
            }
        }

        // Sort
        switch siteClassSort {
        case .recommended:
            break // Keep original order
        case .priceLow:
            classes.sort { $0.pricePerNight < $1.pricePerNight }
        case .priceHigh:
            classes.sort { $0.pricePerNight > $1.pricePerNight }
        case .availability:
            classes.sort { $0.availableCount > $1.availableCount }
        }

        return classes
    }

    private func loadSiteClasses() async {
        isLoadingSiteClasses = true
        try? await Task.sleep(for: .milliseconds(500))

        availableSiteClasses = [
            DemoSiteClass(
                id: "1",
                name: "Premium Full Hookup",
                description: "50 amp, water, sewer, WiFi",
                pricePerNight: campground.pricePerNight + 2000,
                availableCount: 3,
                maxGuests: 8,
                imageColor: .blue
            ),
            DemoSiteClass(
                id: "2",
                name: "Standard RV",
                description: "30 amp, water hookup",
                pricePerNight: campground.pricePerNight,
                availableCount: 7,
                maxGuests: 6,
                imageColor: .green
            ),
            DemoSiteClass(
                id: "3",
                name: "Basic RV",
                description: "Electric only, no water",
                pricePerNight: campground.pricePerNight - 1500,
                availableCount: 12,
                maxGuests: 6,
                imageColor: .orange
            ),
            DemoSiteClass(
                id: "4",
                name: "Tent Site",
                description: "Flat ground, fire pit, picnic table",
                pricePerNight: campground.pricePerNight - 2500,
                availableCount: 5,
                maxGuests: 4,
                imageColor: .purple
            ),
            DemoSiteClass(
                id: "5",
                name: "Cabin",
                description: "Sleeps 4, A/C, kitchenette",
                pricePerNight: campground.pricePerNight + 5000,
                availableCount: 2,
                maxGuests: 4,
                imageColor: .brown
            ),
        ]

        isLoadingSiteClasses = false
    }

    private func formatPrice(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

struct AmenityRow: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(.campPrimary)
                .frame(width: 24)

            Text(title)
                .font(.campBodySmall)
                .foregroundColor(.campTextPrimary)

            Spacer()
        }
        .padding(10)
        .background(Color.campSurface)
        .cornerRadius(8)
    }
}

// MARK: - Checkout View

struct CheckoutView: View {
    let campground: CampgroundPreview
    let siteClass: DemoSiteClass
    let checkInDate: Date
    let checkOutDate: Date
    let guestCount: Int

    @Environment(\.dismiss) private var dismiss
    @State private var isProcessing = false
    @State private var showPaymentSheet = false
    @State private var paymentAdded = false
    @State private var cardLastFour = ""
    @State private var navigateToSuccess = false

    // Guest details
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""

    private var canConfirm: Bool {
        !firstName.isEmpty && !lastName.isEmpty && !email.isEmpty && paymentAdded
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Reservation summary
                VStack(alignment: .leading, spacing: 16) {
                    Text("Reservation Summary")
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    VStack(spacing: 12) {
                        SummaryRow(label: "Campground", value: campground.name)
                        SummaryRow(label: "Site Type", value: siteClass.name)
                        SummaryRow(label: "Check In", value: formatDate(checkInDate))
                        SummaryRow(label: "Check Out", value: formatDate(checkOutDate))
                        SummaryRow(label: "Guests", value: "\(guestCount)")
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)

                // Guest details
                VStack(alignment: .leading, spacing: 16) {
                    Text("Guest Details")
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("First Name *")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                                TextField("John", text: $firstName)
                                    .textContentType(.givenName)
                                    .padding(12)
                                    .background(Color.campBackground)
                                    .cornerRadius(8)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Last Name *")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                                TextField("Smith", text: $lastName)
                                    .textContentType(.familyName)
                                    .padding(12)
                                    .background(Color.campBackground)
                                    .cornerRadius(8)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email *")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                            TextField("john@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .padding(12)
                                .background(Color.campBackground)
                                .cornerRadius(8)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Phone")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                            TextField("(555) 123-4567", text: $phone)
                                .textContentType(.telephoneNumber)
                                .keyboardType(.phonePad)
                                .padding(12)
                                .background(Color.campBackground)
                                .cornerRadius(8)
                        }
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)

                // Price breakdown
                VStack(alignment: .leading, spacing: 16) {
                    Text("Price Details")
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    VStack(spacing: 12) {
                        HStack {
                            Text("\(nightCount) nights x \(formatPrice(siteClass.pricePerNight))")
                                .foregroundColor(.campTextSecondary)
                            Spacer()
                            Text(formatPrice(subtotal))
                        }
                        .font(.campBody)

                        HStack {
                            Text("Taxes & Fees")
                                .foregroundColor(.campTextSecondary)
                            Spacer()
                            Text(formatPrice(taxes))
                        }
                        .font(.campBody)

                        Divider()

                        HStack {
                            Text("Total")
                                .font(.campHeading3)
                            Spacer()
                            Text(formatPrice(total))
                                .font(.campHeading2)
                                .foregroundColor(.campPrimary)
                        }
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)

                // Payment
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Payment *")
                            .font(.campHeading2)
                            .foregroundColor(.campTextPrimary)

                        if !paymentAdded {
                            Text("Required")
                                .font(.campCaption)
                                .foregroundColor(.campError)
                        }
                    }

                    Button {
                        showPaymentSheet = true
                    } label: {
                        HStack {
                            Image(systemName: paymentAdded ? "checkmark.circle.fill" : "creditcard.fill")
                                .foregroundColor(paymentAdded ? .campSuccess : .campPrimary)

                            if paymentAdded {
                                Text("Visa ending in \(cardLastFour)")
                                    .foregroundColor(.campTextPrimary)
                            } else {
                                Text("Add payment method")
                                    .foregroundColor(.campTextSecondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .foregroundColor(.campTextSecondary)
                        }
                        .padding(16)
                        .background(Color.campSurface)
                        .cornerRadius(8)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(paymentAdded ? Color.campSuccess : Color.campBorder, lineWidth: 1)
                        )
                    }
                }

                // Confirm button
                VStack(spacing: 8) {
                    PrimaryButton(
                        "Confirm Booking",
                        icon: "checkmark.circle",
                        isLoading: isProcessing
                    ) {
                        Task { await confirmBooking() }
                    }
                    .disabled(!canConfirm)
                    .opacity(canConfirm ? 1 : 0.5)

                    if !canConfirm {
                        Text("Please fill in all required fields")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }
                }
                .padding(.top, 8)
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Checkout")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPaymentSheet) {
            AddPaymentSheet(
                onAdd: { lastFour in
                    cardLastFour = lastFour
                    paymentAdded = true
                }
            )
        }
        .navigationDestination(isPresented: $navigateToSuccess) {
            BookingSuccessView(
                campground: campground,
                siteClass: siteClass,
                checkInDate: checkInDate,
                checkOutDate: checkOutDate,
                guestName: "\(firstName) \(lastName)",
                email: email
            )
        }
    }

    private var nightCount: Int {
        max(1, Calendar.current.dateComponents([.day], from: checkInDate, to: checkOutDate).day ?? 1)
    }

    private var subtotal: Int {
        nightCount * siteClass.pricePerNight
    }

    private var taxes: Int {
        Int(Double(subtotal) * 0.10)
    }

    private var total: Int {
        subtotal + taxes
    }

    private func confirmBooking() async {
        isProcessing = true
        try? await Task.sleep(for: .seconds(1.5))
        isProcessing = false
        navigateToSuccess = true
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d, yyyy"
        return formatter.string(from: date)
    }

    private func formatPrice(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

struct SummaryRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.campBody)
                .foregroundColor(.campTextSecondary)
            Spacer()
            Text(value)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
        }
    }
}

// MARK: - Booking Success View

struct BookingSuccessView: View {

    let campground: CampgroundPreview
    let siteClass: DemoSiteClass
    let checkInDate: Date
    let checkOutDate: Date
    let guestName: String
    let email: String

    @Environment(\.dismiss) private var dismiss
    @State private var showCreateAccount = false

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                // Success animation
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.campSuccess)

                    Text("Booking Confirmed!")
                        .font(.campDisplaySmall)
                        .foregroundColor(.campTextPrimary)

                    Text("Confirmation #CRV-\(String(format: "%06d", Int.random(in: 100000...999999)))")
                        .font(.campLabel)
                        .foregroundColor(.campTextSecondary)
                }
                .padding(.top, 32)

                // Reservation details card
                VStack(alignment: .leading, spacing: 16) {
                    Text(campground.name)
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    VStack(spacing: 12) {
                        SummaryRow(label: "Site Type", value: siteClass.name)
                        SummaryRow(label: "Guest", value: guestName)
                        SummaryRow(label: "Check In", value: formatDate(checkInDate))
                        SummaryRow(label: "Check Out", value: formatDate(checkOutDate))
                    }

                    Divider()

                    HStack {
                        Image(systemName: "envelope.fill")
                            .foregroundColor(.campPrimary)
                        Text("Confirmation sent to \(email)")
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)

                // Create account prompt
                VStack(spacing: 16) {
                    VStack(spacing: 8) {
                        Image(systemName: "person.badge.plus")
                            .font(.system(size: 32))
                            .foregroundColor(.campPrimary)

                        Text("Create an Account")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        Text("Save your info for faster bookings, view your reservations anytime, and get exclusive offers.")
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                            .multilineTextAlignment(.center)
                    }

                    PrimaryButton("Create Account") {
                        showCreateAccount = true
                    }

                    Button("Maybe Later") {
                        dismissToRoot()
                    }
                    .font(.campLabel)
                    .foregroundColor(.campTextSecondary)
                }
                .padding(20)
                .background(Color.campPrimary.opacity(0.05))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.campPrimary.opacity(0.2), lineWidth: 1)
                )

                // What's next section
                VStack(alignment: .leading, spacing: 12) {
                    Text("What's Next")
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    NextStepRow(
                        icon: "envelope.badge",
                        title: "Check your email",
                        description: "We sent your confirmation with all the details"
                    )

                    NextStepRow(
                        icon: "calendar.badge.clock",
                        title: "Add to calendar",
                        description: "Don't forget your check-in on \(formatShortDate(checkInDate))"
                    )

                    NextStepRow(
                        icon: "map",
                        title: "Plan your trip",
                        description: "View directions and campground info"
                    )
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Confirmed")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done") {
                    dismissToRoot()
                }
                .font(.campLabel)
                .foregroundColor(.campPrimary)
            }
        }
        .sheet(isPresented: $showCreateAccount) {
            CreateAccountSheet(email: email, name: guestName) {
                dismissToRoot()
            }
        }
    }

    private func dismissToRoot() {
        // Navigate back to root
        dismiss()
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d, yyyy"
        return formatter.string(from: date)
    }

    private func formatShortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

struct NextStepRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.campPrimary)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                Text(description)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }

            Spacer()
        }
        .padding(12)
        .background(Color.campBackground)
        .cornerRadius(8)
    }
}

// MARK: - Create Account Sheet

struct CreateAccountSheet: View {

    let email: String
    let name: String
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var agreedToTerms = false
    @State private var isCreating = false
    @State private var error: String?
    @State private var showSuccess = false

    private var nameParts: (first: String, last: String) {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return (String(parts[0]), String(parts.dropFirst().joined(separator: " ")))
        }
        return (name, "")
    }

    private var isValid: Bool {
        password.count >= 8 && password == confirmPassword && agreedToTerms
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.system(size: 48))
                            .foregroundColor(.campPrimary)

                        Text("Create Your Account")
                            .font(.campHeading2)
                            .foregroundColor(.campTextPrimary)

                        Text("Use your account to manage reservations, save payment methods, and book faster.")
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 16)

                    // Pre-filled info
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Your Info")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        HStack {
                            Image(systemName: "person.fill")
                                .foregroundColor(.campTextSecondary)
                            Text(name)
                                .foregroundColor(.campTextPrimary)
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.campSuccess)
                        }
                        .padding(12)
                        .background(Color.campSurface)
                        .cornerRadius(8)

                        HStack {
                            Image(systemName: "envelope.fill")
                                .foregroundColor(.campTextSecondary)
                            Text(email)
                                .foregroundColor(.campTextPrimary)
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.campSuccess)
                        }
                        .padding(12)
                        .background(Color.campSurface)
                        .cornerRadius(8)
                    }

                    // Password fields
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Create Password")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        VStack(alignment: .leading, spacing: 4) {
                            SecureField("Password (8+ characters)", text: $password)
                                .textContentType(.newPassword)
                                .padding(12)
                                .background(Color.campSurface)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.campBorder, lineWidth: 1)
                                )

                            if !password.isEmpty && password.count < 8 {
                                Text("Password must be at least 8 characters")
                                    .font(.campCaption)
                                    .foregroundColor(.campError)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            SecureField("Confirm Password", text: $confirmPassword)
                                .textContentType(.newPassword)
                                .padding(12)
                                .background(Color.campSurface)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(
                                            !confirmPassword.isEmpty && password != confirmPassword
                                                ? Color.campError
                                                : Color.campBorder,
                                            lineWidth: 1
                                        )
                                )

                            if !confirmPassword.isEmpty && password != confirmPassword {
                                Text("Passwords don't match")
                                    .font(.campCaption)
                                    .foregroundColor(.campError)
                            }
                        }
                    }

                    // Terms agreement
                    Button {
                        agreedToTerms.toggle()
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: agreedToTerms ? "checkmark.square.fill" : "square")
                                .foregroundColor(agreedToTerms ? .campPrimary : .campBorder)
                                .font(.title3)

                            Text("I agree to the Terms of Service and Privacy Policy")
                                .font(.campBodySmall)
                                .foregroundColor(.campTextSecondary)
                                .multilineTextAlignment(.leading)

                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)

                    if let error = error {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.campError)
                            Text(error)
                                .font(.campBodySmall)
                                .foregroundColor(.campError)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(Color.campError.opacity(0.1))
                        .cornerRadius(8)
                    }

                    PrimaryButton(
                        "Create Account",
                        icon: "person.badge.plus",
                        isLoading: isCreating
                    ) {
                        Task { await createAccount() }
                    }
                    .disabled(!isValid)
                    .opacity(isValid ? 1 : 0.5)
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") {
                        dismiss()
                        onComplete()
                    }
                }
            }
            .alert("Account Created!", isPresented: $showSuccess) {
                Button("Continue") {
                    dismiss()
                    onComplete()
                }
            } message: {
                Text("Your account has been created. You can now view your reservations in the Trips tab.")
            }
        }
    }

    private func createAccount() async {
        isCreating = true
        error = nil

        // Simulate account creation
        try? await Task.sleep(for: .seconds(1.5))

        isCreating = false
        showSuccess = true
    }
}

// MARK: - Site Availability Sheet

struct SiteAvailabilitySheet: View {

    let campground: CampgroundPreview
    let checkInDate: Date
    let checkOutDate: Date
    let guestCount: Int

    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var availableSites: [DemoSite] = []
    @State private var selectedSite: DemoSite?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header summary
                VStack(spacing: 8) {
                    Text(campground.name)
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    HStack(spacing: 16) {
                        Label(formatDate(checkInDate), systemImage: "arrow.right.circle")
                        Label(formatDate(checkOutDate), systemImage: "arrow.left.circle")
                        Label("\(guestCount) guests", systemImage: "person.2")
                    }
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
                }
                .padding(16)
                .frame(maxWidth: .infinity)
                .background(Color.campSurface)

                Divider()

                // Sites list
                if isLoading {
                    Spacer()
                    ProgressView("Finding available sites...")
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(availableSites) { site in
                                DemoSiteCard(
                                    site: site,
                                    nights: nightCount,
                                    isSelected: selectedSite?.id == site.id
                                ) {
                                    selectedSite = site
                                }
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .background(Color.campBackground)
            .navigationTitle("Available Sites")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let site = selectedSite {
                    VStack(spacing: 0) {
                        Divider()
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(site.name)
                                    .font(.campLabel)
                                Text("\(nightCount) nights")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 2) {
                                Text(formatMoney(site.pricePerNight * nightCount))
                                    .font(.campHeading3)
                                    .foregroundColor(.campPrimary)
                                Text("total")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                            }

                            PrimaryButton("Book Now") {
                                // Would navigate to checkout
                                dismiss()
                            }
                        }
                        .padding(16)
                        .background(Color.campSurface)
                    }
                }
            }
        }
        .task {
            await loadSites()
        }
    }

    private var nightCount: Int {
        max(1, Calendar.current.dateComponents([.day], from: checkInDate, to: checkOutDate).day ?? 1)
    }

    private func loadSites() async {
        isLoading = true
        try? await Task.sleep(for: .milliseconds(800))

        // Demo sites
        availableSites = [
            DemoSite(id: "1", name: "Site A1 - Premium", type: "Full Hookup RV", pricePerNight: campground.pricePerNight + 1000),
            DemoSite(id: "2", name: "Site A2 - Premium", type: "Full Hookup RV", pricePerNight: campground.pricePerNight + 1000),
            DemoSite(id: "3", name: "Site B5 - Standard", type: "Electric Only", pricePerNight: campground.pricePerNight),
            DemoSite(id: "4", name: "Site B6 - Standard", type: "Electric Only", pricePerNight: campground.pricePerNight),
            DemoSite(id: "5", name: "Site T1 - Tent", type: "Tent Site", pricePerNight: campground.pricePerNight - 1500),
        ]

        isLoading = false
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func formatMoney(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

// MARK: - Site Class Models & Views

struct DemoSiteClass: Identifiable {
    let id: String
    let name: String
    let description: String
    let pricePerNight: Int
    let availableCount: Int
    let maxGuests: Int
    let imageColor: Color // Placeholder until real images
}

struct SiteClassCard: View {

    let siteClass: DemoSiteClass
    let nights: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                // Site class image (placeholder)
                ZStack(alignment: .topTrailing) {
                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [siteClass.imageColor.opacity(0.6), siteClass.imageColor.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(height: 120)
                        .overlay(
                            Image(systemName: iconForSiteClass)
                                .font(.system(size: 36))
                                .foregroundColor(.white.opacity(0.8))
                        )

                    // Availability badge
                    Text("\(siteClass.availableCount) available")
                        .font(.campCaption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(siteClass.availableCount <= 3 ? Color.campWarning : Color.campSuccess)
                        .cornerRadius(12)
                        .padding(8)
                }

                // Details
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(siteClass.name)
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        Text(siteClass.description)
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                            .lineLimit(2)

                        HStack(spacing: 12) {
                            Label("Up to \(siteClass.maxGuests)", systemImage: "person.2")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text(formatMoney(siteClass.pricePerNight))
                            .font(.campHeading2)
                            .foregroundColor(.campPrimary)
                        Text("/night")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)

                        Spacer()

                        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .foregroundColor(isSelected ? .campPrimary : .campBorder)
                    }
                }
                .padding(12)
            }
            .background(isSelected ? Color.campPrimary.opacity(0.05) : Color.campSurface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var iconForSiteClass: String {
        let name = siteClass.name.lowercased()
        if name.contains("cabin") { return "house.fill" }
        if name.contains("tent") { return "tent.fill" }
        if name.contains("premium") { return "star.fill" }
        return "car.fill"
    }

    private func formatMoney(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

// MARK: - Legacy Site Models (for reference)

struct DemoSite: Identifiable {
    let id: String
    let name: String
    let type: String
    let pricePerNight: Int
}

struct DemoSiteCard: View {

    let site: DemoSite
    let nights: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(site.name)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    Text(site.type)
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(formatMoney(site.pricePerNight))
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                    Text("/night")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundColor(isSelected ? .campPrimary : .campBorder)
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

    private func formatMoney(_ cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.0f", dollars)
    }
}

// MARK: - Add Payment Sheet

struct AddPaymentSheet: View {

    let onAdd: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var cardNumber = ""
    @State private var expiryDate = ""
    @State private var cvv = ""
    @State private var cardholderName = ""
    @State private var isProcessing = false
    @State private var error: String?

    private var isValid: Bool {
        cardNumber.count >= 16 && expiryDate.count >= 4 && cvv.count >= 3 && !cardholderName.isEmpty
    }

    private var lastFour: String {
        String(cardNumber.suffix(4))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Card preview
                    VStack(spacing: 16) {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                LinearGradient(
                                    colors: [.campPrimary, .campPrimary.opacity(0.7)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(height: 180)
                            .overlay(
                                VStack(alignment: .leading, spacing: 24) {
                                    HStack {
                                        Image(systemName: "creditcard.fill")
                                            .font(.title2)
                                        Spacer()
                                        Image(systemName: "wave.3.right")
                                            .font(.title3)
                                    }

                                    Text(formatCardNumber(cardNumber))
                                        .font(.system(.title2, design: .monospaced))
                                        .tracking(2)

                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text("CARDHOLDER")
                                                .font(.caption2)
                                                .opacity(0.7)
                                            Text(cardholderName.isEmpty ? "YOUR NAME" : cardholderName.uppercased())
                                                .font(.caption)
                                        }

                                        Spacer()

                                        VStack(alignment: .trailing) {
                                            Text("EXPIRES")
                                                .font(.caption2)
                                                .opacity(0.7)
                                            Text(expiryDate.isEmpty ? "MM/YY" : formatExpiry(expiryDate))
                                                .font(.caption)
                                        }
                                    }
                                }
                                .foregroundColor(.white)
                                .padding(20)
                            )
                    }

                    // Card form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Card Number")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                            TextField("4242 4242 4242 4242", text: $cardNumber)
                                .keyboardType(.numberPad)
                                .textContentType(.creditCardNumber)
                                .onChange(of: cardNumber) { _ in
                                    cardNumber = String(cardNumber.filter { $0.isNumber }.prefix(16))
                                }
                                .padding(12)
                                .background(Color.campSurface)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.campBorder, lineWidth: 1)
                                )
                        }

                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Expiry Date")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                                TextField("MM/YY", text: $expiryDate)
                                    .keyboardType(.numberPad)
                                    .onChange(of: expiryDate) { _ in
                                        expiryDate = String(expiryDate.filter { $0.isNumber }.prefix(4))
                                    }
                                    .padding(12)
                                    .background(Color.campSurface)
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.campBorder, lineWidth: 1)
                                    )
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("CVV")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                                SecureField("123", text: $cvv)
                                    .keyboardType(.numberPad)
                                    .onChange(of: cvv) { _ in
                                        cvv = String(cvv.filter { $0.isNumber }.prefix(4))
                                    }
                                    .padding(12)
                                    .background(Color.campSurface)
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.campBorder, lineWidth: 1)
                                    )
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Cardholder Name")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                            TextField("John Smith", text: $cardholderName)
                                .textContentType(.name)
                                .autocapitalization(.words)
                                .padding(12)
                                .background(Color.campSurface)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.campBorder, lineWidth: 1)
                                )
                        }
                    }

                    if let error = error {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.campError)
                            Text(error)
                                .font(.campBodySmall)
                                .foregroundColor(.campError)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(Color.campError.opacity(0.1))
                        .cornerRadius(8)
                    }

                    // Security note
                    HStack(spacing: 8) {
                        Image(systemName: "lock.fill")
                            .foregroundColor(.campSuccess)
                        Text("Your payment info is encrypted and secure")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }
                    .padding(.top, 8)

                    PrimaryButton(
                        "Add Card",
                        icon: "creditcard",
                        isLoading: isProcessing
                    ) {
                        Task { await addCard() }
                    }
                    .disabled(!isValid)
                    .opacity(isValid ? 1 : 0.5)
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Add Payment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func addCard() async {
        isProcessing = true
        error = nil

        // Simulate card validation
        try? await Task.sleep(for: .seconds(1))

        // Simple validation
        if !cardNumber.hasPrefix("4") && !cardNumber.hasPrefix("5") {
            error = "Please enter a valid Visa or Mastercard"
            isProcessing = false
            return
        }

        isProcessing = false
        onAdd(lastFour)
        dismiss()
    }

    private func formatCardNumber(_ number: String) -> String {
        let clean = number.filter { $0.isNumber }
        var formatted = ""
        for (index, char) in clean.enumerated() {
            if index > 0 && index % 4 == 0 {
                formatted += " "
            }
            formatted.append(char)
        }
        return formatted.isEmpty ? "---- ---- ---- ----" : formatted
    }

    private func formatExpiry(_ expiry: String) -> String {
        let clean = expiry.filter { $0.isNumber }
        if clean.count >= 2 {
            let month = String(clean.prefix(2))
            let year = String(clean.dropFirst(2))
            return "\(month)/\(year)"
        }
        return clean
    }
}

// MARK: - Filter & Sort Types

enum CampgroundSort: String, CaseIterable {
    case recommended
    case priceLow
    case priceHigh
    case rating
    case distance
    case reviews

    var label: String {
        switch self {
        case .recommended: return "Recommended"
        case .priceLow: return "Price: Low to High"
        case .priceHigh: return "Price: High to Low"
        case .rating: return "Highest Rated"
        case .distance: return "Nearest"
        case .reviews: return "Most Reviews"
        }
    }
}

enum CampgroundFilter: String, CaseIterable, Hashable {
    case petFriendly
    case wifi
    case pool
    case waterfront
    case fullHookup
    case tent
    case cabin
    case rv
    case familyFriendly
    case adultOnly
    case accessible
    case instantBook

    var label: String {
        switch self {
        case .petFriendly: return "Pet Friendly"
        case .wifi: return "WiFi"
        case .pool: return "Pool"
        case .waterfront: return "Waterfront"
        case .fullHookup: return "Full Hookup"
        case .tent: return "Tent Sites"
        case .cabin: return "Cabins"
        case .rv: return "RV Sites"
        case .familyFriendly: return "Family Friendly"
        case .adultOnly: return "Adults Only"
        case .accessible: return "Accessible"
        case .instantBook: return "Instant Book"
        }
    }

    var icon: String {
        switch self {
        case .petFriendly: return "pawprint.fill"
        case .wifi: return "wifi"
        case .pool: return "figure.pool.swim"
        case .waterfront: return "water.waves"
        case .fullHookup: return "powerplug.fill"
        case .tent: return "tent.fill"
        case .cabin: return "house.fill"
        case .rv: return "car.fill"
        case .familyFriendly: return "figure.2.and.child.holdinghands"
        case .adultOnly: return "person.2.fill"
        case .accessible: return "figure.roll"
        case .instantBook: return "bolt.fill"
        }
    }

    static var quickFilters: [CampgroundFilter] {
        [.petFriendly, .wifi, .pool, .waterfront, .instantBook]
    }

    static var siteTypes: [CampgroundFilter] {
        [.rv, .tent, .cabin, .fullHookup]
    }

    static var amenities: [CampgroundFilter] {
        [.wifi, .pool, .waterfront, .accessible]
    }
}

struct FilterChipButton: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption2)
                Text(label)
            }
            .font(.campCaption)
            .foregroundColor(isSelected ? .white : .campTextPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.campPrimary : Color.campSurface)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: 1)
            )
        }
    }
}

// MARK: - Campground Filter Sheet

struct CampgroundFilterSheet: View {

    @Binding var selectedFilters: Set<CampgroundFilter>
    @Binding var priceRange: ClosedRange<Int>
    @Binding var minRating: Double

    @Environment(\.dismiss) private var dismiss
    @State private var tempFilters: Set<CampgroundFilter> = []
    @State private var tempMinPrice: Double = 0
    @State private var tempMaxPrice: Double = 200
    @State private var tempRating: Double = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Price Range
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Price Range")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        VStack(spacing: 8) {
                            HStack {
                                Text("$\(Int(tempMinPrice))")
                                    .font(.campLabel)
                                Spacer()
                                Text("$\(Int(tempMaxPrice))+")
                                    .font(.campLabel)
                            }
                            .foregroundColor(.campTextSecondary)

                            // Price slider (simplified - two separate sliders)
                            VStack(spacing: 4) {
                                HStack {
                                    Text("Min")
                                        .font(.campCaption)
                                        .foregroundColor(.campTextSecondary)
                                    Slider(value: $tempMinPrice, in: 0...200, step: 10)
                                        .tint(.campPrimary)
                                }
                                HStack {
                                    Text("Max")
                                        .font(.campCaption)
                                        .foregroundColor(.campTextSecondary)
                                    Slider(value: $tempMaxPrice, in: 0...300, step: 10)
                                        .tint(.campPrimary)
                                }
                            }
                        }
                        .padding(16)
                        .background(Color.campSurface)
                        .cornerRadius(12)
                    }

                    // Minimum Rating
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Minimum Rating")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        HStack(spacing: 8) {
                            ForEach([0, 3.0, 3.5, 4.0, 4.5], id: \.self) { rating in
                                Button {
                                    tempRating = rating
                                } label: {
                                    HStack(spacing: 2) {
                                        if rating > 0 {
                                            Image(systemName: "star.fill")
                                                .font(.caption)
                                                .foregroundColor(.yellow)
                                            Text(String(format: "%.1f", rating))
                                        } else {
                                            Text("Any")
                                        }
                                    }
                                    .font(.campCaption)
                                    .foregroundColor(tempRating == rating ? .white : .campTextPrimary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(tempRating == rating ? Color.campPrimary : Color.campSurface)
                                    .cornerRadius(20)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(tempRating == rating ? Color.campPrimary : Color.campBorder, lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }

                    // Site Types
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Site Type")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(CampgroundFilter.siteTypes, id: \.self) { filter in
                                FilterChipButton(
                                    label: filter.label,
                                    icon: filter.icon,
                                    isSelected: tempFilters.contains(filter)
                                ) {
                                    toggleFilter(filter)
                                }
                            }
                        }
                    }

                    // Amenities
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Amenities")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(CampgroundFilter.amenities, id: \.self) { filter in
                                FilterChipButton(
                                    label: filter.label,
                                    icon: filter.icon,
                                    isSelected: tempFilters.contains(filter)
                                ) {
                                    toggleFilter(filter)
                                }
                            }
                        }
                    }

                    // Other Filters
                    VStack(alignment: .leading, spacing: 12) {
                        Text("More Options")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach([CampgroundFilter.petFriendly, .familyFriendly, .instantBook, .accessible], id: \.self) { filter in
                                FilterChipButton(
                                    label: filter.label,
                                    icon: filter.icon,
                                    isSelected: tempFilters.contains(filter)
                                ) {
                                    toggleFilter(filter)
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        tempFilters.removeAll()
                        tempMinPrice = 0
                        tempMaxPrice = 200
                        tempRating = 0
                    }
                    .foregroundColor(.campTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        selectedFilters = tempFilters
                        priceRange = Int(tempMinPrice)...Int(tempMaxPrice)
                        minRating = tempRating
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 0) {
                    Divider()
                    HStack {
                        VStack(alignment: .leading) {
                            Text("\(tempFilters.count) filters selected")
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                        }
                        Spacer()
                        PrimaryButton("Show Results") {
                            selectedFilters = tempFilters
                            priceRange = Int(tempMinPrice)...Int(tempMaxPrice)
                            minRating = tempRating
                            dismiss()
                        }
                        .frame(width: 140)
                    }
                    .padding(16)
                    .background(Color.campSurface)
                }
            }
        }
        .onAppear {
            tempFilters = selectedFilters
            tempMinPrice = Double(priceRange.lowerBound)
            tempMaxPrice = Double(priceRange.upperBound)
            tempRating = minRating
        }
    }

    private func toggleFilter(_ filter: CampgroundFilter) {
        if tempFilters.contains(filter) {
            tempFilters.remove(filter)
        } else {
            tempFilters.insert(filter)
        }
    }
}

// MARK: - Flow Layout for Filter Chips

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrangeSubviews(proposal: proposal, subviews: subviews)
        for (index, frame) in result.frames.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY), proposal: .unspecified)
        }
    }

    private func arrangeSubviews(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        let maxWidth = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var frames: [CGRect] = []

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            frames.append(CGRect(x: currentX, y: currentY, width: size.width, height: size.height))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: currentY + lineHeight), frames)
    }
}

// MARK: - Site Class Sort & Filter

enum SiteClassSort: String, CaseIterable {
    case recommended
    case priceLow
    case priceHigh
    case availability

    var label: String {
        switch self {
        case .recommended: return "Recommended"
        case .priceLow: return "Price: Low to High"
        case .priceHigh: return "Price: High to Low"
        case .availability: return "Most Available"
        }
    }
}

enum SiteTypeFilter: String, CaseIterable, Hashable {
    case rv
    case tent
    case cabin

    var label: String {
        switch self {
        case .rv: return "RV"
        case .tent: return "Tent"
        case .cabin: return "Cabin"
        }
    }

    var icon: String {
        switch self {
        case .rv: return "car.fill"
        case .tent: return "tent.fill"
        case .cabin: return "house.fill"
        }
    }
}

struct SiteTypeChip: View {
    let type: SiteTypeFilter
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: type.icon)
                    .font(.caption2)
                Text(type.label)
            }
            .font(.campCaption)
            .foregroundColor(isSelected ? .white : .campTextPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(isSelected ? Color.campPrimary : Color.campSurface)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: 1)
            )
        }
    }
}

// MARK: - Site Amenity Filters

enum SiteAmenityFilter: String, CaseIterable, Hashable {
    // Electric
    case amp50
    case amp30
    case amp20

    // Hookups
    case water
    case sewer
    case fullHookup

    // Connectivity
    case wifi
    case cableTV

    // Site Features
    case pullThrough
    case backIn
    case shaded
    case waterfront
    case paved
    case firePit
    case picnicTable

    // Accessibility
    case accessible

    var label: String {
        switch self {
        case .amp50: return "50 Amp"
        case .amp30: return "30 Amp"
        case .amp20: return "20 Amp"
        case .water: return "Water"
        case .sewer: return "Sewer"
        case .fullHookup: return "Full Hookup"
        case .wifi: return "WiFi"
        case .cableTV: return "Cable TV"
        case .pullThrough: return "Pull-Through"
        case .backIn: return "Back-In"
        case .shaded: return "Shaded"
        case .waterfront: return "Waterfront"
        case .paved: return "Paved"
        case .firePit: return "Fire Pit"
        case .picnicTable: return "Picnic Table"
        case .accessible: return "Accessible"
        }
    }

    var icon: String {
        switch self {
        case .amp50, .amp30, .amp20: return "bolt.fill"
        case .water: return "drop.fill"
        case .sewer: return "arrow.down.to.line"
        case .fullHookup: return "powerplug.fill"
        case .wifi: return "wifi"
        case .cableTV: return "tv.fill"
        case .pullThrough: return "arrow.left.and.right"
        case .backIn: return "arrow.backward"
        case .shaded: return "tree.fill"
        case .waterfront: return "water.waves"
        case .paved: return "road.lanes"
        case .firePit: return "flame.fill"
        case .picnicTable: return "table.furniture.fill"
        case .accessible: return "figure.roll"
        }
    }

    static var quickFilters: [SiteAmenityFilter] {
        [.amp50, .fullHookup, .pullThrough]
    }

    static var electricOptions: [SiteAmenityFilter] {
        [.amp50, .amp30, .amp20]
    }

    static var hookupOptions: [SiteAmenityFilter] {
        [.water, .sewer, .fullHookup]
    }

    static var siteFeatures: [SiteAmenityFilter] {
        [.pullThrough, .backIn, .shaded, .waterfront, .paved, .firePit, .picnicTable]
    }

    static var otherOptions: [SiteAmenityFilter] {
        [.wifi, .cableTV, .accessible]
    }
}

// MARK: - Site Amenity Filter Sheet

struct SiteAmenityFilterSheet: View {

    @Binding var selectedAmenities: Set<SiteAmenityFilter>
    @Binding var minSiteLength: Int

    @Environment(\.dismiss) private var dismiss
    @State private var tempAmenities: Set<SiteAmenityFilter> = []
    @State private var tempLength: Double = 0

    private let lengthOptions = [0, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Site Length
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Minimum Site Length")
                                .font(.campHeading3)
                                .foregroundColor(.campTextPrimary)
                            Spacer()
                            if tempLength > 0 {
                                Text("\(Int(tempLength)) ft")
                                    .font(.campLabel)
                                    .foregroundColor(.campPrimary)
                            } else {
                                Text("Any")
                                    .font(.campLabel)
                                    .foregroundColor(.campTextSecondary)
                            }
                        }

                        Slider(value: $tempLength, in: 0...70, step: 5)
                            .tint(.campPrimary)

                        // Length presets
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach([0, 30, 40, 50, 60], id: \.self) { length in
                                    Button {
                                        tempLength = Double(length)
                                    } label: {
                                        Text(length == 0 ? "Any" : "\(length)ft+")
                                            .font(.campCaption)
                                            .foregroundColor(Int(tempLength) == length ? .white : .campTextPrimary)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 8)
                                            .background(Int(tempLength) == length ? Color.campPrimary : Color.campSurface)
                                            .cornerRadius(16)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 16)
                                                    .stroke(Int(tempLength) == length ? Color.campPrimary : Color.campBorder, lineWidth: 1)
                                            )
                                    }
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.campSurface)
                    .cornerRadius(12)

                    // Electric
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Electric Service")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(SiteAmenityFilter.electricOptions, id: \.self) { amenity in
                                AmenityFilterChip(
                                    amenity: amenity,
                                    isSelected: tempAmenities.contains(amenity)
                                ) {
                                    toggleAmenity(amenity)
                                }
                            }
                        }
                    }

                    // Hookups
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Hookups")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(SiteAmenityFilter.hookupOptions, id: \.self) { amenity in
                                AmenityFilterChip(
                                    amenity: amenity,
                                    isSelected: tempAmenities.contains(amenity)
                                ) {
                                    toggleAmenity(amenity)
                                }
                            }
                        }
                    }

                    // Site Features
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Site Features")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(SiteAmenityFilter.siteFeatures, id: \.self) { amenity in
                                AmenityFilterChip(
                                    amenity: amenity,
                                    isSelected: tempAmenities.contains(amenity)
                                ) {
                                    toggleAmenity(amenity)
                                }
                            }
                        }
                    }

                    // Other
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Other Amenities")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        FlowLayout(spacing: 8) {
                            ForEach(SiteAmenityFilter.otherOptions, id: \.self) { amenity in
                                AmenityFilterChip(
                                    amenity: amenity,
                                    isSelected: tempAmenities.contains(amenity)
                                ) {
                                    toggleAmenity(amenity)
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Site Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Reset") {
                        tempAmenities.removeAll()
                        tempLength = 0
                    }
                    .foregroundColor(.campTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        selectedAmenities = tempAmenities
                        minSiteLength = Int(tempLength)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 0) {
                    Divider()
                    HStack {
                        VStack(alignment: .leading) {
                            Text("\(tempAmenities.count) amenities selected")
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                            if tempLength > 0 {
                                Text("Min length: \(Int(tempLength))ft")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextSecondary)
                            }
                        }
                        Spacer()
                        PrimaryButton("Show Sites") {
                            selectedAmenities = tempAmenities
                            minSiteLength = Int(tempLength)
                            dismiss()
                        }
                        .frame(width: 120)
                    }
                    .padding(16)
                    .background(Color.campSurface)
                }
            }
        }
        .onAppear {
            tempAmenities = selectedAmenities
            tempLength = Double(minSiteLength)
        }
    }

    private func toggleAmenity(_ amenity: SiteAmenityFilter) {
        if tempAmenities.contains(amenity) {
            tempAmenities.remove(amenity)
        } else {
            tempAmenities.insert(amenity)
        }
    }
}

struct AmenityFilterChip: View {
    let amenity: SiteAmenityFilter
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: amenity.icon)
                    .font(.caption)
                Text(amenity.label)
            }
            .font(.campCaption)
            .foregroundColor(isSelected ? .white : .campTextPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.campPrimary : Color.campSurface)
            .cornerRadius(20)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: 1)
            )
        }
    }
}

#Preview {
    ExploreView()
}
