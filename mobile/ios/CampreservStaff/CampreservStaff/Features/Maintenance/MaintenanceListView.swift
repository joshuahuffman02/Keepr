import SwiftUI
import CampreservCore
import CampreservUI

/// Maintenance tasks list - full screen layout
struct MaintenanceListView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var tasks: [MaintenanceTask] = []
    @State private var isLoading = false
    @State private var selectedFilter: TaskFilter = .open
    @State private var showNewTask = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter tabs
                filterTabs

                // Content
                if isLoading {
                    Spacer()
                    LoadingView(message: "Loading tasks...")
                    Spacer()
                } else if filteredTasks.isEmpty {
                    Spacer()
                    EmptyStateView(
                        icon: "checkmark.circle",
                        title: "All Clear",
                        message: selectedFilter.emptyMessage,
                        actionTitle: "Create Task"
                    ) {
                        showNewTask = true
                    }
                    Spacer()
                } else {
                    tasksList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle("Maintenance")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showNewTask = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewTask) {
                NewTaskView()
            }
            .refreshable {
                await loadTasks()
            }
        }
        .task {
            await loadTasks()
        }
    }

    private var filterTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TaskFilter.allCases, id: \.self) { filter in
                    TaskFilterChip(
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

    private func countFor(_ filter: TaskFilter) -> Int {
        switch filter {
        case .open: return tasks.filter { $0.state == "open" || $0.state == "in_progress" }.count
        case .inProgress: return tasks.filter { $0.state == "in_progress" }.count
        case .completed: return tasks.filter { $0.state == "completed" }.count
        case .all: return tasks.count
        }
    }

    private var tasksList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredTasks, id: \.id) { task in
                    NavigationLink(destination: TaskDetailView(task: task)) {
                        TaskCard(task: task)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
    }

    private var filteredTasks: [MaintenanceTask] {
        switch selectedFilter {
        case .open:
            return tasks.filter { $0.state == "open" || $0.state == "in_progress" }
        case .inProgress:
            return tasks.filter { $0.state == "in_progress" }
        case .completed:
            return tasks.filter { $0.state == "completed" }
        case .all:
            return tasks
        }
    }

    private func loadTasks() async {
        isLoading = true
        defer { isLoading = false }

        // Simulate loading demo tasks
        try? await Task.sleep(for: .seconds(0.5))
        tasks = MaintenanceTask.demoTasks
    }
}

// MARK: - Demo Data

extension MaintenanceTask {
    static let demoTasks: [MaintenanceTask] = [
        MaintenanceTask(
            id: "task-1",
            title: "Fix water hookup at Site 12",
            description: "Guest reported low water pressure. May need to replace valve.",
            siteName: "Site 12",
            type: "repair",
            priority: "high",
            state: "open",
            assigneeName: nil,
            createdAt: Date().addingTimeInterval(-3600),
            dueDate: Date().addingTimeInterval(86400)
        ),
        MaintenanceTask(
            id: "task-2",
            title: "Replace light bulb at restroom B",
            description: "Third stall light is out",
            siteName: "Restroom B",
            type: "maintenance",
            priority: "normal",
            state: "in_progress",
            assigneeName: "Mike",
            createdAt: Date().addingTimeInterval(-7200),
            dueDate: nil
        ),
        MaintenanceTask(
            id: "task-3",
            title: "Mow grass around playground",
            description: nil,
            siteName: "Playground",
            type: "maintenance",
            priority: "low",
            state: "open",
            assigneeName: nil,
            createdAt: Date().addingTimeInterval(-86400),
            dueDate: Date().addingTimeInterval(172800)
        ),
        MaintenanceTask(
            id: "task-4",
            title: "Clean fire pit at Site 5",
            description: "Ash buildup needs removal",
            siteName: "Site 5",
            type: "cleaning",
            priority: "normal",
            state: "completed",
            assigneeName: "Sarah",
            createdAt: Date().addingTimeInterval(-172800),
            dueDate: nil
        ),
        MaintenanceTask(
            id: "task-5",
            title: "Inspect electrical at Site 22",
            description: "Guest reported sparks when plugging in. URGENT - safety issue.",
            siteName: "Site 22",
            type: "inspection",
            priority: "urgent",
            state: "open",
            assigneeName: nil,
            createdAt: Date().addingTimeInterval(-1800),
            dueDate: Date()
        )
    ]
}

// MARK: - Models

struct MaintenanceTask: Identifiable {
    let id: String
    let title: String
    let description: String?
    let siteName: String?
    let type: String
    let priority: String
    let state: String
    let assigneeName: String?
    let createdAt: Date
    let dueDate: Date?
}

// MARK: - Filter

enum TaskFilter: CaseIterable {
    case open, inProgress, completed, all

    var title: String {
        switch self {
        case .open: return "Open"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .all: return "All"
        }
    }

    var emptyMessage: String {
        switch self {
        case .open: return "No open tasks. Everything is running smoothly!"
        case .inProgress: return "No tasks in progress."
        case .completed: return "No completed tasks yet."
        case .all: return "No maintenance tasks found."
        }
    }
}

// MARK: - Components

struct TaskFilterChip: View {
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

struct TaskCard: View {
    let task: MaintenanceTask

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                // Priority indicator
                Circle()
                    .fill(priorityColor)
                    .frame(width: 10, height: 10)

                Text(task.title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(2)

                Spacer()

                TaskStateBadge(state: task.state)
            }

            // Description
            if let description = task.description {
                Text(description)
                    .font(.campBodySmall)
                    .foregroundColor(.campTextSecondary)
                    .lineLimit(2)
            }

            // Footer
            HStack(spacing: 16) {
                if let site = task.siteName {
                    Label(site, systemImage: "location")
                }

                Label(task.type.capitalized, systemImage: typeIcon)

                Spacer()

                if let assignee = task.assigneeName {
                    Label(assignee, systemImage: "person")
                }

                if let due = task.dueDate {
                    Label(formatDue(due), systemImage: "clock")
                        .foregroundColor(isDueUrgent(due) ? .campError : .campTextHint)
                }
            }
            .font(.campCaption)
            .foregroundColor(.campTextHint)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.campSurface)
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(task.priority == "urgent" ? Color.campError.opacity(0.5) : Color.clear, lineWidth: 2)
        )
    }

    private var priorityColor: Color {
        switch task.priority {
        case "urgent": return .campError
        case "high": return .campWarning
        case "normal": return .campInfo
        default: return .campTextHint
        }
    }

    private var typeIcon: String {
        switch task.type {
        case "repair": return "wrench.fill"
        case "cleaning": return "sparkles"
        case "inspection": return "eye.fill"
        default: return "wrench.and.screwdriver"
        }
    }

    private func formatDue(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) {
            return "Today"
        } else if Calendar.current.isDateInTomorrow(date) {
            return "Tomorrow"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }

    private func isDueUrgent(_ date: Date) -> Bool {
        date < Date() || Calendar.current.isDateInToday(date)
    }
}

