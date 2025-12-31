import SwiftUI
import CampreservCore
import CampreservUI

// MARK: - Main Messages View

/// Full messaging system with guest conversations and team chat
struct MessagesView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var selectedTab = 0
    @State private var guestConversations: [GuestConversation] = []
    @State private var teamConversations: [TeamConversation] = []
    @State private var isLoading = true
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab selector
                Picker("Messages", selection: $selectedTab) {
                    Text("Guests").tag(0)
                    Text("Team").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(16)

                // Search bar
                searchBar

                // Content
                if selectedTab == 0 {
                    guestMessagesContent
                } else {
                    teamMessagesContent
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle("Messages")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            // New message to guest
                        } label: {
                            Label("Message Guest", systemImage: "person")
                        }
                        Button {
                            // New team DM
                        } label: {
                            Label("New Team Chat", systemImage: "person.2")
                        }
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                }
            }
            .refreshable {
                await loadMessages()
            }
        }
        .task {
            await loadMessages()
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.campTextHint)
            TextField("Search conversations...", text: $searchText)
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
        .padding(.bottom, 12)
    }

    // MARK: - Guest Messages

    private var guestMessagesContent: some View {
        Group {
            if isLoading {
                Spacer()
                LoadingView(message: "Loading messages...")
                Spacer()
            } else if filteredGuestConversations.isEmpty {
                Spacer()
                EmptyStateView(
                    icon: "message",
                    title: "No Messages",
                    message: "Guest messages will appear here when guests send inquiries or you start a conversation.",
                    actionTitle: nil
                ) { }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Needs reply section
                        let needsReply = filteredGuestConversations.filter { $0.needsReply }
                        if !needsReply.isEmpty {
                            SectionHeader(title: "Needs Reply", count: needsReply.count, color: .campWarning)
                            ForEach(needsReply) { conversation in
                                NavigationLink(destination: GuestChatView(conversation: conversation)) {
                                    GuestConversationRow(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        // All conversations
                        let others = filteredGuestConversations.filter { !$0.needsReply }
                        if !others.isEmpty {
                            SectionHeader(title: "All Conversations", count: others.count, color: .campTextSecondary)
                            ForEach(others) { conversation in
                                NavigationLink(destination: GuestChatView(conversation: conversation)) {
                                    GuestConversationRow(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
    }

    private var filteredGuestConversations: [GuestConversation] {
        if searchText.isEmpty {
            return guestConversations
        }
        return guestConversations.filter { conversation in
            conversation.guestName.localizedCaseInsensitiveContains(searchText) ||
            conversation.siteName.localizedCaseInsensitiveContains(searchText) ||
            (conversation.lastMessagePreview?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    // MARK: - Team Messages

    private var teamMessagesContent: some View {
        Group {
            if isLoading {
                Spacer()
                LoadingView(message: "Loading team chat...")
                Spacer()
            } else if teamConversations.isEmpty {
                Spacer()
                EmptyStateView(
                    icon: "person.2",
                    title: "No Team Chats",
                    message: "Start a conversation with your team members.",
                    actionTitle: "New Chat"
                ) { }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        // Channels
                        let channels = teamConversations.filter { $0.type == .channel }
                        if !channels.isEmpty {
                            SectionHeader(title: "Channels", count: channels.count, color: .campPrimary)
                            ForEach(channels) { conversation in
                                NavigationLink(destination: TeamChatView(conversation: conversation)) {
                                    TeamConversationRow(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        // Direct Messages
                        let dms = teamConversations.filter { $0.type == .dm }
                        if !dms.isEmpty {
                            SectionHeader(title: "Direct Messages", count: dms.count, color: .campTextSecondary)
                            ForEach(dms) { conversation in
                                NavigationLink(destination: TeamChatView(conversation: conversation)) {
                                    TeamConversationRow(conversation: conversation)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadMessages() async {
        isLoading = true
        defer { isLoading = false }

        try? await Task.sleep(for: .seconds(0.5))

        // Load demo data
        guestConversations = GuestConversation.samples
        teamConversations = TeamConversation.samples
    }
}

// MARK: - Section Header

struct SectionHeader: View {
    let title: String
    let count: Int
    let color: Color

    var body: some View {
        HStack {
            Text(title)
                .font(.campCaption)
                .foregroundColor(.campTextHint)

            if count > 0 {
                Text("\(count)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(color)
                    .cornerRadius(10)
            }

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.campBackground)
    }
}

// MARK: - Guest Conversation Models

struct GuestConversation: Identifiable {
    let id: String
    let reservationId: String
    let guestName: String
    let guestEmail: String?
    let guestPhone: String?
    let siteName: String
    let status: String
    let arrivalDate: Date
    let departureDate: Date
    let lastMessagePreview: String?
    let lastMessageTime: Date?
    let lastMessageSender: String // "guest" or "staff"
    let unreadCount: Int
    let needsReply: Bool
    let messages: [ChatMessage]

    static let samples: [GuestConversation] = {
        let today = Date()
        let calendar = Calendar.current

        return [
            GuestConversation(
                id: "conv-1",
                reservationId: "res-1",
                guestName: "Michael Johnson",
                guestEmail: "michael.j@email.com",
                guestPhone: "(555) 123-4567",
                siteName: "Site 15",
                status: "checked_in",
                arrivalDate: calendar.date(byAdding: .day, value: -1, to: today)!,
                departureDate: calendar.date(byAdding: .day, value: 2, to: today)!,
                lastMessagePreview: "Is there a place to get firewood?",
                lastMessageTime: today.addingTimeInterval(-1800),
                lastMessageSender: "guest",
                unreadCount: 1,
                needsReply: true,
                messages: [
                    ChatMessage(id: "m1", content: "Hi! We just checked in to Site 15. Beautiful spot!", senderType: "guest", senderName: "Michael Johnson", sentAt: today.addingTimeInterval(-7200), isRead: true),
                    ChatMessage(id: "m2", content: "Welcome to Pines Campground! Let us know if you need anything.", senderType: "staff", senderName: "You", sentAt: today.addingTimeInterval(-6000), isRead: true),
                    ChatMessage(id: "m3", content: "Is there a place to get firewood?", senderType: "guest", senderName: "Michael Johnson", sentAt: today.addingTimeInterval(-1800), isRead: false)
                ]
            ),
            GuestConversation(
                id: "conv-2",
                reservationId: "res-2",
                guestName: "Sarah Williams",
                guestEmail: "sarah.w@email.com",
                guestPhone: "(555) 234-5678",
                siteName: "Cabin 3",
                status: "confirmed",
                arrivalDate: today,
                departureDate: calendar.date(byAdding: .day, value: 2, to: today)!,
                lastMessagePreview: "What time is check-in?",
                lastMessageTime: today.addingTimeInterval(-3600),
                lastMessageSender: "guest",
                unreadCount: 2,
                needsReply: true,
                messages: [
                    ChatMessage(id: "m4", content: "Hi, I'm arriving today for our cabin reservation. What time is check-in?", senderType: "guest", senderName: "Sarah Williams", sentAt: today.addingTimeInterval(-3600), isRead: false),
                    ChatMessage(id: "m5", content: "Also, do you allow early check-in? We'll be arriving around noon.", senderType: "guest", senderName: "Sarah Williams", sentAt: today.addingTimeInterval(-3500), isRead: false)
                ]
            ),
            GuestConversation(
                id: "conv-3",
                reservationId: "res-3",
                guestName: "Robert Chen",
                guestEmail: "robert.c@email.com",
                guestPhone: "(555) 345-6789",
                siteName: "Site 22",
                status: "checked_in",
                arrivalDate: calendar.date(byAdding: .day, value: -2, to: today)!,
                departureDate: calendar.date(byAdding: .day, value: 1, to: today)!,
                lastMessagePreview: "Thanks for the help!",
                lastMessageTime: today.addingTimeInterval(-86400),
                lastMessageSender: "guest",
                unreadCount: 0,
                needsReply: false,
                messages: [
                    ChatMessage(id: "m6", content: "Could you help with our electric hookup? It seems to not be working.", senderType: "guest", senderName: "Robert Chen", sentAt: today.addingTimeInterval(-90000), isRead: true),
                    ChatMessage(id: "m7", content: "Of course! I'll send maintenance right over. Should be about 10 minutes.", senderType: "staff", senderName: "You", sentAt: today.addingTimeInterval(-89000), isRead: true),
                    ChatMessage(id: "m8", content: "Thanks for the help!", senderType: "guest", senderName: "Robert Chen", sentAt: today.addingTimeInterval(-86400), isRead: true)
                ]
            ),
            GuestConversation(
                id: "conv-4",
                reservationId: "res-5",
                guestName: "James Wilson",
                guestEmail: "james.w@email.com",
                guestPhone: "(555) 567-8901",
                siteName: "Site 8",
                status: "checked_in",
                arrivalDate: calendar.date(byAdding: .day, value: -4, to: today)!,
                departureDate: today,
                lastMessagePreview: "Sure, I'll stop by before we leave.",
                lastMessageTime: today.addingTimeInterval(-7200),
                lastMessageSender: "guest",
                unreadCount: 0,
                needsReply: false,
                messages: [
                    ChatMessage(id: "m9", content: "Hi James, just a reminder that check-out is at 11am today. We noticed there's a balance of $70 on your account from yesterday's firewood purchase.", senderType: "staff", senderName: "You", sentAt: today.addingTimeInterval(-10800), isRead: true),
                    ChatMessage(id: "m10", content: "Sure, I'll stop by before we leave.", senderType: "guest", senderName: "James Wilson", sentAt: today.addingTimeInterval(-7200), isRead: true)
                ]
            )
        ]
    }()
}

struct ChatMessage: Identifiable {
    let id: String
    let content: String
    let senderType: String // "guest" or "staff"
    let senderName: String
    let sentAt: Date
    let isRead: Bool
}

// MARK: - Team Conversation Models

struct TeamConversation: Identifiable {
    let id: String
    let name: String
    let type: ConversationType
    let participants: [TeamMember]
    let lastMessagePreview: String?
    let lastMessageTime: Date?
    let lastMessageSender: String?
    let unreadCount: Int
    let messages: [TeamChatMessage]

    enum ConversationType {
        case channel
        case dm
    }

    static let samples: [TeamConversation] = {
        let today = Date()

        return [
            TeamConversation(
                id: "team-1",
                name: "general",
                type: .channel,
                participants: TeamMember.allStaff,
                lastMessagePreview: "Morning team! Beautiful day today.",
                lastMessageTime: today.addingTimeInterval(-1800),
                lastMessageSender: "Mike",
                unreadCount: 3,
                messages: [
                    TeamChatMessage(id: "tm1", content: "Good morning everyone!", senderName: "Sarah", sentAt: today.addingTimeInterval(-7200), isRead: true),
                    TeamChatMessage(id: "tm2", content: "Morning team! Beautiful day today.", senderName: "Mike", sentAt: today.addingTimeInterval(-1800), isRead: false)
                ]
            ),
            TeamConversation(
                id: "team-2",
                name: "maintenance",
                type: .channel,
                participants: [TeamMember.allStaff[1], TeamMember.allStaff[2]],
                lastMessagePreview: "Site 22 hookup fixed",
                lastMessageTime: today.addingTimeInterval(-86400),
                lastMessageSender: "Mike",
                unreadCount: 0,
                messages: [
                    TeamChatMessage(id: "tm3", content: "Site 22 hookup fixed", senderName: "Mike", sentAt: today.addingTimeInterval(-86400), isRead: true)
                ]
            ),
            TeamConversation(
                id: "team-3",
                name: "Sarah Thompson",
                type: .dm,
                participants: [TeamMember.allStaff[0]],
                lastMessagePreview: "Can you cover my shift tomorrow?",
                lastMessageTime: today.addingTimeInterval(-3600),
                lastMessageSender: "Sarah",
                unreadCount: 1,
                messages: [
                    TeamChatMessage(id: "tm4", content: "Hey, can you cover my shift tomorrow?", senderName: "Sarah", sentAt: today.addingTimeInterval(-3600), isRead: false)
                ]
            )
        ]
    }()
}

struct TeamMember: Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let role: String

    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }

    static let allStaff: [TeamMember] = [
        TeamMember(id: "staff-1", firstName: "Sarah", lastName: "Thompson", role: "Manager"),
        TeamMember(id: "staff-2", firstName: "Mike", lastName: "Rodriguez", role: "Maintenance"),
        TeamMember(id: "staff-3", firstName: "Lisa", lastName: "Chen", role: "Front Desk"),
        TeamMember(id: "staff-4", firstName: "David", lastName: "Kim", role: "Front Desk")
    ]
}

struct TeamChatMessage: Identifiable {
    let id: String
    let content: String
    let senderName: String
    let sentAt: Date
    let isRead: Bool
}

// MARK: - Row Components

struct GuestConversationRow: View {
    let conversation: GuestConversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar with status indicator
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.campPrimary.opacity(0.15))
                    .frame(width: 50, height: 50)
                    .overlay(
                        Text(initials)
                            .font(.campLabel)
                            .foregroundColor(.campPrimary)
                    )

                if conversation.needsReply {
                    Circle()
                        .fill(Color.campWarning)
                        .frame(width: 14, height: 14)
                        .overlay(
                            Image(systemName: "exclamationmark")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                        )
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(conversation.guestName)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                        .lineLimit(1)

                    Spacer()

                    if let time = conversation.lastMessageTime {
                        Text(formatTime(time))
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }

                HStack {
                    Text(conversation.siteName)
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)

                    Text("-")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    ConversationStatusBadge(status: conversation.status)
                }

                if let preview = conversation.lastMessagePreview {
                    HStack(spacing: 4) {
                        if conversation.lastMessageSender == "staff" {
                            Text("You:")
                                .font(.campCaption)
                                .foregroundColor(.campTextHint)
                        }
                        Text(preview)
                            .font(.campCaption)
                            .foregroundColor(conversation.unreadCount > 0 ? .campTextPrimary : .campTextSecondary)
                            .lineLimit(1)
                    }
                }
            }

            // Unread badge
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.campPrimary)
                    .cornerRadius(12)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(.campTextHint)
            }
        }
        .padding(16)
        .background(Color.campSurface)
    }

    private var initials: String {
        let parts = conversation.guestName.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(conversation.guestName.prefix(2))
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

struct ConversationStatusBadge: View {
    let status: String

    var body: some View {
        Text(displayText)
            .font(.system(size: 10, weight: .medium))
            .foregroundColor(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .cornerRadius(4)
    }

    private var displayText: String {
        switch status {
        case "confirmed": return "Arriving"
        case "checked_in": return "In House"
        case "checked_out": return "Departed"
        default: return status.capitalized
        }
    }

    private var color: Color {
        switch status {
        case "confirmed": return .campInfo
        case "checked_in": return .campSuccess
        case "checked_out": return .campTextSecondary
        default: return .campTextSecondary
        }
    }
}

struct TeamConversationRow: View {
    let conversation: TeamConversation

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(conversation.type == .channel ? Color.campPrimary.opacity(0.15) : Color.campInfo.opacity(0.15))
                    .frame(width: 50, height: 50)

                if conversation.type == .channel {
                    Image(systemName: "number")
                        .font(.system(size: 20))
                        .foregroundColor(.campPrimary)
                } else {
                    Text(participantInitials)
                        .font(.campLabel)
                        .foregroundColor(.campInfo)
                }
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    if conversation.type == .channel {
                        Text("#\(conversation.name)")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                    } else {
                        Text(conversation.name)
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)
                    }

                    Spacer()

                    if let time = conversation.lastMessageTime {
                        Text(formatTime(time))
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }

                if let preview = conversation.lastMessagePreview, let sender = conversation.lastMessageSender {
                    HStack(spacing: 4) {
                        Text("\(sender):")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                        Text(preview)
                            .font(.campCaption)
                            .foregroundColor(conversation.unreadCount > 0 ? .campTextPrimary : .campTextSecondary)
                            .lineLimit(1)
                    }
                }
            }

            // Unread badge
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.campPrimary)
                    .cornerRadius(12)
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(.campTextHint)
            }
        }
        .padding(16)
        .background(Color.campSurface)
    }

    private var participantInitials: String {
        guard let first = conversation.participants.first else { return "?" }
        return first.initials
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
