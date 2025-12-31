import SwiftUI
import CampreservCore
import CampreservUI

// MARK: - Trip Detail View (Guest Portal)

/// Full guest portal experience for a reservation
struct TripDetailView: View {

    let trip: DemoTrip

    @State private var showCheckIn = false
    @State private var showCheckOut = false
    @State private var showMessages = false
    @State private var showPayment = false
    @State private var showReview = false
    @State private var showCampgroundRules = false
    @State private var showDirections = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Hero section
                heroSection

                VStack(spacing: 24) {
                    // Status card with countdown
                    statusCard

                    // Quick actions
                    quickActions

                    // Your site section
                    yourSiteSection

                    // Campground info
                    campgroundInfoSection

                    // Things to do nearby
                    thingsToDoSection

                    // Payment section
                    paymentSection

                    // Messages section
                    messagesSection

                    // Leave review (for past stays)
                    if trip.status == .checkedOut {
                        reviewSection
                    }

                    // Confirmation details
                    confirmationSection
                }
                .padding(16)
            }
        }
        .background(Color.campBackground)
        .ignoresSafeArea(edges: .top)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCheckIn) {
            DemoCheckInView(trip: trip)
        }
        .sheet(isPresented: $showCheckOut) {
            DemoCheckOutView(trip: trip)
        }
        .sheet(isPresented: $showMessages) {
            MessagesView(trip: trip)
        }
        .sheet(isPresented: $showPayment) {
            PaymentSheet(trip: trip)
        }
        .sheet(isPresented: $showReview) {
            LeaveReviewSheet(trip: trip)
        }
        .sheet(isPresented: $showCampgroundRules) {
            CampgroundRulesSheet(trip: trip)
        }
        .sheet(isPresented: $showDirections) {
            DirectionsSheet(trip: trip)
        }
    }

    // MARK: - Hero Section

    private var heroSection: some View {
        ZStack(alignment: .bottomLeading) {
            // Hero image
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [trip.imageColor.opacity(0.9), trip.imageColor.opacity(0.5)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(height: 280)
                .overlay(
                    Image(systemName: "tent.2.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.white.opacity(0.2))
                )

            // Gradient overlay
            LinearGradient(
                colors: [.clear, .black.opacity(0.7)],
                startPoint: .center,
                endPoint: .bottom
            )

            // Content
            VStack(alignment: .leading, spacing: 8) {
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

                Text(trip.campgroundName)
                    .font(.campDisplaySmall)
                    .foregroundColor(.white)

                HStack {
                    Image(systemName: "location.fill")
                    Text(trip.campgroundLocation)
                }
                .font(.campBody)
                .foregroundColor(.white.opacity(0.9))
            }
            .padding(20)
            .padding(.top, 60) // Safe area
        }
    }

    // MARK: - Status Card

    private var statusCard: some View {
        VStack(spacing: 16) {
            // Countdown or status message
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(statusTitle)
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(statusMessage)
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)
                }

                Spacer()

                // Countdown circle for upcoming
                if trip.status == .confirmed || trip.status == .checkedIn {
                    ZStack {
                        Circle()
                            .stroke(Color.campPrimary.opacity(0.2), lineWidth: 4)
                        Circle()
                            .trim(from: 0, to: countdownProgress)
                            .stroke(Color.campPrimary, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        Text("\(daysCount)")
                            .font(.campHeading2)
                            .foregroundColor(.campPrimary)
                    }
                    .frame(width: 60, height: 60)
                }
            }

            Divider()

            // Dates row
            HStack(spacing: 0) {
                VStack(spacing: 4) {
                    Text("Check In")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(formatDate(trip.startDate))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                    Text("3:00 PM")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
                .frame(maxWidth: .infinity)

                // Arrow
                Image(systemName: "arrow.right")
                    .foregroundColor(.campTextHint)

                VStack(spacing: 4) {
                    Text("Check Out")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(formatDate(trip.endDate))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                    Text("11:00 AM")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
                .frame(maxWidth: .infinity)

                VStack(spacing: 4) {
                    Text("Duration")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text("\(trip.nightCount)")
                        .font(.campHeading3)
                        .foregroundColor(.campPrimary)
                    Text("nights")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(Color.campSurface)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }

    private var statusTitle: String {
        switch trip.status {
        case .confirmed:
            return "Your trip begins"
        case .checkedIn:
            return "Currently staying"
        case .checkedOut:
            return "Trip completed"
        case .cancelled:
            return "Reservation"
        }
    }

    private var statusMessage: String {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDay = calendar.startOfDay(for: trip.startDate)
        let endDay = calendar.startOfDay(for: trip.endDate)

        switch trip.status {
        case .confirmed:
            let days = calendar.dateComponents([.day], from: today, to: startDay).day ?? 0
            if days == 0 { return "Today!" }
            if days == 1 { return "Tomorrow" }
            return "In \(days) days"
        case .checkedIn:
            let days = calendar.dateComponents([.day], from: today, to: endDay).day ?? 0
            if days == 0 { return "Checkout today" }
            if days == 1 { return "1 day remaining" }
            return "\(days) days remaining"
        case .checkedOut:
            return formatDate(trip.endDate)
        case .cancelled:
            return "Cancelled"
        }
    }

    private var daysCount: Int {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        if trip.status == .confirmed {
            return calendar.dateComponents([.day], from: today, to: trip.startDate).day ?? 0
        } else if trip.status == .checkedIn {
            return calendar.dateComponents([.day], from: today, to: trip.endDate).day ?? 0
        }
        return 0
    }

    private var countdownProgress: CGFloat {
        if trip.status == .confirmed {
            let total = 30.0 // Assume booked 30 days out
            let remaining = Double(daysCount)
            return min(1.0, 1.0 - (remaining / total))
        } else if trip.status == .checkedIn {
            let remaining = Double(daysCount)
            let total = Double(trip.nightCount)
            return 1.0 - (remaining / total)
        }
        return 1.0
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                // Primary action based on status
                if trip.status == .confirmed && canCheckIn {
                    TripQuickActionButton(
                        icon: "arrow.down.circle.fill",
                        label: "Check In",
                        color: .campSuccess,
                        isPrimary: true
                    ) {
                        showCheckIn = true
                    }
                } else if trip.status == .checkedIn {
                    TripQuickActionButton(
                        icon: "arrow.up.circle.fill",
                        label: "Check Out",
                        color: .campPrimary,
                        isPrimary: true
                    ) {
                        showCheckOut = true
                    }
                }

                // Directions
                TripQuickActionButton(
                    icon: "map.fill",
                    label: "Directions",
                    color: .blue
                ) {
                    showDirections = true
                }

                // Message
                TripQuickActionButton(
                    icon: "message.fill",
                    label: "Message",
                    color: .campPrimary,
                    badge: trip.hasUnreadMessages ? "1" : nil
                ) {
                    showMessages = true
                }

                // Rules
                TripQuickActionButton(
                    icon: "doc.text.fill",
                    label: "Rules",
                    color: .orange
                ) {
                    showCampgroundRules = true
                }

                // Call (if checked in)
                if trip.status == .checkedIn {
                    TripQuickActionButton(
                        icon: "phone.fill",
                        label: "Call",
                        color: .green
                    ) {
                        // Would open phone
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private var canCheckIn: Bool {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let startDay = calendar.startOfDay(for: trip.startDate)
        return today >= startDay
    }

    // MARK: - Your Site Section

    private var yourSiteSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Your Site")
                .font(.campHeading3)
                .foregroundColor(.campTextPrimary)

            VStack(spacing: 0) {
                // Site image placeholder
                Rectangle()
                    .fill(trip.imageColor.opacity(0.3))
                    .frame(height: 140)
                    .overlay(
                        VStack {
                            Image(systemName: "tent.fill")
                                .font(.system(size: 32))
                                .foregroundColor(trip.imageColor.opacity(0.5))
                            Text(trip.siteName)
                                .font(.campHeading3)
                                .foregroundColor(trip.imageColor)
                        }
                    )

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(trip.siteName)
                                .font(.campHeading3)
                                .foregroundColor(.campTextPrimary)
                            Text(trip.siteType)
                                .font(.campBodySmall)
                                .foregroundColor(.campTextSecondary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("\(trip.guestCount)")
                                .font(.campHeading3)
                                .foregroundColor(.campPrimary)
                            Text("guests")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                        }
                    }

                    Divider()

                    // Amenities
                    Text("Site Amenities")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    FlowLayoutLocal(spacing: 8) {
                        ForEach(trip.amenities, id: \.self) { amenity in
                            HStack(spacing: 4) {
                                Image(systemName: amenityIcon(for: amenity))
                                Text(amenity)
                            }
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.campBackground)
                            .cornerRadius(16)
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.campSurface)
            .cornerRadius(12)
        }
    }

    private func amenityIcon(for amenity: String) -> String {
        switch amenity.lowercased() {
        case let a where a.contains("50 amp"): return "bolt.fill"
        case let a where a.contains("30 amp"): return "bolt.fill"
        case let a where a.contains("hookup"): return "water.waves"
        case let a where a.contains("wifi"): return "wifi"
        case let a where a.contains("pull"): return "arrow.left.and.right"
        case let a where a.contains("water"): return "drop.fill"
        case let a where a.contains("sewer"): return "arrow.down.to.line"
        case let a where a.contains("shade"): return "leaf.fill"
        case let a where a.contains("fire"): return "flame.fill"
        case let a where a.contains("picnic"): return "table.furniture.fill"
        default: return "checkmark"
        }
    }

    // MARK: - Campground Info Section

    private var campgroundInfoSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Campground Info")
                .font(.campHeading3)
                .foregroundColor(.campTextPrimary)

            VStack(spacing: 0) {
                // Map placeholder
                Rectangle()
                    .fill(Color.campBackground)
                    .frame(height: 140)
                    .overlay(
                        VStack(spacing: 8) {
                            Image(systemName: "map.fill")
                                .font(.system(size: 32))
                                .foregroundColor(.campTextHint)
                            Text("Tap for directions")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }
                    )
                    .onTapGesture {
                        showDirections = true
                    }

                VStack(spacing: 12) {
                    // Address
                    HStack(alignment: .top) {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundColor(.campPrimary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Address")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("123 Campground Road")
                                .font(.campBody)
                                .foregroundColor(.campTextPrimary)
                            Text(trip.campgroundLocation)
                                .font(.campBodySmall)
                                .foregroundColor(.campTextSecondary)
                        }
                        Spacer()
                    }

                    Divider()

                    // Check-in times
                    HStack {
                        Image(systemName: "clock.fill")
                            .foregroundColor(.campPrimary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Check-in")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("3:00 PM - 9:00 PM")
                                .font(.campBody)
                                .foregroundColor(.campTextPrimary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Checkout")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("by 11:00 AM")
                                .font(.campBody)
                                .foregroundColor(.campTextPrimary)
                        }
                    }

                    Divider()

                    // Contact
                    HStack {
                        Image(systemName: "phone.fill")
                            .foregroundColor(.campPrimary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Front Desk")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Text("(555) 123-4567")
                                .font(.campBody)
                                .foregroundColor(.campTextPrimary)
                        }
                        Spacer()
                        Button(action: {}) {
                            Text("Call")
                                .font(.campLabel)
                                .foregroundColor(.campPrimary)
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.campSurface)
            .cornerRadius(12)
        }
    }

    // MARK: - Things To Do Section

    private var thingsToDoSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Things To Do Nearby")
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
                Spacer()
                Button(action: {}) {
                    Text("See All")
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ThingToDoCard(
                        name: "Hiking Trails",
                        distance: "0.5 mi",
                        icon: "figure.hiking",
                        color: .green
                    )
                    ThingToDoCard(
                        name: "Lake Beach",
                        distance: "1.2 mi",
                        icon: "water.waves",
                        color: .blue
                    )
                    ThingToDoCard(
                        name: "Visitor Center",
                        distance: "2.0 mi",
                        icon: "building.2.fill",
                        color: .orange
                    )
                    ThingToDoCard(
                        name: "General Store",
                        distance: "0.3 mi",
                        icon: "cart.fill",
                        color: .purple
                    )
                }
            }
        }
    }

    // MARK: - Payment Section

    private var paymentSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Payment")
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
                Spacer()
                if !trip.isPaid {
                    Button(action: { showPayment = true }) {
                        Text("Pay Now")
                            .font(.campLabel)
                            .foregroundColor(.campPrimary)
                    }
                }
            }

            VStack(spacing: 12) {
                HStack {
                    Text("Total")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    Spacer()
                    Text(formatMoney(cents: trip.totalCents))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                }

                HStack {
                    Text("Paid")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    Spacer()
                    Text(formatMoney(cents: trip.paidCents))
                        .font(.campLabel)
                        .foregroundColor(.campSuccess)
                }

                if !trip.isPaid {
                    Divider()
                    HStack {
                        Text("Balance Due")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                        Spacer()
                        Text(formatMoney(cents: trip.balanceCents))
                            .font(.campHeading3)
                            .foregroundColor(.campError)
                    }
                }
            }
            .padding(16)
            .background(Color.campSurface)
            .cornerRadius(12)
        }
    }

    // MARK: - Messages Section

    private var messagesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Messages")
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
                Spacer()
                if trip.hasUnreadMessages {
                    Text("1 new")
                        .font(.campCaption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.campPrimary)
                        .cornerRadius(12)
                }
            }

            Button(action: { showMessages = true }) {
                HStack(spacing: 12) {
                    // Avatar
                    Circle()
                        .fill(Color.campPrimary.opacity(0.2))
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: "person.fill")
                                .foregroundColor(.campPrimary)
                        )

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Campground Host")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                        Text(trip.hasUnreadMessages ? "Thanks for booking! Let us know if..." : "Start a conversation")
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundColor(.campTextHint)
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Review Section

    private var reviewSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("How was your stay?")
                .font(.campHeading3)
                .foregroundColor(.campTextPrimary)

            Button(action: { showReview = true }) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Leave a Review")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                        Text("Share your experience with other campers")
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                    }

                    Spacer()

                    HStack(spacing: 4) {
                        ForEach(1...5, id: \.self) { _ in
                            Image(systemName: "star")
                                .foregroundColor(.campWarning)
                        }
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Confirmation Section

    private var confirmationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reservation Details")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            VStack(spacing: 8) {
                DetailRow(label: "Confirmation #", value: trip.confirmationNumber)
                DetailRow(label: "Booked on", value: "Dec 15, 2024")
                DetailRow(label: "Guests", value: "\(trip.guestCount) guests")
            }
            .padding(16)
            .background(Color.campSurface)
            .cornerRadius(12)

            // Help link
            Button(action: {}) {
                HStack {
                    Image(systemName: "questionmark.circle")
                    Text("Need help with your reservation?")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.campBody)
                .foregroundColor(.campTextSecondary)
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

// MARK: - Trip Quick Action Button

struct TripQuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    var isPrimary: Bool = false
    var badge: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: icon)
                        .font(.system(size: 24))
                        .foregroundColor(isPrimary ? .white : color)
                        .frame(width: 56, height: 56)
                        .background(isPrimary ? color : color.opacity(0.15))
                        .cornerRadius(16)

                    if let badge = badge {
                        Text(badge)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 18, height: 18)
                            .background(Color.campError)
                            .clipShape(Circle())
                            .offset(x: 4, y: -4)
                    }
                }

                Text(label)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Thing To Do Card

