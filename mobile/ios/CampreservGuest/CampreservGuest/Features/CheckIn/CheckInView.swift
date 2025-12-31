import SwiftUI
import CampreservCore
import CampreservUI

/// Self check-in flow
struct CheckInView: View {

    let reservation: Reservation
    @Environment(\.dismiss) private var dismiss
    @State private var agreedToRules = false
    @State private var licensePlate = ""
    @State private var additionalInfo = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var showSuccess = false

    var body: some View {
        NavigationStack {
            if showSuccess {
                checkInSuccess
            } else {
                checkInForm
            }
        }
    }

    private var checkInForm: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Reservation summary
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(reservation.siteName ?? "Your Site")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        Text(reservation.campgroundName ?? "Campground")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)

                        HStack {
                            Label(formatDate(reservation.startDate), systemImage: "arrow.down.circle")
                            Text("-")
                            Label(formatDate(reservation.endDate), systemImage: "arrow.up.circle")
                        }
                        .font(.campBodySmall)
                        .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Vehicle info
                FormField(
                    label: "License Plate (optional)",
                    placeholder: "ABC 1234",
                    text: $licensePlate,
                    autocapitalization: .characters
                )

                // Additional info
                TextAreaField(
                    label: "Additional Information (optional)",
                    placeholder: "Any special requests or notes for the staff...",
                    text: $additionalInfo
                )

                // Rules agreement
                Toggle(isOn: $agreedToRules) {
                    Text("I agree to the campground rules and policies")
                        .font(.campBody)
                        .foregroundColor(.campTextPrimary)
                }
                .tint(.campPrimary)

                if let error = error {
                    InlineError(message: error) {
                        self.error = nil
                    }
                }

                // Submit button
                PrimaryButton(
                    "Complete Check-In",
                    icon: "checkmark.circle",
                    isLoading: isLoading,
                    isDisabled: !agreedToRules
                ) {
                    Task { await performCheckIn() }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Self Check-In")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
    }

    private var checkInSuccess: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.campSuccess)

            VStack(spacing: 8) {
                Text("You're Checked In!")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)

                Text("Welcome to \(reservation.campgroundName ?? "the campground")!")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
                    .multilineTextAlignment(.center)
            }

            Card {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Site")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    Text(reservation.siteName ?? "Site")
                        .font(.campHeading2)
                        .foregroundColor(.campTextPrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 32)

            Spacer()

            PrimaryButton("Done") {
                dismiss()
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color.campBackground)
    }

    private func performCheckIn() async {
        isLoading = true
        error = nil

        do {
            // Build check-in data
            var data: [String: Any] = [
                "agreedToRules": agreedToRules
            ]
            if !licensePlate.isEmpty {
                data["licensePlate"] = licensePlate
            }
            if !additionalInfo.isEmpty {
                data["additionalInfo"] = additionalInfo
            }

            // Call API (would use APIClient in real implementation)
            // try await apiClient.request(.selfCheckin(reservationId: reservation.id, data: data))

            // For now, simulate success
            try await Task.sleep(for: .seconds(1))

            showSuccess = true
        } catch {
            self.error = "Failed to check in. Please try again or contact the front desk."
        }

        isLoading = false
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }
}

/// Self check-out flow
struct CheckOutView: View {

    let reservation: Reservation
    @Environment(\.dismiss) private var dismiss
    @State private var hasDamage = false
    @State private var damageDescription = ""
    @State private var feedback = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var showSuccess = false

    var body: some View {
        NavigationStack {
            if showSuccess {
                checkOutSuccess
            } else {
                checkOutForm
            }
        }
    }

    private var checkOutForm: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Reservation summary
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Checking out of")
                            .font(.campCaption)
                            .foregroundColor(.campTextHint)

                        Text(reservation.siteName ?? "Your Site")
                            .font(.campHeading3)
                            .foregroundColor(.campTextPrimary)

                        Text(reservation.campgroundName ?? "Campground")
                            .font(.campBody)
                            .foregroundColor(.campTextSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Damage report
                VStack(alignment: .leading, spacing: 12) {
                    Toggle(isOn: $hasDamage) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Report Damage")
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                            Text("Let us know about any issues with the site")
                                .font(.campCaption)
                                .foregroundColor(.campTextSecondary)
                        }
                    }
                    .tint(.campWarning)

                    if hasDamage {
                        TextAreaField(
                            label: "Describe the issue",
                            placeholder: "Please describe what happened...",
                            text: $damageDescription
                        )
                    }
                }

                // Feedback
                TextAreaField(
                    label: "How was your stay? (optional)",
                    placeholder: "Share your experience...",
                    text: $feedback
                )

                if let error = error {
                    InlineError(message: error) {
                        self.error = nil
                    }
                }

                // Submit button
                PrimaryButton(
                    "Complete Check-Out",
                    icon: "arrow.up.circle",
                    isLoading: isLoading
                ) {
                    Task { await performCheckOut() }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Self Check-Out")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
    }

    private var checkOutSuccess: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "hand.wave.fill")
                .font(.system(size: 80))
                .foregroundColor(.campPrimary)

            VStack(spacing: 8) {
                Text("Safe Travels!")
                    .font(.campDisplaySmall)
                    .foregroundColor(.campTextPrimary)

                Text("Thank you for staying with us. We hope to see you again soon!")
                    .font(.campBody)
                    .foregroundColor(.campTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton("Leave a Review") {
                    // Navigate to review
                    dismiss()
                }

                SecondaryButton("Done") {
                    dismiss()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color.campBackground)
    }

    private func performCheckOut() async {
        isLoading = true
        error = nil

        do {
            // Build check-out data
            var data: [String: Any] = [:]
            if hasDamage {
                data["hasDamage"] = true
                data["damageDescription"] = damageDescription
            }
            if !feedback.isEmpty {
                data["feedback"] = feedback
            }

            // Call API (would use APIClient in real implementation)
            // try await apiClient.request(.selfCheckout(reservationId: reservation.id, data: data))

            // For now, simulate success
            try await Task.sleep(for: .seconds(1))

            showSuccess = true
        } catch {
            self.error = "Failed to check out. Please try again or contact the front desk."
        }

        isLoading = false
    }
}
