import SwiftUI
import CampreservUI

/// Authentication view with magic link flow
struct AuthView: View {

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var showMagicLinkSent = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo and welcome
                    VStack(spacing: 16) {
                        Image(systemName: "tent.fill")
                            .font(.system(size: 64))
                            .foregroundColor(.campPrimary)

                        Text("Welcome to Campreserv")
                            .font(.campDisplayMedium)
                            .foregroundColor(.campTextPrimary)

                        Text("Sign in with your email to access your reservations and book your next adventure.")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 48)

                    // Email input
                    VStack(spacing: 16) {
                        FormField(
                            label: "Email",
                            placeholder: "you@example.com",
                            text: $email,
                            errorMessage: error,
                            keyboardType: .emailAddress,
                            autocapitalization: .never
                        ) {
                            Task { await requestMagicLink() }
                        }

                        PrimaryButton(
                            "Continue with Email",
                            icon: "envelope",
                            isLoading: isLoading
                        ) {
                            Task { await requestMagicLink() }
                        }
                        .disabled(email.isEmpty)
                    }

                    // Divider
                    HStack {
                        Rectangle()
                            .frame(height: 1)
                            .foregroundColor(.campBorder)
                        Text("or")
                            .font(.campCaption)
                            .foregroundColor(.campTextSecondary)
                        Rectangle()
                            .frame(height: 1)
                            .foregroundColor(.campBorder)
                    }

                    // Browse without account
                    SecondaryButton("Browse Campgrounds") {
                        dismiss()
                    }

                    Spacer()
                }
                .padding(24)
            }
            .background(Color.campBackground)
            .sheet(isPresented: $showMagicLinkSent) {
                MagicLinkSentView(email: email)
            }
        }
    }

    private func requestMagicLink() async {
        guard !email.isEmpty else { return }

        isLoading = true
        error = nil

        do {
            try await appState.requestMagicLink(email: email.lowercased().trimmingCharacters(in: .whitespaces))
            showMagicLinkSent = true
        } catch {
            self.error = "Failed to send magic link. Please try again."
        }

        isLoading = false
    }
}

/// Confirmation view after magic link is sent
struct MagicLinkSentView: View {

    let email: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "envelope.badge.fill")
                .font(.system(size: 64))
                .foregroundColor(.campPrimary)

            VStack(spacing: 8) {
                Text("Check Your Email")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)

                Text("We sent a magic link to")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)

                Text(email)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
            }

            Text("Click the link in the email to sign in. The link expires in 15 minutes.")
                .font(.campBodySmall)
                .foregroundColor(.campTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Spacer()

            SecondaryButton("Done") {
                dismiss()
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color.campBackground)
    }
}

#Preview {
    AuthView()
        .environmentObject(AppState())
}
