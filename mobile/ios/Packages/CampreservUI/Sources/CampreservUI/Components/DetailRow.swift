import SwiftUI

/// A simple label-value row for detail views
public struct DetailRow: View {

    let label: String
    let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }

    public var body: some View {
        HStack {
            Text(label)
                .font(.campBodySmall)
                .foregroundColor(.campTextSecondary)

            Spacer()

            Text(value)
                .font(.campBodySmall)
                .foregroundColor(.campTextPrimary)
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        DetailRow(label: "Location", value: "Site A1")
        DetailRow(label: "Priority", value: "High")
        DetailRow(label: "Status", value: "In Progress")
    }
    .padding()
}
