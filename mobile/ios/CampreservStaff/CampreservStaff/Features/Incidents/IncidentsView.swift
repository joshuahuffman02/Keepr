import SwiftUI
import PhotosUI
import CampreservCore
import CampreservUI

/// Incidents management view with photo capture
struct IncidentsView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var incidents: [Incident] = []
    @State private var isLoading = true
    @State private var showNewIncident = false
    @State private var selectedFilter: IncidentFilter = .open

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter tabs
                filterTabs

                // Content
                if isLoading {
                    Spacer()
                    LoadingView(message: "Loading incidents...")
                    Spacer()
                } else if filteredIncidents.isEmpty {
                    Spacer()
                    EmptyStateView(
                        icon: "checkmark.shield",
                        title: "No Incidents",
                        message: selectedFilter.emptyMessage,
                        actionTitle: "Report Incident"
                    ) {
                        showNewIncident = true
                    }
                    Spacer()
                } else {
                    incidentsList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle("Incidents")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewIncident = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewIncident) {
                NewIncidentView()
            }
            .refreshable {
                await loadIncidents()
            }
        }
        .task {
            await loadIncidents()
        }
    }

    // MARK: - Filter Tabs

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(IncidentFilter.allCases, id: \.self) { filter in
                    IncidentFilterChip(
                        title: filter.title,
                        count: countFor(filter),
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color.campSurface)
    }

    private func countFor(_ filter: IncidentFilter) -> Int {
        switch filter {
        case .open: return incidents.filter { $0.status == "open" }.count
        case .investigating: return incidents.filter { $0.status == "investigating" }.count
        case .resolved: return incidents.filter { $0.status == "resolved" }.count
        case .all: return incidents.count
        }
    }

    // MARK: - Incidents List

    private var incidentsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredIncidents) { incident in
                    NavigationLink(destination: IncidentDetailView(incident: incident)) {
                        IncidentCard(incident: incident)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
    }

    private var filteredIncidents: [Incident] {
        switch selectedFilter {
        case .open:
            return incidents.filter { $0.status == "open" }
        case .investigating:
            return incidents.filter { $0.status == "investigating" }
        case .resolved:
            return incidents.filter { $0.status == "resolved" }
        case .all:
            return incidents
        }
    }

    private func loadIncidents() async {
        isLoading = true
        defer { isLoading = false }

        try? await Task.sleep(for: .seconds(0.5))
        incidents = Incident.samples
    }
}

// MARK: - Filter

enum IncidentFilter: CaseIterable {
    case open, investigating, resolved, all

    var title: String {
        switch self {
        case .open: return "Open"
        case .investigating: return "Investigating"
        case .resolved: return "Resolved"
        case .all: return "All"
        }
    }

    var emptyMessage: String {
        switch self {
        case .open: return "No open incidents. Great job keeping things safe!"
        case .investigating: return "No incidents under investigation."
        case .resolved: return "No resolved incidents."
        case .all: return "No incidents reported."
        }
    }
}

// MARK: - Incident Model

struct Incident: Identifiable {
    let id: String
    let title: String
    let description: String
    let type: String // injury, damage, theft, disturbance, wildlife, weather, other
    let severity: String // low, medium, high, critical
    let status: String // open, investigating, resolved
    let location: String?
    let siteName: String?
    let reportedBy: String
    let reportedAt: Date
    let photoURLs: [String]
    let notes: [IncidentNote]

