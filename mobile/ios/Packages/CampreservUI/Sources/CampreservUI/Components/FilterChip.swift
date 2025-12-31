import SwiftUI

/// A selectable chip/pill button for filters
public struct FilterChip: View {

    let label: String
    let isSelected: Bool
    let action: () -> Void

    public init(_ label: String, isSelected: Bool, action: @escaping () -> Void) {
        self.label = label
        self.isSelected = isSelected
        self.action = action
    }

    public init(title: String, isSelected: Bool, action: @escaping () -> Void) {
        self.label = title
        self.isSelected = isSelected
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(label)
                .font(.campLabel)
                .foregroundColor(isSelected ? .white : .campTextSecondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? Color.campPrimary : Color.campSurface)
                )
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Color.clear : Color.campBorder, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    HStack(spacing: 8) {
        FilterChip("Today", isSelected: true) {}
        FilterChip("Week", isSelected: false) {}
        FilterChip("Month", isSelected: false) {}
    }
    .padding()
}
