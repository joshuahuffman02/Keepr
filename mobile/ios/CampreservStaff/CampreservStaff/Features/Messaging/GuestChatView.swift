import SwiftUI
import CampreservCore
import CampreservUI

/// Chat view for guest conversations
struct GuestChatView: View {

    let conversation: GuestConversation
    @State private var messageText = ""
    @State private var messages: [ChatMessage] = []
    @State private var showGuestInfo = false
    @FocusState private var isTextFieldFocused: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Guest info header
            guestInfoHeader

            // Messages list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messages) { message in
                            MessageBubbleView(message: message)
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
        .navigationTitle(conversation.guestName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showGuestInfo = true
                } label: {
                    Image(systemName: "info.circle")
                }
            }
        }
        .sheet(isPresented: $showGuestInfo) {
            GuestInfoSheet(conversation: conversation)
        }
        .onAppear {
            messages = conversation.messages
        }
    }

    // MARK: - Guest Info Header

    private var guestInfoHeader: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Reservation status
                VStack(alignment: .leading, spacing: 2) {
                    Text(conversation.siteName)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    HStack(spacing: 8) {
                        ConversationStatusBadge(status: conversation.status)
                        Text(formatDateRange())
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)
                    }
                }

                Spacer()

                // Quick actions
                HStack(spacing: 12) {
                    if let phone = conversation.guestPhone {
                        Button {
                            if let url = URL(string: "tel:\(phone.filter { $0.isNumber })") {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            Image(systemName: "phone.fill")
                                .foregroundColor(.campPrimary)
                                .frame(width: 36, height: 36)
                                .background(Color.campPrimary.opacity(0.15))
                                .cornerRadius(18)
                        }
                    }
                }
            }
            .padding(16)
            .background(Color.campSurface)

            Divider()
        }
    }

    private func formatDateRange() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let start = formatter.string(from: conversation.arrivalDate)
        let end = formatter.string(from: conversation.departureDate)
        return "\(start) - \(end)"
    }

    // MARK: - Message Input

    private var messageInputBar: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 12) {
                // Text field
                TextField("Type a message...", text: $messageText, axis: .vertical)
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

        let newMessage = ChatMessage(
            id: UUID().uuidString,
            content: text,
            senderType: "staff",
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

// MARK: - Message Bubble

struct MessageBubbleView: View {
    let message: ChatMessage

    private var isStaff: Bool { message.senderType == "staff" }

    var body: some View {
        HStack {
            if isStaff { Spacer(minLength: 60) }

            VStack(alignment: isStaff ? .trailing : .leading, spacing: 4) {
                // Message content
                Text(message.content)
                    .font(.campBody)
                    .foregroundColor(isStaff ? .white : .campTextPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isStaff ? Color.campPrimary : Color.campSurface)
                    .cornerRadius(18)

                // Timestamp
                HStack(spacing: 4) {
                    Text(formatTime(message.sentAt))
                        .font(.system(size: 11))
                        .foregroundColor(.campTextHint)

                    if isStaff && message.isRead {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.campSuccess)
                    }
                }
            }

            if !isStaff { Spacer(minLength: 60) }
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Guest Info Sheet

struct GuestInfoSheet: View {
    let conversation: GuestConversation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Guest avatar and name
                    VStack(spacing: 12) {
                        Circle()
                            .fill(Color.campPrimary.opacity(0.15))
                            .frame(width: 80, height: 80)
                            .overlay(
                                Text(initials)
                                    .font(.system(size: 28, weight: .semibold))
                                    .foregroundColor(.campPrimary)
                            )

                        Text(conversation.guestName)
                            .font(.campHeading2)
                            .foregroundColor(.campTextPrimary)

                        ConversationStatusBadge(status: conversation.status)
                    }
                    .padding(.top, 20)

                    // Contact info
                    VStack(spacing: 12) {
                        if let email = conversation.guestEmail {
                            ContactRow(icon: "envelope.fill", label: "Email", value: email) {
                                if let url = URL(string: "mailto:\(email)") {
                                    UIApplication.shared.open(url)
                                }
                            }
                        }

                        if let phone = conversation.guestPhone {
                            ContactRow(icon: "phone.fill", label: "Phone", value: phone) {
                                if let url = URL(string: "tel:\(phone.filter { $0.isNumber })") {
                                    UIApplication.shared.open(url)
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(Color.campSurface)
                    .cornerRadius(16)

                    // Reservation info
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Reservation")
                            .font(.campLabel)
                            .foregroundColor(.campTextPrimary)

                        VStack(spacing: 12) {
                            InfoRow(label: "Site", value: conversation.siteName)
                            InfoRow(label: "Check-in", value: formatDate(conversation.arrivalDate))
                            InfoRow(label: "Check-out", value: formatDate(conversation.departureDate))
                        }
                    }
                    .padding(16)
                    .background(Color.campSurface)
                    .cornerRadius(16)

                    // Quick actions
                    VStack(spacing: 12) {
                        NavigationLink(destination: Text("View Reservation")) {
                            HStack {
                                Image(systemName: "calendar")
                                    .foregroundColor(.campPrimary)
                                Text("View Reservation")
                                    .foregroundColor(.campTextPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.campTextHint)
                            }
                            .font(.campLabel)
                            .padding(16)
                            .background(Color.campSurface)
                            .cornerRadius(12)
                        }

                        Button {
                            // Send SMS
                        } label: {
                            HStack {
                                Image(systemName: "message.fill")
                                    .foregroundColor(.campPrimary)
                                Text("Send SMS")
                                    .foregroundColor(.campTextPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundColor(.campTextHint)
                            }
                            .font(.campLabel)
                            .padding(16)
                            .background(Color.campSurface)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding(16)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle("Guest Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var initials: String {
        let parts = conversation.guestName.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(conversation.guestName.prefix(2))
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d, yyyy"
        return formatter.string(from: date)
    }
}

struct ContactRow: View {
    let icon: String
    let label: String
    let value: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(.campPrimary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                    Text(value)
                        .font(.campLabel)
                        .foregroundColor(.campPrimary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(.campTextHint)
            }
        }
    }
}

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.campCaption)
                .foregroundColor(.campTextHint)
            Spacer()
            Text(value)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)
        }
    }
}