struct TaskStateBadge: View {
    let state: String

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
        switch state {
        case "open": return "Open"
        case "in_progress": return "In Progress"
        case "completed": return "Done"
        default: return state.capitalized
        }
    }

    private var color: Color {
        switch state {
        case "open": return .campWarning
        case "in_progress": return .campInfo
        case "completed": return .campSuccess
        default: return .campTextSecondary
        }
    }
}

/// Task detail view
struct TaskDetailView: View {
    let task: MaintenanceTask
    @State private var isLoading = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header card
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Circle()
                            .fill(priorityColor)
                            .frame(width: 12, height: 12)
                        Text(task.priority.capitalized)
                            .font(.campCaption)
                            .foregroundColor(priorityColor)
                        Spacer()
                        TaskStateBadge(state: task.state)
                    }

                    Text(task.title)
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)

                    if let description = task.description {
                        Text(description)
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.campSurface)
                .cornerRadius(16)

                // Details grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    if let site = task.siteName {
                        DetailCard(icon: "location.fill", label: "Location", value: site)
                    }
                    DetailCard(icon: "tag.fill", label: "Type", value: task.type.capitalized)
                    if let assignee = task.assigneeName {
                        DetailCard(icon: "person.fill", label: "Assigned To", value: assignee)
                    }
                    if let due = task.dueDate {
                        DetailCard(icon: "calendar", label: "Due Date", value: formatDate(due))
                    }
                    DetailCard(icon: "clock.fill", label: "Created", value: formatDate(task.createdAt))
                }

                // Action buttons
                VStack(spacing: 12) {
                    switch task.state {
                    case "open":
                        PrimaryButton("Start Task", icon: "play.fill") {
                            // Update state
                        }
                        SecondaryButton("Assign to Me") {
                            // Assign
                        }
                    case "in_progress":
                        PrimaryButton("Mark Complete", icon: "checkmark.circle.fill") {
                            // Complete
                        }
                    default:
                        EmptyView()
                    }
                }
                .padding(.top, 8)
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var priorityColor: Color {
        switch task.priority {
        case "urgent": return .campError
        case "high": return .campWarning
        case "normal": return .campInfo
        default: return .campTextHint
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct DetailCard: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .foregroundColor(.campPrimary)
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
        .background(Color.campSurface)
        .cornerRadius(10)
    }
}

/// New task creation view
struct NewTaskView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var type = "maintenance"
    @State private var priority = "normal"
    @State private var siteName = ""
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Task Details") {
                    TextField("Title", text: $title)

                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)

                    Picker("Type", selection: $type) {
                        Text("Maintenance").tag("maintenance")
                        Text("Cleaning").tag("cleaning")
                        Text("Inspection").tag("inspection")
                        Text("Repair").tag("repair")
                    }

                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Normal").tag("normal")
                        Text("High").tag("high")
                        Text("Urgent").tag("urgent")
                    }
                }

                Section("Location") {
                    TextField("Site Name (optional)", text: $siteName)
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createTask() }
                    }
                    .disabled(title.isEmpty || isLoading)
                }
            }
        }
    }

    private func createTask() async {
        isLoading = true
        try? await Task.sleep(for: .seconds(1))
        isLoading = false
        dismiss()
    }
}
