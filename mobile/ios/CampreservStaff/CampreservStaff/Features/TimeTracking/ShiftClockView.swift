import SwiftUI
import CampreservCore
import CampreservUI

/// Shift clock in/out view for time tracking
struct ShiftClockView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var isClockedIn = false
    @State private var clockInTime: Date?
    @State private var currentShiftDuration: TimeInterval = 0
    @State private var isLoading = false
    @State private var recentShifts: [ShiftEntry] = []
    @State private var showBreakOptions = false

    // Break/pause state
    @State private var isOnBreak = false
    @State private var breakStartTime: Date?
    @State private var totalBreakDuration: TimeInterval = 0

    // Sheets
    @State private var showSwitchArea = false
    @State private var showAddNote = false
    @State private var showAllShifts = false

    // Current area
    @State private var currentArea = "Front Desk"

    // Timer for updating duration
    @State private var timer: Timer?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Current status card
                statusCard

                // Clock in/out button
                clockButton

                // Break button (when clocked in and not on break)
                if isClockedIn && !isOnBreak {
                    breakButton
                }

                // Resume button (when on break)
                if isOnBreak {
                    resumeButton
                }

                // Quick actions (when clocked in and not on break)
                if isClockedIn && !isOnBreak {
                    quickActions
                }

                // Today's summary
                todaySummary

                // Recent shifts
                recentShiftsSection
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
        .navigationTitle("Time Clock")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadShiftData()
            startTimerIfNeeded()
        }
        .onDisappear {
            timer?.invalidate()
        }
        .sheet(isPresented: $showSwitchArea) {
            SwitchAreaSheet(currentArea: $currentArea)
        }
        .sheet(isPresented: $showAddNote) {
            AddShiftNoteSheet()
        }
        .sheet(isPresented: $showAllShifts) {
            AllShiftsHistorySheet(shifts: recentShifts)
        }
    }

    // MARK: - Status Card

    private var statusCard: some View {
        VStack(spacing: 16) {
            // Status indicator
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.15))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(statusColor)
                    .frame(width: 100, height: 100)

                VStack(spacing: 4) {
                    Image(systemName: statusIcon)
                        .font(.system(size: 28))
                        .foregroundColor(.white)

                    Text(statusText)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                }
            }

            // Time display
            if isClockedIn {
                VStack(spacing: 4) {
                    Text(isOnBreak ? "On Break" : "Current Shift")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    Text(formatDuration(currentShiftDuration))
                        .font(.system(size: 36, weight: .bold, design: .monospaced))
                        .foregroundColor(isOnBreak ? .campWarning : .campTextPrimary)

                    if let clockIn = clockInTime {
                        Text("Clocked in at \(formatTime(clockIn))")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                    }

                    if isOnBreak, let breakStart = breakStartTime {
                        Text("Break started at \(formatTime(breakStart))")
                            .font(.campCaption)
                            .foregroundColor(.campWarning)
                    }

                    // Current area
                    HStack(spacing: 6) {
                        Image(systemName: "location.fill")
                            .font(.system(size: 10))
                        Text(currentArea)
                            .font(.campCaption)
                    }
                    .foregroundColor(.campInfo)
                    .padding(.top, 8)
                }
            } else {
                VStack(spacing: 4) {
                    Text("Not Clocked In")
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    Text("Tap below to start your shift")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color.campSurface)
        .cornerRadius(20)
    }

    private var statusColor: Color {
        if isOnBreak {
            return .campWarning
        } else if isClockedIn {
            return .campSuccess
        } else {
            return .campTextHint
        }
    }

    private var statusIcon: String {
        if isOnBreak {
            return "pause.fill"
        } else if isClockedIn {
            return "clock.fill"
        } else {
            return "clock"
        }
    }

    private var statusText: String {
        if isOnBreak {
            return "ON BREAK"
        } else if isClockedIn {
            return "ON DUTY"
        } else {
            return "OFF DUTY"
        }
    }

    // MARK: - Clock Button

    private var clockButton: some View {
        Button {
            Task { await toggleClock() }
        } label: {
            HStack(spacing: 12) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: isClockedIn ? "stop.fill" : "play.fill")
                        .font(.system(size: 20))
                }

                Text(isClockedIn ? "Clock Out" : "Clock In")
                    .font(.system(size: 18, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(isClockedIn ? Color.campError : Color.campSuccess)
            .cornerRadius(16)
        }
        .disabled(isLoading || isOnBreak)
        .opacity(isOnBreak ? 0.5 : 1)
    }

    // MARK: - Break Button

    private var breakButton: some View {
        Button {
            startBreak()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "pause.fill")
                    .font(.system(size: 18))
                Text("Take a Break")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(.campWarning)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(Color.campWarning.opacity(0.15))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.campWarning, lineWidth: 1)
            )
        }
    }

    // MARK: - Resume Button

    private var resumeButton: some View {
        Button {
            resumeFromBreak()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "play.fill")
                    .font(.system(size: 18))
                Text("Resume Work")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Color.campSuccess)
            .cornerRadius(16)
        }
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        HStack(spacing: 12) {
            Button {
                showSwitchArea = true
            } label: {
                VStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 20))
                    Text("Switch Area")
                        .font(.campCaption)
                }
                .foregroundColor(.campInfo)
                .frame(maxWidth: .infinity)
                .frame(height: 70)
                .background(Color.campInfo.opacity(0.1))
                .cornerRadius(12)
            }

            Button {
                showAddNote = true
            } label: {
                VStack(spacing: 8) {
                    Image(systemName: "note.text")
                        .font(.system(size: 20))
                    Text("Add Note")
                        .font(.campCaption)
                }
                .foregroundColor(.campWarning)
                .frame(maxWidth: .infinity)
                .frame(height: 70)
                .background(Color.campWarning.opacity(0.1))
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Today's Summary

    private var todaySummary: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Today")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                SummaryCard(
                    icon: "clock.fill",
                    label: "Total Hours",
                    value: formatShortDuration(currentShiftDuration - totalBreakDuration),
                    color: .campPrimary
                )

                SummaryCard(
                    icon: "cup.and.saucer.fill",
                    label: "Breaks",
                    value: formatShortDuration(totalBreakDuration),
                    color: .campInfo
                )

                SummaryCard(
                    icon: "calendar",
                    label: "Scheduled",
                    value: "8h",
                    color: .campTextSecondary
                )

                SummaryCard(
                    icon: "hourglass",
                    label: "Remaining",
                    value: isClockedIn ? calculateRemaining() : "--",
                    color: .campWarning
                )
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private func calculateRemaining() -> String {
        let workedSeconds = currentShiftDuration - totalBreakDuration
        let scheduledSeconds: TimeInterval = 8 * 3600 // 8 hours
        let remaining = max(0, scheduledSeconds - workedSeconds)
        return formatShortDuration(remaining)
    }

    private func formatShortDuration(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    // MARK: - Recent Shifts

    private var recentShiftsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Shifts")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Spacer()

                Button("View All") {
                    showAllShifts = true
                }
                .font(.campCaption)
                .foregroundColor(.campPrimary)
            }

            VStack(spacing: 0) {
                ForEach(recentShifts) { shift in
                    ShiftRow(shift: shift)

                    if shift.id != recentShifts.last?.id {
                        Divider()
                            .padding(.leading, 50)
                    }
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    // MARK: - Actions

    private func toggleClock() async {
        isLoading = true
        defer { isLoading = false }

        // Simulate API call
        try? await Task.sleep(for: .seconds(0.5))

        if isClockedIn {
            // Clock out
            isClockedIn = false
            clockInTime = nil
            currentShiftDuration = 0
            totalBreakDuration = 0
            isOnBreak = false
            breakStartTime = nil
            timer?.invalidate()
        } else {
            // Clock in
            isClockedIn = true
            clockInTime = Date()
            currentShiftDuration = 0
            totalBreakDuration = 0
            startTimerIfNeeded()
        }
    }

    private func startBreak() {
        isOnBreak = true
        breakStartTime = Date()
        // Timer keeps running but we'll track break duration separately
    }

    private func resumeFromBreak() {
        if let breakStart = breakStartTime {
            let breakDuration = Date().timeIntervalSince(breakStart)
            totalBreakDuration += breakDuration
        }
        isOnBreak = false
        breakStartTime = nil
    }

    private func loadShiftData() {
        // Load demo data
        recentShifts = ShiftEntry.samples
    }

    private func startTimerIfNeeded() {
        guard isClockedIn else { return }

        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if let clockIn = clockInTime {
                currentShiftDuration = Date().timeIntervalSince(clockIn)
            }
        }
    }

    // MARK: - Formatting

    private func formatDuration(_ interval: TimeInterval) -> String {
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        let seconds = Int(interval) % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Switch Area Sheet

struct SwitchAreaSheet: View {
    @Binding var currentArea: String
    @Environment(\.dismiss) private var dismiss

    let areas = [
        ("Front Desk", "building.2.fill"),
        ("Camp Store", "bag.fill"),
        ("Pool Area", "drop.fill"),
        ("Maintenance", "wrench.and.screwdriver.fill"),
        ("Grounds", "leaf.fill"),
        ("Office", "doc.text.fill")
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(areas, id: \.0) { area, icon in
                    Button {
                        currentArea = area
                        dismiss()
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: icon)
                                .font(.system(size: 20))
                                .foregroundColor(.campPrimary)
                                .frame(width: 28)

                            Text(area)
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)

                            Spacer()

                            if currentArea == area {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.campPrimary)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Switch Area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Add Shift Note Sheet

struct AddShiftNoteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var noteText = ""
    @State private var selectedType = "General"
    @State private var isSaving = false

    let noteTypes = ["General", "Issue", "Request", "Handoff", "Other"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Note type
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Type")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(noteTypes, id: \.self) { type in
                                    Button {
                                        selectedType = type
                                    } label: {
                                        Text(type)
                                            .font(.campCaption)
                                            .foregroundColor(selectedType == type ? .white : .campTextPrimary)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .background(selectedType == type ? Color.campPrimary : Color.campBackground)
                                            .cornerRadius(20)
                                    }
                                }
                            }
                        }
                    }

                    // Note content
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Note")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        TextEditor(text: $noteText)
                            .font(.campBody)
                            .frame(minHeight: 150)
                            .padding(12)
                            .background(Color.campBackground)
                            .cornerRadius(12)
                    }

                    // Save button
                    PrimaryButton("Save Note", icon: "checkmark.circle", isLoading: isSaving) {
                        Task { await saveNote() }
                    }
                    .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(16)
            }
            .background(Color.campSurface)
            .navigationTitle("Add Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func saveNote() async {
        isSaving = true
        try? await Task.sleep(for: .seconds(0.5))
        isSaving = false
        dismiss()
    }
}

