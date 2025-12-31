import SwiftUI
import CampreservCore
import CampreservUI

/// Point of Sale view for store sales
struct StaffPOSView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var products: [Product] = []
    @State private var categories: [ProductCategory] = []
    @State private var selectedCategory: ProductCategory?
    @State private var cart: [CartItem] = []
    @State private var isLoading = true
    @State private var showCheckout = false

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // Products grid
                productsView

                // Cart sidebar
                cartView
            }
            .background(Color.campBackground)
            .navigationTitle("Point of Sale")
            .sheet(isPresented: $showCheckout) {
                POSCheckoutView(cart: cart) {
                    cart.removeAll()
                    showCheckout = false
                }
            }
        }
        .task {
            await loadProducts()
        }
    }

    // MARK: - Views

    private var productsView: some View {
        VStack(spacing: 0) {
            // Category tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    CategoryChip(
                        title: "All",
                        isSelected: selectedCategory == nil
                    ) {
                        selectedCategory = nil
                    }

                    ForEach(categories, id: \.id) { category in
                        CategoryChip(
                            title: category.name,
                            isSelected: selectedCategory?.id == category.id
                        ) {
                            selectedCategory = category
                        }
                    }
                }
                .padding()
            }

            // Products grid
            if isLoading {
                LoadingView(message: "Loading products...")
            } else if filteredProducts.isEmpty {
                EmptyStateView(
                    icon: "cart",
                    title: "No Products",
                    message: "No products available in this category."
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 150))
                    ], spacing: 12) {
                        ForEach(filteredProducts, id: \.id) { product in
                            ProductCard(product: product) {
                                addToCart(product)
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var cartView: some View {
        VStack(spacing: 0) {
            // Cart header
            HStack {
                Text("Cart")
                    .font(.campHeading3)
                Spacer()
                if !cart.isEmpty {
                    Button("Clear") {
                        cart.removeAll()
                    }
                    .font(.campLabel)
                    .foregroundColor(.campError)
                }
            }
            .padding()
            .background(Color.campSurface)

            if cart.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "cart")
                        .font(.system(size: 32))
                        .foregroundColor(.campTextHint)
                    Text("Cart is empty")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                }
                Spacer()
            } else {
                // Cart items
                List {
                    ForEach(cart, id: \.product.id) { item in
                        CartItemRow(item: item) { newQuantity in
                            updateQuantity(for: item.product, quantity: newQuantity)
                        }
                    }
                    .onDelete { indexSet in
                        cart.remove(atOffsets: indexSet)
                    }
                }
                .listStyle(.plain)

                // Cart total and checkout
                VStack(spacing: 12) {
                    Divider()

                    HStack {
                        Text("Total")
                            .font(.campHeading3)
                        Spacer()
                        Text("$\(String(format: "%.2f", Double(cartTotal) / 100.0))")
                            .font(.campHeading2)
                            .foregroundColor(.campPrimary)
                    }

                    PrimaryButton("Checkout", icon: "creditcard") {
                        showCheckout = true
                    }
                }
                .padding()
                .background(Color.campSurface)
            }
        }
        .frame(width: 280)
        .background(Color.campSurface)
    }

    private var filteredProducts: [Product] {
        if let category = selectedCategory {
            return products.filter { $0.categoryId == category.id }
        }
        return products
    }

    private var cartTotal: Int {
        cart.reduce(0) { $0 + ($1.product.priceCents * $1.quantity) }
    }

    // MARK: - Cart Operations

    private func addToCart(_ product: Product) {
        if let index = cart.firstIndex(where: { $0.product.id == product.id }) {
            cart[index].quantity += 1
        } else {
            cart.append(CartItem(product: product, quantity: 1))
        }
    }

    private func updateQuantity(for product: Product, quantity: Int) {
        if let index = cart.firstIndex(where: { $0.product.id == product.id }) {
            if quantity > 0 {
                cart[index].quantity = quantity
            } else {
                cart.remove(at: index)
            }
        }
    }

    private func loadProducts() async {
        isLoading = true
        defer { isLoading = false }

        // Load from API
        try? await Task.sleep(for: .seconds(1))
        products = []
        categories = []
    }
}

// MARK: - Models

struct Product: Identifiable {
    let id: String
    let name: String
    let priceCents: Int
    let categoryId: String?
    let imageUrl: String?
}

struct ProductCategory: Identifiable {
    let id: String
    let name: String
}

struct CartItem {
    let product: Product
    var quantity: Int
}

// MARK: - Components

struct CategoryChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.campLabel)
                .foregroundColor(isSelected ? .white : .campTextPrimary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.campPrimary : Color.campSurface)
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(isSelected ? Color.clear : Color.campBorder, lineWidth: 1)
                )
        }
    }
}

