import SwiftUI
import CampreservCore
import CampreservUI

/// List of message threads (one per reservation)
struct MessagesListView: View {

    @State private var threads: [MessageThread] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    LoadingView(message: "Loading messages...")
                } else if threads.isEmpty {
                    EmptyStateView(
                        icon: "message",
                        title: "No Messages",
                        message: "When you have an active reservation, you can message the campground here."
                    )
                } else {
                    List(threads, id: \.reservationId) { thread in
                        NavigationLink(destination: MessageThreadView(thread: thread)) {
                            MessageThreadRow(thread: thread)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color.campBackground)
            .navigationTitle("Messages")
        }
        .task {
            await loadThreads()
        }
    }

    private func loadThreads() async {
        isLoading = true
        defer { isLoading = false }

        // In a real app, this would aggregate messages by reservation
        threads = []
    }
}

/// Simple message thread model
struct MessageThread: Identifiable {
    var id: String { reservationId }
    let reservationId: String
    let campgroundName: String
    let siteName: String
    let lastMessage: String
    let lastMessageDate: Date
    let unreadCount: Int
}

/// Row for a message thread
struct MessageThreadRow: View {

    let thread: MessageThread

    var body: some View {
        HStack(spacing: 12) {
            // Campground avatar
            Circle()
                .fill(Color.campPrimary.opacity(0.1))
                .frame(width: 48, height: 48)
                .overlay(
                    Image(systemName: "tent.fill")
                        .foregroundColor(.campPrimary)
                )

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(thread.campgroundName)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    Spacer()

                    Text(formatDate(thread.lastMessageDate))
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)
                }

                Text(thread.siteName)
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)

                Text(thread.lastMessage)
                    .font(.campBodySmall)
                    .foregroundColor(.campTextSecondary)
                    .lineLimit(1)
            }

            if thread.unreadCount > 0 {
                Circle()
                    .fill(Color.campPrimary)
                    .frame(width: 20, height: 20)
                    .overlay(
                        Text("\(thread.unreadCount)")
                            .font(.campBadge)
                            .foregroundColor(.white)
                    )
            }
        }
        .padding(.vertical, 8)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

/// Thread detail with messages
struct MessageThreadView: View {

    let thread: MessageThread
    @State private var messages: [Message] = []
    @State private var newMessage = ""
    @State private var isLoading = true
    @State private var isSending = false

    var body: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(messages, id: \.id) { message in
                            MessageBubble(message: message)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.count) { _ in
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            // Compose area
            composeBar
        }
        .background(Color.campBackground)
        .navigationTitle(thread.campgroundName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadMessages()
        }
    }

    private var composeBar: some View {
        HStack(spacing: 12) {
            TextField("Type a message...", text: $newMessage, axis: .vertical)
                .textFieldStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.campSurface)
                .cornerRadius(24)
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(Color.campBorder, lineWidth: 1)
                )
                .lineLimit(1...5)

            Button {
                Task { await sendMessage() }
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(newMessage.isEmpty ? .campDisabled : .campPrimary)
            }
            .disabled(newMessage.isEmpty || isSending)
        }
        .padding(12)
        .background(Color.campSurface)
    }

    private func loadMessages() async {
        isLoading = true
        defer { isLoading = false }

        // In a real app, this would call the API
        messages = []
    }

    private func sendMessage() async {
        guard !newMessage.isEmpty else { return }

        isSending = true
        let content = newMessage
        newMessage = ""

        do {
            // Call API
            // try await apiClient.request(.sendMessage(reservationId: thread.reservationId, content: content))

            // Add optimistic message
            let message = Message(
                id: UUID().uuidString,
                reservationId: thread.reservationId,
                content: content,
                isFromGuest: true,
                sentAt: Date()
            )
            messages.append(message)
        } catch {
            // Handle error, restore message
            newMessage = content
        }

        isSending = false
    }
}

/// Simple message model
struct Message: Identifiable {
    let id: String
    let reservationId: String
    let content: String
    let isFromGuest: Bool
    let sentAt: Date
}

/// Message bubble
struct MessageBubble: View {

    let message: Message

    var body: some View {
        HStack {
            if message.isFromGuest { Spacer(minLength: 48) }

            VStack(alignment: message.isFromGuest ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.campBody)
                    .foregroundColor(message.isFromGuest ? .white : .campTextPrimary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(message.isFromGuest ? Color.campPrimary : Color.campSurface)
                    .cornerRadius(20)

                Text(formatTime(message.sentAt))
                    .font(.campCaption)
                    .foregroundColor(.campTextHint)
            }

            if !message.isFromGuest { Spacer(minLength: 48) }
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
