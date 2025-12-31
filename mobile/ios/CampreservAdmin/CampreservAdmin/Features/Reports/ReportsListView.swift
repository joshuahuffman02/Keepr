import SwiftUI
import CampreservCore
import CampreservUI

/// Reports list view
struct ReportsListView: View {

    @EnvironmentObject private var appState: AdminAppState

    var body: some View {
        NavigationStack {
            List {
                // Revenue reports
                Section("Revenue") {
                    NavigationLink(destination: RevenueReportView()) {
                        ReportRow(
                            icon: "dollarsign.circle",
                            title: "Revenue Report",
                            description: "Daily, weekly, monthly revenue breakdown"
                        )
                    }

                    NavigationLink(destination: AgingReportView()) {
                        ReportRow(
                            icon: "exclamationmark.circle",
                            title: "Aging Report",
                            description: "Outstanding balances by age"
                        )
                    }
                }

                // Occupancy reports
                Section("Occupancy") {
                    NavigationLink(destination: OccupancyReportView()) {
                        ReportRow(
                            icon: "chart.pie",
                            title: "Occupancy Report",
                            description: "Historical occupancy trends"
                        )
                    }

                    NavigationLink(destination: SiteUtilizationView()) {
                        ReportRow(
                            icon: "square.grid.3x3",
                            title: "Site Utilization",
                            description: "Performance by site and class"
                        )
                    }
                }

                // Guest reports
                Section("Guests") {
                    NavigationLink(destination: GuestReportView()) {
                        ReportRow(
                            icon: "person.2",
                            title: "Guest Report",
                            description: "Guest demographics and trends"
                        )
                    }
                }
            }
            .navigationTitle("Reports")
        }
    }
}

// MARK: - Components

struct ReportRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(.campPrimary)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                Text(description)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Revenue Report

struct RevenueReportView: View {

    @State private var selectedPeriod: ReportPeriod = .month
    @State private var revenueData: [RevenueEntry] = []
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Period selector
                Picker("Period", selection: $selectedPeriod) {
                    ForEach(ReportPeriod.allCases, id: \.self) { period in
                        Text(period.title).tag(period)
                    }
                }
                .pickerStyle(.segmented)

                // Summary card
                Card {
                    VStack(spacing: 16) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Total Revenue")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                                Text(formatMoney(cents: totalRevenue))
                                    .font(.campDisplayMedium)
                                    .foregroundColor(.campPrimary)
                            }
                            Spacer()
                        }

                        Divider()

                        HStack(spacing: 32) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Reservations")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                                Text(formatMoney(cents: reservationRevenue))
                                    .font(.campLabel)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Store")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                                Text(formatMoney(cents: storeRevenue))
                                    .font(.campLabel)
                            }
                        }
                    }
                }

                // Daily breakdown
                SectionCard(title: "Daily Breakdown") {
                    if isLoading {
                        SkeletonView().frame(height: 200)
                    } else if revenueData.isEmpty {
                        Text("No data available")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    } else {
                        ForEach(revenueData, id: \.date) { entry in
                            HStack {
                                Text(formatDate(entry.date))
                                    .font(.campBody)
                                    .foregroundColor(.campTextSecondary)
                                Spacer()
                                Text(formatMoney(cents: entry.amountCents))
                                    .font(.campLabel)
                            }
                            if entry.date != revenueData.last?.date {
                                Divider()
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Revenue Report")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadData()
        }
        .onChange(of: selectedPeriod) { _ in
            Task { await loadData() }
        }
    }

    private var totalRevenue: Int {
        revenueData.reduce(0) { $0 + $1.amountCents }
    }

    private var reservationRevenue: Int {
        Int(Double(totalRevenue) * 0.85)
    }

    private var storeRevenue: Int {
        totalRevenue - reservationRevenue
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        try? await Task.sleep(for: .seconds(1))
        revenueData = []
    }

    private func formatMoney(cents: Int) -> String {
        "$\(String(format: "%.2f", Double(cents) / 100.0))"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

struct RevenueEntry {
    let date: Date
    let amountCents: Int
}

enum ReportPeriod: CaseIterable {
    case week, month, quarter, year

    var title: String {
        switch self {
        case .week: return "Week"
        case .month: return "Month"
        case .quarter: return "Quarter"
        case .year: return "Year"
        }
    }
}

// MARK: - Aging Report

struct AgingReportView: View {

    @State private var agingData: [AgingBucket] = []
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Summary
                Card {
                    VStack(spacing: 8) {
                        HStack {
                            Text("Total Outstanding")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            Spacer()
                        }
                        HStack {
                            Text(formatMoney(cents: totalOutstanding))
                                .font(.campDisplayMedium)
                                .foregroundColor(.campError)
                            Spacer()
                        }
                    }
                }

                // Buckets
                SectionCard(title: "By Age") {
                    if isLoading {
                        SkeletonView().frame(height: 150)
                    } else {
                        ForEach(agingData, id: \.label) { bucket in
                            HStack {
                                Text(bucket.label)
                                    .font(.campBody)
                                    .foregroundColor(.campTextSecondary)
                                Spacer()
                                Text(formatMoney(cents: bucket.amountCents))
                                    .font(.campLabel)
                                    .foregroundColor(bucket.isOverdue ? .campError : .campTextPrimary)
                            }
                            if bucket.label != agingData.last?.label {
                                Divider()
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Aging Report")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadData()
        }
    }

    private var totalOutstanding: Int {
        agingData.reduce(0) { $0 + $1.amountCents }
    }

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        try? await Task.sleep(for: .seconds(1))
        agingData = [
            AgingBucket(label: "Current", amountCents: 50000, isOverdue: false),
            AgingBucket(label: "1-30 days", amountCents: 25000, isOverdue: true),
            AgingBucket(label: "31-60 days", amountCents: 15000, isOverdue: true),
            AgingBucket(label: "60+ days", amountCents: 10000, isOverdue: true)
        ]
    }

    private func formatMoney(cents: Int) -> String {
        "$\(String(format: "%.2f", Double(cents) / 100.0))"
    }
}

struct AgingBucket {
    let label: String
    let amountCents: Int
    let isOverdue: Bool
}

// MARK: - Placeholder Reports

struct OccupancyReportView: View {
    var body: some View {
        Text("Occupancy Report")
            .navigationTitle("Occupancy Report")
    }
}

struct SiteUtilizationView: View {
    var body: some View {
        Text("Site Utilization")
            .navigationTitle("Site Utilization")
    }
}

struct GuestReportView: View {
    var body: some View {
        Text("Guest Report")
            .navigationTitle("Guest Report")
    }
}