struct ProductCard: View {
    let product: Product
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                // Product image placeholder
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.campPrimary.opacity(0.1))
                    .frame(height: 100)
                    .overlay(
                        Image(systemName: "cube.box")
                            .font(.system(size: 24))
                            .foregroundColor(.campPrimary)
                    )

                Text(product.name)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                Text("$\(String(format: "%.2f", Double(product.priceCents) / 100.0))")
                    .font(.campBodySmall)
                    .foregroundColor(.campPrimary)
            }
            .padding(12)
            .background(Color.campSurface)
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
    }
}

struct CartItemRow: View {
    let item: CartItem
    let onQuantityChange: (Int) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.product.name)
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)

                Text("$\(String(format: "%.2f", Double(item.product.priceCents) / 100.0))")
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
            }

            Spacer()

            HStack(spacing: 12) {
                Button {
                    onQuantityChange(item.quantity - 1)
                } label: {
                    Image(systemName: "minus.circle")
                        .foregroundColor(.campTextSecondary)
                }

                Text("\(item.quantity)")
                    .font(.campLabel)
                    .frame(minWidth: 20)

                Button {
                    onQuantityChange(item.quantity + 1)
                } label: {
                    Image(systemName: "plus.circle")
                        .foregroundColor(.campPrimary)
                }
            }
        }
    }
}

/// Checkout view with payment options
struct POSCheckoutView: View {
    let cart: [CartItem]
    let onComplete: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedPaymentMethod: PaymentMethod = .card
    @State private var isProcessing = false

    var total: Int {
        cart.reduce(0) { $0 + ($1.product.priceCents * $1.quantity) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Order summary
                Card {
                    VStack(spacing: 8) {
                        ForEach(cart, id: \.product.id) { item in
                            HStack {
                                Text("\(item.quantity)x \(item.product.name)")
                                    .font(.campBody)
                                    .foregroundColor(.campTextSecondary)
                                Spacer()
                                Text("$\(String(format: "%.2f", Double(item.product.priceCents * item.quantity) / 100.0))")
                                    .font(.campLabel)
                            }
                        }

                        Divider()

                        HStack {
                            Text("Total")
                                .font(.campHeading3)
                            Spacer()
                            Text("$\(String(format: "%.2f", Double(total) / 100.0))")
                                .font(.campHeading2)
                                .foregroundColor(.campPrimary)
                        }
                    }
                }

                // Payment method selection
                VStack(alignment: .leading, spacing: 12) {
                    Text("Payment Method")
                        .font(.campHeading3)

                    ForEach(PaymentMethod.allCases, id: \.self) { method in
                        PaymentMethodRow(
                            method: method,
                            isSelected: selectedPaymentMethod == method
                        ) {
                            selectedPaymentMethod = method
                        }
                    }
                }

                Spacer()

                // Process payment button
                PrimaryButton(
                    selectedPaymentMethod == .terminal ? "Present Reader" : "Complete Sale",
                    icon: selectedPaymentMethod.icon,
                    isLoading: isProcessing
                ) {
                    Task { await processPayment() }
                }
            }
            .padding(16)
            .background(Color.campBackground)
            .navigationTitle("Checkout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func processPayment() async {
        isProcessing = true

        // Call API to process payment
        try? await Task.sleep(for: .seconds(2))

        isProcessing = false
        onComplete()
    }
}

enum PaymentMethod: CaseIterable {
    case terminal
    case card
    case cash

    var title: String {
        switch self {
        case .terminal: return "Tap to Pay / Reader"
        case .card: return "Manual Card Entry"
        case .cash: return "Cash"
        }
    }

    var icon: String {
        switch self {
        case .terminal: return "wave.3.right"
        case .card: return "creditcard"
        case .cash: return "dollarsign.circle"
        }
    }

    var description: String {
        switch self {
        case .terminal: return "Use iPhone or external reader"
        case .card: return "Enter card details manually"
        case .cash: return "Record cash payment"
        }
    }
}

struct PaymentMethodRow: View {
    let method: PaymentMethod
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: method.icon)
                    .font(.system(size: 24))
                    .foregroundColor(isSelected ? .campPrimary : .campTextSecondary)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 2) {
                    Text(method.title)
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)
                    Text(method.description)
                        .font(.campCaption)
                        .foregroundColor(.campTextSecondary)
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .campPrimary : .campBorder)
            }
            .padding(16)
            .background(isSelected ? Color.campPrimary.opacity(0.05) : Color.campSurface)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.campPrimary : Color.campBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}
