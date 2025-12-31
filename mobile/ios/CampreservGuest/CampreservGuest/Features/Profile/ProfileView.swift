import SwiftUI
import CampreservCore
import CampreservUI

/// User profile and settings
struct ProfileView: View {

    @EnvironmentObject private var appState: AppState
    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                // Profile header
                Section {
                    profileHeader
                }

                // Account section
                Section("Account") {
                    NavigationLink {
                        EditProfileView()
                    } label: {
                        Label("Edit Profile", systemImage: "person")
                    }

                    NavigationLink {
                        // Payment methods
                    } label: {
                        Label("Payment Methods", systemImage: "creditcard")
                    }

                    NavigationLink {
                        // Notifications
                    } label: {
                        Label("Notifications", systemImage: "bell")
                    }
                }

                // Support section
                Section("Support") {
                    NavigationLink {
                        // Help center
                    } label: {
                        Label("Help Center", systemImage: "questionmark.circle")
                    }

                    NavigationLink {
                        // Contact support
                    } label: {
                        Label("Contact Support", systemImage: "envelope")
                    }
                }

                // Legal section
                Section("Legal") {
                    NavigationLink {
                        // Terms
                    } label: {
                        Label("Terms of Service", systemImage: "doc.text")
                    }

                    NavigationLink {
                        // Privacy
                    } label: {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }
                }

                // Logout section
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }

                // App info
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundColor(.campTextSecondary)
                    }
                }
            }
            .navigationTitle("Profile")
            .confirmationDialog(
                "Sign Out",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await appState.logout() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to sign out?")
            }
        }
    }

    private var profileHeader: some View {
        HStack(spacing: 16) {
            // Avatar
            Circle()
                .fill(Color.campPrimary.opacity(0.1))
                .frame(width: 64, height: 64)
                .overlay(
                    Text(initials)
                        .font(.campHeading1)
                        .foregroundColor(.campPrimary)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(fullName)
                    .font(.campHeading3)
                    .foregroundColor(.campTextPrimary)

                Text(appState.currentGuest?.email ?? "")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }

    private var fullName: String {
        appState.currentGuest?.fullName ?? "Guest"
    }

    private var initials: String {
        appState.currentGuest?.initials ?? "G"
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

/// Edit profile form
struct EditProfileView: View {

    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var phone = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        Form {
            Section("Personal Information") {
                TextField("First Name", text: $firstName)
                TextField("Last Name", text: $lastName)
                TextField("Phone", text: $phone)
                    .keyboardType(.phonePad)
            }

            if let error = error {
                Section {
                    InlineError(message: error) {
                        self.error = nil
                    }
                }
            }
        }
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await saveProfile() }
                }
                .disabled(isLoading)
            }
        }
        .onAppear {
            if let guest = appState.currentGuest {
                firstName = guest.primaryFirstName
                lastName = guest.primaryLastName
                phone = guest.phone ?? ""
            }
        }
    }

    private func saveProfile() async {
        isLoading = true
        error = nil

        do {
            // Call API to update profile
            // try await apiClient.request(...)

            // For now, simulate success
            try await Task.sleep(for: .seconds(1))

            dismiss()
        } catch {
            self.error = "Failed to save profile. Please try again."
        }

        isLoading = false
    }
}

#Preview {
    ProfileView()
        .environmentObject(AppState())
}
