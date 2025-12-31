import SwiftUI
import CampreservCore
import CampreservUI

/// Chat view for team conversations (channels and DMs)
struct TeamChatView: View {

    let conversation: TeamConversation
    @State private var messageText = ""
    @State private var messages: [TeamChatMessage] = []
    @State private var showParticipants = false
    @FocusState private var isTextFieldFocused: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Channel/DM header
            if conversation.type == .channel {
                channelHeader
            }

            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(messages) { message in
                            TeamMessageBubbleView(message: message)
                                .id(message.id)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.count) { _ in
                    if let lastMessage = messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }

            // Message input
            messageInputBar
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
        .navigationTitle(conversation.type == .channel ? "#\(conversation.name)" : conversation.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showParticipants = true
                } label: {
                    Image(systemName: "person.2")
                }
            }
        }
        .sheet(isPresented: $showParticipants) {
            ParticipantsSheet(conversation: conversation)
        }
        .onAppear {
            messages = conversation.messages
        }
    }

    // MARK: - Channel Header

    private var channelHeader: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Channel info
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(conversation.participants.count) members")
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }

                Spacer()

                // Member avatars
                HStack(spacing: -8) {
                    ForEach(conversation.participants.prefix(3)) { member in
                        Circle()
                            .fill(Color.campInfo.opacity(0.2))
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text(member.initials)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.campInfo)
                            )
                            .overlay(
                                Circle()
                                    .stroke(Color.campSurface, lineWidth: 2)
                            )
                    }

                    if conversation.participants.count > 3 {
                        Circle()
                            .fill(Color.campTextHint.opacity(0.2))
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text("+\(conversation.participants.count - 3)")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.campTextHint)
                            )
                            .overlay(
                                Circle()
                                    .stroke(Color.campSurface, lineWidth: 2)
                            )
                    }
                }
            }
            .padding(16)
            .background(Color.campSurface)

            Divider()
        }
    }

    // MARK: - Message Input

    private var messageInputBar: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 12) {
                // Text field
                TextField("Message \(conversation.type == .channel ? "#\(conversation.name)" : conversation.name)...", text: $messageText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...4)
                    .padding(12)
                    .background(Color.campBackground)
                    .cornerRadius(20)
                    .focused($isTextFieldFocused)

                // Send button
                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .campTextHint : .campPrimary)
                }
                .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(12)
            .background(Color.campSurface)
        }
    }

    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        let newMessage = TeamChatMessage(
            id: UUID().uuidString,
            content: text,
            senderName: "You",
            sentAt: Date(),
            isRead: true
        )

        messages.append(newMessage)
        messageText = ""

        // Dismiss keyboard
        isTextFieldFocused = false

        // Would send to API here
    }
}

// MARK: - Team Message Bubble

struct TeamMessageBubbleView: View {
    let message: TeamChatMessage

    private var isCurrentUser: Bool { message.senderName == "You" }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if !isCurrentUser {
                // Avatar
                Circle()
                    .fill(avatarColor)
                    .frame(width: 36, height: 36)
                    .overlay(
                        Text(initials)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                    )
            }

            VStack(alignment: isCurrentUser ? .trailing : .leading, spacing: 4) {
                if !isCurrentUser {
                    // Sender name
                    Text(message.senderName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.campTextSecondary)
                }

                // Message content
                Text(message.content)
                    .font(.campBody)
                    .foregroundColor(isCurrentUser ? .white : .campTextPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isCurrentUser ? Color.campPrimary : Color.campSurface)
                    .cornerRadius(16)

                // Timestamp
                Text(formatTime(message.sentAt))
                    .font(.system(size: 11))
                    .foregroundColor(.campTextHint)
            }

            if isCurrentUser {
                // Avatar for current user
                Circle()
                    .fill(Color.campPrimary.opacity(0.2))
                    .frame(width: 36, height: 36)
                    .overlay(
                        Text("You")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.campPrimary)
                    )
            }
        }
        .frame(maxWidth: .infinity, alignment: isCurrentUser ? .trailing : .leading)
    }

    private var initials: String {
        let parts = message.senderName.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(message.senderName.prefix(2))
    }

    private var avatarColor: Color {
        // Generate consistent color based on name
        let colors: [Color] = [.campPrimary, .campInfo, .campSuccess, .campWarning]
        let index = abs(message.senderName.hashValue) % colors.count
        return colors[index]
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Participants Sheet

struct ParticipantsSheet: View {
    let conversation: TeamConversation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(conversation.participants) { member in
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.campInfo.opacity(0.2))
                            .frame(width: 44, height: 44)
                            .overlay(
                                Text(member.initials)
                                    .font(.campLabel)
                                    .foregroundColor(.campInfo)
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(member.fullName)
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)

                            Text(member.role)
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }

                        Spacer()
                    }
                    .padding(.vertical, 4)
                }
            }
            .listStyle(.plain)
            .navigationTitle(conversation.type == .channel ? "#\(conversation.name)" : "Conversation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