struct ThingToDoCard: View {
    let name: String
    let distance: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(color)
                .frame(width: 60, height: 60)
                .background(color.opacity(0.15))
                .cornerRadius(12)

            Text(name)
                .font(.campCaption)
                .foregroundColor(.campTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text(distance)
                .font(.system(size: 11))
                .foregroundColor(.campTextHint)
        }
        .frame(width: 90)
    }
}

// MARK: - Flow Layout (Local copy to avoid conflicts)

struct FlowLayoutLocal: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalHeight = currentY + lineHeight
        }

        return (CGSize(width: maxWidth, height: totalHeight), positions)
    }
}

// MARK: - Supporting Sheets

/// Demo check-in flow using DemoTrip
struct DemoCheckInView: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss
    @State private var agreedToRules = false
    @State private var licensePlate = ""
    @State private var isLoading = false
    @State private var showSuccess = false

    var body: some View {
        NavigationStack {
            if showSuccess {
                successView
            } else {
                formView
            }
        }
    }

    private var formView: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Site summary
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(trip.siteName)
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)
                        Text(trip.campgroundName)
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                FormField(
                    label: "License Plate (optional)",
                    placeholder: "ABC 1234",
                    text: $licensePlate,
                    autocapitalization: .characters
                )

                Toggle(isOn: $agreedToRules) {
                    Text("I agree to the campground rules")
                        .font(.campBody)
                }
                .tint(.campPrimary)

                PrimaryButton(
                    "Complete Check-In",
                    icon: "checkmark.circle",
                    isLoading: isLoading,
                    isDisabled: !agreedToRules
                ) {
                    Task {
                        isLoading = true
                        try? await Task.sleep(for: .seconds(1))
                        isLoading = false
                        showSuccess = true
                    }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Self Check-In")
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

            Text("You're Checked In!")
                .font(.campDisplaySmall)
                .foregroundColor(.campTextPrimary)

            Text("Welcome to \(trip.campgroundName)!")
                .font(.campBody)
                .foregroundColor(.campTextSecondary)

            Card {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your Site")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(trip.siteName)
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 32)

            Spacer()

            PrimaryButton("Done") { dismiss() }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
        }
        .background(Color.campBackground)
    }
}