    static let samples: [Incident] = {
        let today = Date()
        let calendar = Calendar.current

        return [
            Incident(
                id: "inc-1",
                title: "Guest injured on playground",
                description: "Child fell from swing set and scraped knee. First aid administered. Parents notified and satisfied with response.",
                type: "injury",
                severity: "medium",
                status: "open",
                location: "Playground Area",
                siteName: nil,
                reportedBy: "Sarah Thompson",
                reportedAt: today.addingTimeInterval(-3600),
                photoURLs: ["photo1.jpg"],
                notes: [
                    IncidentNote(id: "note-1", content: "Ice pack and bandage applied", author: "Sarah Thompson", createdAt: today.addingTimeInterval(-3500))
                ]
            ),
            Incident(
                id: "inc-2",
                title: "Tree limb fell on RV",
                description: "Strong winds caused a large branch to fall on RV at Site 22. Minor damage to awning. Guest requesting compensation.",
                type: "damage",
                severity: "high",
                status: "investigating",
                location: nil,
                siteName: "Site 22",
                reportedBy: "Mike Rodriguez",
                reportedAt: today.addingTimeInterval(-7200),
                photoURLs: ["photo2.jpg", "photo3.jpg"],
                notes: [
                    IncidentNote(id: "note-2", content: "Photos taken and insurance notified", author: "Mike Rodriguez", createdAt: today.addingTimeInterval(-7000)),
                    IncidentNote(id: "note-3", content: "Tree service scheduled for tomorrow", author: "Sarah Thompson", createdAt: today.addingTimeInterval(-5000))
                ]
            ),
            Incident(
                id: "inc-3",
                title: "Loud music complaint",
                description: "Multiple complaints about loud music from Site 15 after quiet hours (10pm). Warning issued.",
                type: "disturbance",
                severity: "low",
                status: "resolved",
                location: nil,
                siteName: "Site 15",
                reportedBy: "David Kim",
                reportedAt: calendar.date(byAdding: .day, value: -1, to: today)!,
                photoURLs: [],
                notes: [
                    IncidentNote(id: "note-4", content: "Verbal warning given, guests complied immediately", author: "David Kim", createdAt: calendar.date(byAdding: .day, value: -1, to: today)!)
                ]
            ),
            Incident(
                id: "inc-4",
                title: "Bear sighting near dumpster",
                description: "Black bear spotted near main dumpster area around 6am. Wildlife control notified.",
                type: "wildlife",
                severity: "high",
                status: "open",
                location: "Dumpster Area",
                siteName: nil,
                reportedBy: "Lisa Chen",
                reportedAt: today.addingTimeInterval(-10800),
                photoURLs: ["photo4.jpg"],
                notes: [
                    IncidentNote(id: "note-5", content: "Wildlife control contacted - ETA 2 hours", author: "Lisa Chen", createdAt: today.addingTimeInterval(-10700)),
                    IncidentNote(id: "note-6", content: "Posted warning signs at all sites", author: "Mike Rodriguez", createdAt: today.addingTimeInterval(-9000))
                ]
            )
        ]
    }()
}

struct IncidentNote: Identifiable {
    let id: String
    let content: String
    let author: String
    let createdAt: Date
}

// MARK: - Components

struct IncidentFilterChip: View {
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

struct IncidentCard: View {
    let incident: Incident

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                // Severity indicator
                Circle()
                    .fill(severityColor)
                    .frame(width: 10, height: 10)

                Text(incident.title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(2)

                Spacer()

                IncidentStatusBadge(status: incident.status)
            }

            // Type and location
            HStack(spacing: 16) {
                Label(incident.type.capitalized, systemImage: typeIcon)

                if let site = incident.siteName {
                    Label(site, systemImage: "tent.fill")
                } else if let location = incident.location {
                    Label(location, systemImage: "location.fill")
                }
            }
            .font(.campCaption)
            .foregroundColor(.campTextSecondary)

            // Description preview
            Text(incident.description)
                .font(.campCaption)
                .foregroundColor(.campTextSecondary)
                .lineLimit(2)

            // Footer
            HStack {
                Text("Reported by \(incident.reportedBy)")
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)

                Spacer()

                Text(formatTime(incident.reportedAt))
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)