// MARK: - Summary Card

struct SummaryCard: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.system(size: 12))
                Text(label)
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
            }

            Text(value)
                .font(.campHeading3)
                .foregroundColor(.campTextPrimary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campBackground)
        .cornerRadius(10)
    }
}

// MARK: - Shift Entry Model

struct ShiftEntry: Identifiable {
    let id: String
    let date: Date
    let clockIn: Date
    let clockOut: Date?
    let breakMinutes: Int
    let totalHours: Double

    static let samples: [ShiftEntry] = {
        let today = Date()
        let calendar = Calendar.current

        return [
            ShiftEntry(
                id: "shift-1",
                date: calendar.date(byAdding: .day, value: -1, to: today)!,
                clockIn: calendar.date(bySettingHour: 8, minute: 0, second: 0, of: calendar.date(byAdding: .day, value: -1, to: today)!)!,
                clockOut: calendar.date(bySettingHour: 16, minute: 30, second: 0, of: calendar.date(byAdding: .day, value: -1, to: today)!)!,
                breakMinutes: 30,
                totalHours: 8.0
            ),
            ShiftEntry(
                id: "shift-2",
                date: calendar.date(byAdding: .day, value: -2, to: today)!,
                clockIn: calendar.date(bySettingHour: 9, minute: 0, second: 0, of: calendar.date(byAdding: .day, value: -2, to: today)!)!,
                clockOut: calendar.date(bySettingHour: 17, minute: 15, second: 0, of: calendar.date(byAdding: .day, value: -2, to: today)!)!,
                breakMinutes: 45,
                totalHours: 7.5
            ),
            ShiftEntry(
                id: "shift-3",
                date: calendar.date(byAdding: .day, value: -3, to: today)!,
                clockIn: calendar.date(bySettingHour: 7, minute: 30, second: 0, of: calendar.date(byAdding: .day, value: -3, to: today)!)!,
                clockOut: calendar.date(bySettingHour: 15, minute: 30, second: 0, of: calendar.date(byAdding: .day, value: -3, to: today)!)!,
                breakMinutes: 30,
                totalHours: 7.5
            )
        ]
    }()
}