/// Demo check-out flow using DemoTrip
struct DemoCheckOutView: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss
    @State private var hasDamage = false
    @State private var damageDescription = ""
    @State private var rating = 0
    @State private var isLoading = false
    @State private var showSuccess = false

    var body: some View {
        NavigationStack {
            if showSuccess {
                successView
            } else {
                formView
            }
        }
    }

    private var formView: some View {
        ScrollView {
            VStack(spacing: 24) {
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Checking out of")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                        Text(trip.siteName)
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)
                        Text(trip.campgroundName)
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Toggle(isOn: $hasDamage) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Report an Issue")
                                .font(.campLabel)
                            Text("Let us know about any problems")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }
                    }
                    .tint(.campWarning)

                    if hasDamage {
                        TextAreaField(
                            label: "Describe the issue",
                            placeholder: "What happened?",
                            text: $damageDescription
                        )
                    }
                }

                PrimaryButton(
                    "Complete Check-Out",
                    icon: "arrow.up.circle",
                    isLoading: isLoading
                ) {
                    Task {
                        isLoading = true
                        try? await Task.sleep(for: .seconds(1))
                        isLoading = false
                        showSuccess = true
                    }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Self Check-Out")
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

            Image(systemName: "hand.wave.fill")
                .font(.system(size: 80))
                .foregroundColor(.campPrimary)

            Text("Safe Travels!")
                .font(.campDisplaySmall)
                .foregroundColor(.campTextPrimary)

            Text("Thank you for staying with us!")
                .font(.campBody)
                .foregroundColor(.campTextSecondary)

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton("Leave a Review") { dismiss() }
                SecondaryButton("Done") { dismiss() }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color.campBackground)
    }
}