                // Photo indicator
                if !incident.photoURLs.isEmpty {
                    HStack(spacing: 2) {
                        Image(systemName: "photo")
                        Text("\(incident.photoURLs.count)")
                    }
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(incident.severity == "critical" ? Color.campError.opacity(0.5) : Color.clear, lineWidth: 2)
        )
    }

    private var severityColor: Color {
        switch incident.severity {
        case "critical": return .campError
        case "high": return .campWarning
        case "medium": return .campInfo
        default: return .campTextHint
        }
    }

    private var typeIcon: String {
        switch incident.type {
        case "injury": return "bandage.fill"
        case "damage": return "car.fill"
        case "theft": return "lock.fill"
        case "disturbance": return "speaker.wave.3.fill"
        case "wildlife": return "pawprint.fill"
        case "weather": return "cloud.bolt.fill"
        default: return "exclamationmark.triangle.fill"
        }
    }

    private func formatTime(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            let formatter = DateFormatter()
            formatter.dateFormat = "h:mm a"
            return formatter.string(from: date)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }
}

struct IncidentStatusBadge: View {
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
        case "open": return "Open"
        case "investigating": return "Investigating"
        case "resolved": return "Resolved"
        default: return status.capitalized
        }
    }

    private var color: Color {
        switch status {
        case "open": return .campWarning
        case "investigating": return .campInfo
        case "resolved": return .campSuccess
        default: return .campTextSecondary
        }
    }
}

// MARK: - Incident Detail View

struct IncidentDetailView: View {
    let incident: Incident
    @State private var showAddNote = false
    @State private var showAddPhoto = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header card
                headerCard

                // Photos section
                if !incident.photoURLs.isEmpty {
                    photosSection
                }

                // Description
                descriptionCard

                // Timeline / Notes
                notesSection

                // Actions
                actionsSection
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
        .navigationTitle("Incident")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showAddNote = true
                    } label: {
                        Label("Add Note", systemImage: "note.text")
                    }
                    Button {
                        showAddPhoto = true
                    } label: {
                        Label("Add Photo", systemImage: "camera")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showAddNote) {
            AddNoteSheet(incidentId: incident.id)
        }
        .sheet(isPresented: $showAddPhoto) {
            PhotoCaptureSheet(incidentId: incident.id)
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                // Severity
                HStack(spacing: 6) {
                    Circle()
                        .fill(severityColor)
                        .frame(width: 10, height: 10)
                    Text(incident.severity.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(severityColor)
                }

                Spacer()

                IncidentStatusBadge(status: incident.status)
            }

            Text(incident.title)
                .font(.campHeading2)
                .foregroundColor(.campTextPrimary)

            HStack(spacing: 16) {
                Label(incident.type.capitalized, systemImage: typeIcon)

                if let site = incident.siteName {
                    Label(site, systemImage: "tent.fill")
                } else if let location = incident.location {
                    Label(location, systemImage: "location.fill")
                }
            }
            .font(.campBody)
            .foregroundColor(.campTextSecondary)

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Reported by")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(incident.reportedBy)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Reported")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(formatDateTime(incident.reportedAt))
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Photos (\(incident.photoURLs.count))")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(incident.photoURLs, id: \.self) { _ in
                        // Placeholder for photos
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.campTextHint.opacity(0.2))
                            .frame(width: 120, height: 120)
                            .overlay(
                                Image(systemName: "photo")
                                    .font(.system(size: 24))
                                    .foregroundColor(.campTextHint)
                            )
                    }

                    // Add photo button
                    Button {
                        showAddPhoto = true
                    } label: {
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.campPrimary, style: StrokeStyle(lineWidth: 2, dash: [6]))
                            .frame(width: 120, height: 120)
                            .overlay(
                                VStack(spacing: 8) {
                                    Image(systemName: "plus.circle")
                                        .font(.system(size: 24))
                                    Text("Add")
                                        .font(.campCaption)
                                }
                                .foregroundColor(.campPrimary)
                            )
                    }
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var descriptionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Description")
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            Text(incident.description)
                .font(.campBody)
                .foregroundColor(.campTextSecondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Notes & Updates")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Spacer()

                Button {
                    showAddNote = true
                } label: {
                    Label("Add", systemImage: "plus")
                        .font(.campCaption)
                        .foregroundColor(.campPrimary)
                }
            }

            if incident.notes.isEmpty {
                Text("No notes yet")
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 16) {
                    ForEach(incident.notes) { note in
                        HStack(alignment: .top, spacing: 12) {
                            Circle()
                                .fill(Color.campPrimary)
                                .frame(width: 8, height: 8)
                                .padding(.top, 6)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(note.content)
                                    .font(.campBody)
                                    .foregroundColor(.campTextPrimary)

                                HStack {
                                    Text(note.author)
                                    Text("-")
                                    Text(formatDateTime(note.createdAt))
                                }
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                            }
                        }
                    }
                }
            }
        }
        .padding(20)
        .background(Color.campSurface)
        .cornerRadius(16)
    }

    private var actionsSection: some View {
        VStack(spacing: 12) {
            switch incident.status {
            case "open":
                PrimaryButton("Start Investigation", icon: "magnifyingglass") {
                    // Update status
                }
            case "investigating":
                PrimaryButton("Mark Resolved", icon: "checkmark.circle.fill") {
                    // Update status
                }
            default:
                EmptyView()
            }

            if incident.status != "resolved" {
                SecondaryButton("Escalate to Manager") {
                    // Escalate
                }
            }
        }
    }

    // MARK: - Helpers

    private var severityColor: Color {
        switch incident.severity {
        case "critical": return .campError
        case "high": return .campWarning
        case "medium": return .campInfo
        default: return .campTextHint
        }
    }

    private var typeIcon: String {
        switch incident.type {
        case "injury": return "bandage.fill"
        case "damage": return "car.fill"
        case "theft": return "lock.fill"
        case "disturbance": return "speaker.wave.3.fill"
        case "wildlife": return "pawprint.fill"
        case "weather": return "cloud.bolt.fill"
        default: return "exclamationmark.triangle.fill"
        }
    }

    private func formatDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Add Note Sheet