struct ShiftRow: View {
    let shift: ShiftEntry

    var body: some View {
        HStack(spacing: 12) {
            // Date
            VStack(spacing: 2) {
                Text(dayOfWeek)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.campTextHint)
                Text(dayNumber)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
            }
            .frame(width: 40)

            // Times
            VStack(alignment: .leading, spacing: 4) {
                Text("\(formatTime(shift.clockIn)) - \(formatTime(shift.clockOut))")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                if shift.breakMinutes > 0 {
                    Text("\(shift.breakMinutes)m break")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                }
            }

            Spacer()

            // Total hours
            Text(String(format: "%.1fh", shift.totalHours))
                .font(.campLabel)
                .foregroundColor(.campPrimary)
        }
        .padding(.vertical, 12)
    }

    private var dayOfWeek: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: shift.date).uppercased()
    }

    private var dayNumber: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: shift.date)
    }

    private func formatTime(_ date: Date?) -> String {
        guard let date = date else { return "--:--" }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - All Shifts History Sheet

struct AllShiftsHistorySheet: View {
    let shifts: [ShiftEntry]
    @Environment(\.dismiss) private var dismiss
    @State private var selectedWeek = 0 // 0 = current, -1 = last week, etc.

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Week selector
                weekSelector

                // Shifts list
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(groupedShifts, id: \.0) { date, dayShifts in
                            Section {
                                ForEach(dayShifts) { shift in
                                    ShiftHistoryRow(shift: shift)
                                    if shift.id != dayShifts.last?.id {
                                        Divider()
                                            .padding(.leading, 60)
                                    }
                                }
                            } header: {
                                HStack {
                                    Text(formatSectionDate(date))
                                        .font(.campLabel)
                                        .foregroundColor(.campTextSecondary)
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color.campBackground)
                            }
                        }
                    }
                }

                // Weekly summary
                weeklySummary
            }
            .background(Color.campBackground)
            .navigationTitle("Shift History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var weekSelector: some View {
        HStack(spacing: 16) {
            Button {
                selectedWeek -= 1
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.campPrimary)
            }

            Text(weekLabel)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
                .frame(minWidth: 120)

            Button {
                if selectedWeek < 0 {
                    selectedWeek += 1
                }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(selectedWeek >= 0 ? .campTextHint : .campPrimary)
            }
            .disabled(selectedWeek >= 0)
        }
        .padding(16)
        .background(Color.campSurface)
    }

    private var weekLabel: String {
        if selectedWeek == 0 {
            return "This Week"
        } else if selectedWeek == -1 {
            return "Last Week"
        } else {
            return "\(abs(selectedWeek)) Weeks Ago"
        }
    }

    private var groupedShifts: [(Date, [ShiftEntry])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: shifts) { shift in
            calendar.startOfDay(for: shift.date)
        }
        return grouped.sorted { $0.key > $1.key }
    }

    private var weeklySummary: some View {
        HStack(spacing: 24) {
            VStack(spacing: 4) {
                Text("Total Hours")
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
                Text(String(format: "%.1f", shifts.reduce(0) { $0 + $1.totalHours }))
                    .font(.campHeading3)
                    .foregroundColor(.campPrimary)
            }

            VStack(spacing: 4) {
                Text("Days Worked")
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
                Text("\(Set(shifts.map { Calendar.current.startOfDay(for: $0.date) }).count)")
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
            }

            VStack(spacing: 4) {
                Text("Avg/Day")
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
                let days = Set(shifts.map { Calendar.current.startOfDay(for: $0.date) }).count
                let avg = days > 0 ? shifts.reduce(0) { $0 + $1.totalHours } / Double(days) : 0
                Text(String(format: "%.1fh", avg))
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
            }
        }
        .padding(16)
        .background(Color.campSurface)
    }

    private func formatSectionDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }
}

struct ShiftHistoryRow: View {
    let shift: ShiftEntry

    var body: some View {
        HStack(spacing: 14) {
            // Date column
            VStack(spacing: 2) {
                Text(dayOfWeek)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.campTextHint)
                Text(dayNumber)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)
            }
            .frame(width: 44)

            // Time details
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.right.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.campSuccess)
                    Text(formatTime(shift.clockIn))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    Text("-")
                        .foregroundColor(.campTextHint)

                    Image(systemName: "arrow.left.circle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.campWarning)
                    Text(formatTime(shift.clockOut))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                }

                if shift.breakMinutes > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "cup.and.saucer.fill")
                            .font(.system(size: 10))
                            .foregroundColor(.campInfo)
                        Text("\(shift.breakMinutes)m break")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }
            }

            Spacer()

            // Total hours
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f", shift.totalHours))
                    .font(.campHeading3)
                    .foregroundColor(.campPrimary)
                Text("hours")
                    .font(.system(size: 10))
                    .foregroundColor(.campTextHint)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var dayOfWeek: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: shift.date).uppercased()
    }

    private var dayNumber: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: shift.date)
    }

    private func formatTime(_ date: Date?) -> String {
        guard let date = date else { return "--:--" }
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}