/// Messages conversation view
struct MessagesView: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss
    @State private var messageText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Messages
                ScrollView {
                    VStack(spacing: 16) {
                        // Sample messages
                        TripMessageBubble(
                            text: "Thanks for booking with us! We're excited to host you. Let us know if you have any questions before your arrival.",
                            isFromHost: true,
                            time: "Dec 20, 2:30 PM"
                        )

                        if trip.hasUnreadMessages {
                            TripMessageBubble(
                                text: "Just a reminder - check-in starts at 3 PM. Your site is ready and waiting!",
                                isFromHost: true,
                                time: "Today, 9:15 AM"
                            )
                        }
                    }
                    .padding(16)
                }

                Divider()

                // Input
                HStack(spacing: 12) {
                    TextField("Message...", text: $messageText)
                        .textFieldStyle(.roundedBorder)

                    Button(action: {}) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(.campPrimary)
                    }
                    .disabled(messageText.isEmpty)
                }
                .padding(16)
                .background(Color.campSurface)
            }
            .background(Color.campBackground)
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

struct TripMessageBubble: View {
    let text: String
    let isFromHost: Bool
    let time: String

    var body: some View {
        VStack(alignment: isFromHost ? .leading : .trailing, spacing: 4) {
            if isFromHost {
                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.campPrimary.opacity(0.2))
                        .frame(width: 32, height: 32)
                        .overlay(
                            Image(systemName: "person.fill")
                                .font(.system(size: 14))
                                .foregroundColor(.campPrimary)
                        )
                    Text("Campground Host")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
            }

            Text(text)
                .font(.campBody)
                .foregroundColor(isFromHost ? .campTextPrimary : .white)
                .padding(12)
                .background(isFromHost ? Color.campSurface : Color.campPrimary)
                .cornerRadius(16)

            Text(time)
                .font(.system(size: 11))
                .foregroundColor(.campTextHint)
        }
        .frame(maxWidth: .infinity, alignment: isFromHost ? .leading : .trailing)
    }
}