struct AddNoteSheet: View {
    let incidentId: String
    @State private var noteText = ""
    @State private var isSubmitting = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                TextEditor(text: $noteText)
                    .padding(12)
                    .background(Color.campBackground)
                    .cornerRadius(12)
                    .frame(minHeight: 150)

                Spacer()
            }
            .padding(16)
            .background(Color.campSurface)
            .navigationTitle("Add Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await saveNote() }
                    }
                    .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
                }
            }
        }
    }

    private func saveNote() async {
        isSubmitting = true
        try? await Task.sleep(for: .seconds(0.5))
        dismiss()
    }
}

// MARK: - Photo Capture Sheet

struct PhotoCaptureSheet: View {
    let incidentId: String
    @State private var selectedItem: PhotosPickerItem?
    @State private var capturedImage: UIImage?
    @State private var showCamera = false
    @State private var isSubmitting = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Preview
                if let image = capturedImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 300)
                        .cornerRadius(16)
                } else {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.campBackground)
                        .frame(height: 200)
                        .overlay(
                            VStack(spacing: 12) {
                                Image(systemName: "photo")
                                    .font(.system(size: 40))
                                    .foregroundColor(.campTextHint)
                                Text("No photo selected")
                                    .font(.campCaption)
                                    .foregroundColor(.campTextHint)
                            }
                        )
                }

                // Buttons
                HStack(spacing: 16) {
                    Button {
                        showCamera = true
                    } label: {
                        VStack(spacing: 8) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 24))
                            Text("Camera")
                                .font(.campCaption)
                        }
                        .foregroundColor(.campPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 80)
                        .background(Color.campPrimary.opacity(0.1))
                        .cornerRadius(12)
                    }

                    PhotosPicker(selection: $selectedItem, matching: .images) {
                        VStack(spacing: 8) {
                            Image(systemName: "photo.on.rectangle")
                                .font(.system(size: 24))
                            Text("Library")
                                .font(.campCaption)
                        }
                        .foregroundColor(.campInfo)
                        .frame(maxWidth: .infinity)
                        .frame(height: 80)
                        .background(Color.campInfo.opacity(0.1))
                        .cornerRadius(12)
                    }
                }
                .onChange(of: selectedItem) { newItem in
                    Task {
                        if let data = try? await newItem?.loadTransferable(type: Data.self),
                           let image = UIImage(data: data) {
                            capturedImage = image
                        }
                    }
                }

                Spacer()

                // Upload button
                if capturedImage != nil {
                    PrimaryButton("Upload Photo", icon: "arrow.up.circle") {
                        Task { await uploadPhoto() }
                    }
                    .disabled(isSubmitting)
                }
            }
            .padding(16)
            .background(Color.campSurface)
            .navigationTitle("Add Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: $showCamera) {
                CameraView(image: $capturedImage)
            }
        }
    }

    private func uploadPhoto() async {
        isSubmitting = true
        try? await Task.sleep(for: .seconds(1))
        dismiss()
    }
}

