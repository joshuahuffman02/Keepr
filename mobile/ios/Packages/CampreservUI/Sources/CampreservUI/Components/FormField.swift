import SwiftUI

/// Standard form field with label, input, and error handling
public struct FormField: View {

    private let label: String
    private let placeholder: String
    @Binding private var text: String
    private let errorMessage: String?
    private let isSecure: Bool
    private let keyboardType: UIKeyboardType
    private let autocapitalization: TextInputAutocapitalization
    private let onSubmit: (() -> Void)?

    public init(
        label: String,
        placeholder: String = "",
        text: Binding<String>,
        errorMessage: String? = nil,
        isSecure: Bool = false,
        keyboardType: UIKeyboardType = .default,
        autocapitalization: TextInputAutocapitalization = .sentences,
        onSubmit: (() -> Void)? = nil
    ) {
        self.label = label
        self.placeholder = placeholder
        self._text = text
        self.errorMessage = errorMessage
        self.isSecure = isSecure
        self.keyboardType = keyboardType
        self.autocapitalization = autocapitalization
        self.onSubmit = onSubmit
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .textInputAutocapitalization(autocapitalization)
                }
            }
            .font(.campBody)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.campSurface)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(errorMessage != nil ? Color.campError : Color.campBorder, lineWidth: 1)
            )
            .onSubmit {
                onSubmit?()
            }

            if let error = errorMessage {
                Text(error)
                    .font(.campCaption)
                    .foregroundColor(.campError)
            }
        }
    }
}

/// Multi-line text area field
public struct TextAreaField: View {

    private let label: String
    private let placeholder: String
    @Binding private var text: String
    private let errorMessage: String?
    private let minHeight: CGFloat

    public init(
        label: String,
        placeholder: String = "",
        text: Binding<String>,
        errorMessage: String? = nil,
        minHeight: CGFloat = 100
    ) {
        self.label = label
        self.placeholder = placeholder
        self._text = text
        self.errorMessage = errorMessage
        self.minHeight = minHeight
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .font(.campBody)
                        .foregroundColor(.campTextHint)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                }

                TextEditor(text: $text)
                    .font(.campBody)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(minHeight: minHeight)
                    .scrollContentBackground(.hidden)
            }
            .background(Color.campSurface)
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(errorMessage != nil ? Color.campError : Color.campBorder, lineWidth: 1)
            )

            if let error = errorMessage {
                Text(error)
                    .font(.campCaption)
                    .foregroundColor(.campError)
            }
        }
    }
}

/// Picker field with dropdown
public struct PickerField<T: Hashable>: View {

    private let label: String
    @Binding private var selection: T
    private let options: [(value: T, label: String)]
    private let errorMessage: String?

    public init(
        label: String,
        selection: Binding<T>,
        options: [(value: T, label: String)],
        errorMessage: String? = nil
    ) {
        self.label = label
        self._selection = selection
        self.options = options
        self.errorMessage = errorMessage
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(.campTextPrimary)

            Menu {
                ForEach(options, id: \.value) { option in
                    Button(option.label) {
                        selection = option.value
                    }
                }
            } label: {
                HStack {
                    Text(options.first { $0.value == selection }?.label ?? "")
                        .font(.campBody)
                        .foregroundColor(.campTextPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.campTextSecondary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.campSurface)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(errorMessage != nil ? Color.campError : Color.campBorder, lineWidth: 1)
                )
            }

            if let error = errorMessage {
                Text(error)
                    .font(.campCaption)
                    .foregroundColor(.campError)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 20) {
            FormField(
                label: "Email",
                placeholder: "Enter your email",
                text: .constant(""),
                keyboardType: .emailAddress,
                autocapitalization: .never
            )

            FormField(
                label: "Password",
                placeholder: "Enter your password",
                text: .constant(""),
                isSecure: true
            )

            FormField(
                label: "Name",
                placeholder: "Enter your name",
                text: .constant("John"),
                errorMessage: "Name is required"
            )

            TextAreaField(
                label: "Notes",
                placeholder: "Add any special requests...",
                text: .constant("")
            )

            PickerField(
                label: "Site Type",
                selection: .constant("rv"),
                options: [
                    (value: "rv", label: "RV Site"),
                    (value: "tent", label: "Tent Site"),
                    (value: "cabin", label: "Cabin")
                ]
            )
        }
        .padding()
    }
    .background(Color.campBackground)
}