/// Payment sheet
struct PaymentSheet: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Balance summary
                VStack(spacing: 8) {
                    Text("Balance Due")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(formatMoney(cents: trip.balanceCents))
                        .font(.campDisplayMedium)
                        .foregroundColor(.campError)
                }
                .padding(.top, 24)

                // Payment options
                VStack(spacing: 12) {
                    PaymentOptionRow(icon: "creditcard.fill", label: "Credit Card", isSelected: true)
                    PaymentOptionRow(icon: "apple.logo", label: "Apple Pay", isSelected: false)
                }
                .padding(.horizontal, 16)

                Spacer()

                PrimaryButton("Pay \(formatMoney(cents: trip.balanceCents))") {
                    dismiss()
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Color.campBackground)
            .navigationTitle("Pay Balance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

struct PaymentOptionRow: View {
    let icon: String
    let label: String
    let isSelected: Bool

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.campPrimary)
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
            Spacer()
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isSelected ? .campPrimary : .campBorder)
        }
        .padding(16)
        .background(Color.campSurface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: isSelected ? 2 : 1)
        )
    }
}

/// Leave review sheet
struct LeaveReviewSheet: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss
    @State private var rating = 0
    @State private var reviewText = ""
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Campground
                    VStack(spacing: 8) {
                        Text(trip.campgroundName)
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)
                        Text(trip.campgroundLocation)
                            .font(.campBodySmall)
                            .foregroundColor(.campTextSecondary)
                    }
                    .padding(.top, 16)

                    // Star rating
                    VStack(spacing: 8) {
                        Text("How was your stay?")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)

                        HStack(spacing: 8) {
                            ForEach(1...5, id: \.self) { star in
                                Button(action: { rating = star }) {
                                    Image(systemName: star <= rating ? "star.fill" : "star")
                                        .font(.system(size: 36))
                                        .foregroundColor(.campWarning)
                                }
                            }
                        }
                    }

                    // Review text
                    TextAreaField(
                        label: "Share your experience",
                        placeholder: "What did you enjoy about your stay? Any tips for future campers?",
                        text: $reviewText
                    )

                    PrimaryButton(
                        "Submit Review",
                        icon: "paperplane.fill",
                        isLoading: isLoading,
                        isDisabled: rating == 0
                    ) {
                        Task {
                            isLoading = true
                            try? await Task.sleep(for: .seconds(1))
                            isLoading = false
                            dismiss()
                        }
                    }
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Leave a Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

