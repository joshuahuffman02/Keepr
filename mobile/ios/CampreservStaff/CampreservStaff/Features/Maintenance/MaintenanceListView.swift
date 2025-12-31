import SwiftUI
import CampreservCore
import CampreservUI

/// Maintenance tasks list
struct MaintenanceListView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var tasks: [MaintenanceTask] = []
    @State private var isLoading = true
    @State private var selectedFilter: TaskFilter = .open
    @State private var showNewTask = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter tabs
                filterTabs

                // Content
                if isLoading {
                    LoadingView(message: "Loading tasks...")
                } else if filteredTasks.isEmpty {
                    EmptyStateView(
                        icon: "checkmark.circle",
                        title: "All Clear",
                        message: selectedFilter.emptyMessage,
                        actionTitle: "Create Task"
                    ) {
                        showNewTask = true
                    }
                } else {
                    tasksList
                }
            }
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
                    FilterChip(
                        title: filter.title,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                    }
                }
            }
            .padding()
        }
    }

    private var tasksList: some View {
        List {
            ForEach(filteredTasks, id: \.id) { task in
                NavigationLink(destination: TaskDetailView(task: task)) {
                    TaskRow(task: task)
                }
            }
        }
        .listStyle(.plain)
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

        // Call API
        try? await Task.sleep(for: .seconds(1))
        tasks = []
    }
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

struct TaskRow: View {
    let task: MaintenanceTask

    var body: some View {
        HStack(spacing: 12) {
            // Priority indicator
            Circle()
                .fill(priorityColor)
                .frame(width: 12, height: 12)

            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                HStack(spacing: 8) {
                    if let site = task.siteName {
                        Label(site, systemImage: "location")
                    }
                    Text(task.type.capitalized)
                }
                .font(.campCaption)
                .foregroundColor(.campTextSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                TaskStateBadge(state: task.state)

                if let assignee = task.assigneeName {
                    Text(assignee)
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                }
            }
        }
        .padding(.vertical, 8)
    }

    private var priorityColor: Color {
        switch task.priority {
        case "urgent": return .campError
        case "high": return .campWarning
        case "normal": return .campInfo
        default: return .campTextHint
        }
    }
}

struct TaskStateBadge: View {
    let state: String

    var body: some View {
        Text(displayText)
            .font(.campLabelSmall)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .cornerRadius(4)
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

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text(task.title)
                                .font(.campHeading2)
                            Spacer()
                            TaskStateBadge(state: task.state)
                        }

                        if let description = task.description {
                            Text(description)
                                .font(.campBody)
                                .foregroundColor(.campTextSecondary)
                        }

                        Divider()

                        // Details
                        VStack(spacing: 8) {
                            if let site = task.siteName {
                                DetailRow(label: "Location", value: site)
                            }
                            DetailRow(label: "Type", value: task.type.capitalized)
                            DetailRow(label: "Priority", value: task.priority.capitalized)
                            if let assignee = task.assigneeName {
                                DetailRow(label: "Assigned To", value: assignee)
                            }
                            if let due = task.dueDate {
                                DetailRow(label: "Due Date", value: formatDate(due))
                            }
                        }
                    }
                }

                // Action buttons
                actionButtons
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            switch task.state {
            case "open":
                PrimaryButton("Start Task", icon: "play.fill") {
                    Task { await updateState("in_progress") }
                }
            case "in_progress":
                PrimaryButton("Mark Complete", icon: "checkmark") {
                    Task { await updateState("completed") }
                }
            default:
                EmptyView()
            }
        }
    }

    private func updateState(_ newState: String) async {
        isLoading = true
        // Call API
        try? await Task.sleep(for: .seconds(1))
        isLoading = false
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
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
        // Call API
        try? await Task.sleep(for: .seconds(1))
        isLoading = false
        dismiss()
    }
}