// MARK: - Camera View

struct CameraView: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView

        init(_ parent: CameraView) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = image
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - New Incident View

struct NewIncidentView: View {
    @State private var title = ""
    @State private var description = ""
    @State private var type = "other"
    @State private var severity = "medium"
    @State private var location = ""
    @State private var siteName = ""
    @State private var photos: [UIImage] = []
    @State private var showCamera = false
    @State private var showPhotosPicker = false
    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var isSubmitting = false
    @Environment(\.dismiss) private var dismiss

    let incidentTypes = [
        ("injury", "Injury"),
        ("damage", "Property Damage"),
        ("theft", "Theft"),
        ("disturbance", "Disturbance"),
        ("wildlife", "Wildlife"),
        ("weather", "Weather"),
        ("other", "Other")
    ]

    let severityLevels = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Incident Details") {
                    TextField("Title", text: $title)

                    Picker("Type", selection: $type) {
                        ForEach(incidentTypes, id: \.0) { key, label in
                            Text(label).tag(key)
                        }
                    }

                    Picker("Severity", selection: $severity) {
                        ForEach(severityLevels, id: \.0) { key, label in
                            Text(label).tag(key)
                        }
                    }
                }

                Section("Location") {
                    TextField("Site Name (if applicable)", text: $siteName)
                    TextField("General Location", text: $location)
                }

                Section("Description") {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                }

                Section("Photos") {
                    if !photos.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(photos.indices, id: \.self) { index in
                                    ZStack(alignment: .topTrailing) {
                                        Image(uiImage: photos[index])
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 80, height: 80)
                                            .cornerRadius(8)
                                            .clipped()

                                        Button {
                                            photos.remove(at: index)
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .foregroundColor(.white)
                                                .background(Circle().fill(Color.black.opacity(0.5)))
                                        }
                                        .offset(x: 6, y: -6)
                                    }
                                }
                            }
                        }
                    }

                    HStack(spacing: 16) {
                        Button {
                            showCamera = true
                        } label: {
                            Label("Camera", systemImage: "camera")
                        }

                        PhotosPicker(selection: $selectedItems, maxSelectionCount: 5, matching: .images) {
                            Label("Library", systemImage: "photo.on.rectangle")
                        }
                    }
                    .onChange(of: selectedItems) { newItems in
                        Task {
                            for item in newItems {
                                if let data = try? await item.loadTransferable(type: Data.self),
                                   let image = UIImage(data: data) {
                                    photos.append(image)
                                }
                            }
                            selectedItems = []
                        }
                    }
                }
            }
            .navigationTitle("Report Incident")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        Task { await submitIncident() }
                    }
                    .disabled(title.isEmpty || description.isEmpty || isSubmitting)
                }
            }
            .sheet(isPresented: $showCamera) {
                CameraView(image: Binding(
                    get: { nil },
                    set: { if let image = $0 { photos.append(image) } }
                ))
            }
        }
    }

    private func submitIncident() async {
        isSubmitting = true
        try? await Task.sleep(for: .seconds(1))
        dismiss()
    }
}
