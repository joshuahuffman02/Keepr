import SwiftUI
import CampreservUI

/// Staff login view
struct StaffAuthView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var useBiometrics = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo and welcome
                    VStack(spacing: 16) {
                        Image(systemName: "person.badge.key")
                            .font(.system(size: 64))
                            .foregroundColor(.campPrimary)

                        Text("Staff Login")
                            .font(.campDisplayMedium)
                            .foregroundColor(.campTextPrimary)

                        Text("Sign in to access campground operations.")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 48)

                    // Login form
                    VStack(spacing: 16) {
                        FormField(
                            label: "Email",
                            placeholder: "staff@campground.com",
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

                    // Biometrics toggle
                    Toggle(isOn: $useBiometrics) {
                        HStack {
                            Image(systemName: "faceid")
                                .foregroundColor(.campPrimary)
                            Text("Use Face ID for future logins")
                                .font(.campBody)
                        }
                    }
                    .tint(.campPrimary)

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

/// Campground selector for multi-campground users
struct CampgroundSelectorView: View {

    @EnvironmentObject private var appState: StaffAppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Select Campground")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)

                Text("Choose which campground you want to manage.")
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

#Preview {
    StaffAuthView()
        .environmentObject(StaffAppState())
}