/// Campground rules sheet
struct CampgroundRulesSheet: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Quiet hours
                    RuleSection(
                        icon: "moon.fill",
                        title: "Quiet Hours",
                        content: "10:00 PM - 8:00 AM"
                    )

                    // Check-in/out
                    RuleSection(
                        icon: "clock.fill",
                        title: "Check-in / Check-out",
                        content: "Check-in: 3:00 PM - 9:00 PM\nCheck-out: by 11:00 AM"
                    )

                    // Pets
                    RuleSection(
                        icon: "pawprint.fill",
                        title: "Pet Policy",
                        content: "Pets welcome! Must be leashed at all times. Please clean up after your pet."
                    )

                    // Fires
                    RuleSection(
                        icon: "flame.fill",
                        title: "Campfires",
                        content: "Fires allowed in designated fire rings only. No ground fires. Check for fire restrictions."
                    )

                    // Speed limit
                    RuleSection(
                        icon: "car.fill",
                        title: "Speed Limit",
                        content: "5 MPH throughout the campground"
                    )

                    // Trash
                    RuleSection(
                        icon: "trash.fill",
                        title: "Trash & Recycling",
                        content: "Dumpsters located at the entrance. Please bag all trash. Bear boxes available."
                    )
                }
                .padding(16)
            }
            .background(Color.campBackground)
            .navigationTitle("Campground Rules")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct RuleSection: View {
    let icon: String
    let title: String
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(.campPrimary)
                Text(title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
            }

            Text(content)
                .font(.campBody)
                .foregroundColor(.campTextSecondary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(12)
    }
}

