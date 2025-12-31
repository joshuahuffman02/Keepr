import SwiftUI
import CampreservUI

/// Admin login view
struct AdminAuthView: View {

    @EnvironmentObject private var appState: AdminAppState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo and welcome
                    VStack(spacing: 16) {
                        Image(systemName: "chart.bar.doc.horizontal")
                            .font(.system(size: 64))
                            .foregroundColor(.campPrimary)

                        Text("Admin Dashboard")
                            .font(.campDisplayMedium)
                            .foregroundColor(.campTextPrimary)

                        Text("Sign in to access reports and analytics.")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 48)

                    // Login form
                    VStack(spacing: 16) {
                        FormField(
                            label: "Email",
                            placeholder: "admin@campground.com",
                            text: $email,
                            keyboardType: .emailAddress,
                            autocapitalization: .never
                        )

                        FormField(
                            label: "Password",
                            placeholder: "Enter your password",
                            text: $password,
                            isSecure: true
                        )

                        if let error = error {
                            InlineError(message: error) {
                                self.error = nil
                            }
                        }

                        PrimaryButton(
                            "Sign In",
                            icon: "arrow.right",
                            isLoading: isLoading
                        ) {
                            Task { await login() }
                        }
                        .disabled(email.isEmpty || password.isEmpty)
                    }

                    Spacer()
                }
                .padding(24)
            }
            .background(Color.campBackground)
        }
    }

    private func login() async {
        guard !email.isEmpty, !password.isEmpty else { return }

        isLoading = true
        error = nil

        do {
            try await appState.login(
                email: email.lowercased().trimmingCharacters(in: .whitespaces),
                password: password,
                deviceId: UIDevice.current.identifierForVendor?.uuidString
            )
        } catch {
            self.error = "Invalid email or password. Please try again."
        }

        isLoading = false
    }
}

/// Campground selector
struct AdminCampgroundSelectorView: View {

    @EnvironmentObject private var appState: AdminAppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Select Campground")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)

                Text("Choose which campground to view.")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
                    .multilineTextAlignment(.center)

                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(appState.campgrounds, id: \.id) { campground in
                            Button {
                                appState.selectCampground(campground)
                            } label: {
                                HStack {
                                    Image(systemName: "tent.fill")
                                        .foregroundColor(.campPrimary)
                                        .font(.system(size: 24))

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(campground.name)
                                            .font(.campLabel)
                                            .foregroundColor(.campTextPrimary)

                                        if let city = campground.city, let state = campground.state {
                                            Text("\(city), \(state)")
                                                .font(.campCaption)
                                                .foregroundColor(.campTextSecondary)
                                        }
                                    }

                                    Spacer()

                                    Image(systemName: "chevron.right")
                                        .foregroundColor(.campTextHint)
                                }
                                .padding(16)
                                .background(Color.campSurface)
                                .cornerRadius(12)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Spacer()

                SecondaryButton("Sign Out") {
                    Task { await appState.logout() }
                }
            }
            .padding(24)
            .background(Color.campBackground)
        }
    }
}