/// Directions sheet
struct DirectionsSheet: View {
    let trip: DemoTrip
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Map placeholder
                Rectangle()
                    .fill(Color.campBackground)
                    .frame(height: 300)
                    .overlay(
                        VStack(spacing: 12) {
                            Image(systemName: "map.fill")
                                .font(.system(size: 48))
                                .foregroundColor(.campTextHint)
                            Text("Map will appear here")
                                .font(.campBody)
                                .foregroundColor(.campTextSecondary)
                        }
                    )
                    .cornerRadius(12)
                    .padding(.horizontal, 16)

                // Address
                VStack(spacing: 4) {
                    Text(trip.campgroundName)
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)
                    Text("123 Campground Road")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    Text(trip.campgroundLocation)
                        .font(.campBodySmall)
                        .foregroundColor(.campTextHint)
                }

                Spacer()

                // Open in Maps button
                VStack(spacing: 12) {
                    PrimaryButton("Open in Maps", icon: "arrow.up.right") {
                        // Would open Apple Maps
                    }
                    SecondaryButton("Copy Address") {
                        // Would copy to clipboard
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .padding(.top, 16)
            .background(Color.campBackground)
            .navigationTitle("Directions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Detail Row (already exists in CampreservUI but duplicated for local use)

struct DetailRow: View {
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

// MARK: - Preview

#Preview {
    TripDetailView(trip: DemoTrip.upcoming[0])
}
