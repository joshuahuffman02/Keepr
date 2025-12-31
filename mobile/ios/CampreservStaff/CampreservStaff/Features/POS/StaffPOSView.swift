import SwiftUI
import CampreservCore
import CampreservUI

/// Point of Sale view - phone-optimized layout
struct StaffPOSView: View {

    @EnvironmentObject private var appState: StaffAppState
    @State private var products: [POSProduct] = []
    @State private var categories: [POSCategory] = []
    @State private var selectedCategory: POSCategory?
    @State private var cart: [POSCartItem] = []
    @State private var isLoading = false
    @State private var showCheckout = false
    @State private var searchText = ""
    @State private var showQuickSale = false

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                VStack(spacing: 0) {
                    // Search bar
                    searchBar

                    // Category tabs
                    categoryTabs

                    // Products grid (main content)
                    productsGrid

                    // Cart summary bar (bottom)
                    if !cart.isEmpty {
                        cartSummaryBar
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.campBackground)
            .navigationTitle("Point of Sale")
            .sheet(isPresented: $showCheckout) {
                POSCheckoutSheet(cart: cart, total: cartTotal) {
                    cart.removeAll()
                    showCheckout = false
                }
            }
        }
        .task {
            await loadProducts()
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 12) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.campTextHint)
                TextField("Search products...", text: $searchText)
                    .textFieldStyle(.plain)
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.campTextHint)
                    }
                }
            }
            .padding(12)
            .background(Color.campSurface)
            .cornerRadius(10)

            // Quick sale button
            Button {
                showQuickSale = true
            } label: {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.campPrimary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.campSurface)
        .sheet(isPresented: $showQuickSale) {
            POSQuickSaleSheet()
        }
    }

    // MARK: - Category Tabs

    private var categoryTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                POSCategoryChip(
                    title: "All",
                    icon: "square.grid.2x2",
                    isSelected: selectedCategory == nil
                ) {
                    selectedCategory = nil
                }

                ForEach(categories, id: \.id) { category in
                    POSCategoryChip(
                        title: category.name,
                        icon: category.icon,
                        isSelected: selectedCategory?.id == category.id
                    ) {
                        selectedCategory = category
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    // MARK: - Products Grid

    private var productsGrid: some View {
        ScrollView {
            if isLoading {
                VStack {
                    Spacer()
                    ProgressView()
                    Text("Loading products...")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 300)
            } else if filteredProducts.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "cube.box")
                        .font(.system(size: 48))
                        .foregroundColor(.campTextHint)
                    Text("No products found")
                        .font(.campBody)
                        .foregroundColor(.campTextSecondary)
                }
                .frame(maxWidth: .infinity, minHeight: 300)
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12),
                    GridItem(.flexible(), spacing: 12)
                ], spacing: 12) {
                    ForEach(filteredProducts, id: \.id) { product in
                        POSProductCard(product: product, cartQuantity: quantityInCart(product)) {
                            addToCart(product)
                        }
                    }
                }
                .padding(16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Cart Summary Bar

    private var cartSummaryBar: some View {
        HStack(spacing: 16) {
            // Cart icon with count
            ZStack(alignment: .topTrailing) {
                Image(systemName: "cart.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.campPrimary)

                Text("\(cartItemCount)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 18, height: 18)
                    .background(Color.campError)
                    .clipShape(Circle())
                    .offset(x: 8, y: -8)
            }

            // Items summary
            VStack(alignment: .leading, spacing: 2) {
                Text("\(cartItemCount) items")
                    .font(.campLabel)
                    .foregroundColor(.campTextPrimary)
                Text(cart.map { $0.product.name }.prefix(2).joined(separator: ", ") + (cart.count > 2 ? "..." : ""))
                    .font(.campCaption)
                    .foregroundColor(.campTextSecondary)
                    .lineLimit(1)
            }

            Spacer()

            // Total and checkout
            VStack(alignment: .trailing, spacing: 2) {
                Text(formatMoney(cents: cartTotal))
                    .font(.campHeading3)
                    .foregroundColor(.campPrimary)
            }

            Button(action: { showCheckout = true }) {
                Text("Checkout")
                    .font(.campButton)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.campPrimary)
                    .cornerRadius(10)
            }
        }
        .padding(16)
        .background(Color.campSurface)
        .shadow(color: .black.opacity(0.1), radius: 8, y: -4)
    }

    // MARK: - Computed Properties

    private var filteredProducts: [POSProduct] {
        var result = products

        if let category = selectedCategory {
            result = result.filter { $0.categoryId == category.id }
        }

        if !searchText.isEmpty {
            result = result.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }

        return result
    }

    private var cartItemCount: Int {
        cart.reduce(0) { $0 + $1.quantity }
    }

    private var cartTotal: Int {
        cart.reduce(0) { $0 + ($1.product.priceCents * $1.quantity) }
    }

    private func quantityInCart(_ product: POSProduct) -> Int {
        cart.first(where: { $0.product.id == product.id })?.quantity ?? 0
    }

    // MARK: - Cart Operations

    private func addToCart(_ product: POSProduct) {
        if let index = cart.firstIndex(where: { $0.product.id == product.id }) {
            cart[index].quantity += 1
        } else {
            cart.append(POSCartItem(product: product, quantity: 1))
        }
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }

    // MARK: - Data Loading

    private func loadProducts() async {
        isLoading = true
        defer { isLoading = false }

        try? await Task.sleep(for: .seconds(0.5))

        // Demo categories
        categories = POSCategory.demoCategories

        // Demo products
        products = POSProduct.demoProducts
    }
}

// MARK: - Models

struct POSProduct: Identifiable {
    let id: String
    let name: String
    let priceCents: Int
    let categoryId: String
    let icon: String
    let color: Color
}

struct POSCategory: Identifiable {
    let id: String
    let name: String
    let icon: String
}

struct POSCartItem {
    let product: POSProduct
    var quantity: Int
}

// MARK: - Demo Data

extension POSCategory {
    static let demoCategories: [POSCategory] = [
        POSCategory(id: "firewood", name: "Firewood", icon: "flame.fill"),
        POSCategory(id: "ice", name: "Ice", icon: "snowflake"),
        POSCategory(id: "snacks", name: "Snacks", icon: "leaf.fill"),
        POSCategory(id: "drinks", name: "Drinks", icon: "cup.and.saucer.fill"),
        POSCategory(id: "supplies", name: "Supplies", icon: "bag.fill"),
        POSCategory(id: "merch", name: "Merch", icon: "tshirt.fill")
    ]
}

extension POSProduct {
    static let demoProducts: [POSProduct] = [
        // Firewood
        POSProduct(id: "fw-bundle", name: "Firewood Bundle", priceCents: 899, categoryId: "firewood", icon: "flame.fill", color: .orange),
        POSProduct(id: "fw-half", name: "Half Cord", priceCents: 14999, categoryId: "firewood", icon: "flame.fill", color: .orange),
        POSProduct(id: "kindling", name: "Kindling", priceCents: 499, categoryId: "firewood", icon: "leaf.fill", color: .brown),
        POSProduct(id: "firestarter", name: "Fire Starter", priceCents: 599, categoryId: "firewood", icon: "sparkles", color: .red),

        // Ice
        POSProduct(id: "ice-bag", name: "Ice Bag (10lb)", priceCents: 499, categoryId: "ice", icon: "snowflake", color: .cyan),
        POSProduct(id: "ice-block", name: "Block Ice", priceCents: 699, categoryId: "ice", icon: "cube.fill", color: .blue),

        // Snacks
        POSProduct(id: "smores-kit", name: "S'mores Kit", priceCents: 899, categoryId: "snacks", icon: "star.fill", color: .brown),
        POSProduct(id: "chips", name: "Chips", priceCents: 299, categoryId: "snacks", icon: "leaf.fill", color: .yellow),
        POSProduct(id: "candy", name: "Candy Bar", priceCents: 199, categoryId: "snacks", icon: "rectangle.fill", color: .purple),
        POSProduct(id: "jerky", name: "Beef Jerky", priceCents: 799, categoryId: "snacks", icon: "flame.fill", color: .red),

        // Drinks
        POSProduct(id: "water", name: "Water Bottle", priceCents: 199, categoryId: "drinks", icon: "drop.fill", color: .blue),
        POSProduct(id: "soda", name: "Soda", priceCents: 249, categoryId: "drinks", icon: "cup.and.saucer.fill", color: .red),
        POSProduct(id: "coffee", name: "Coffee", priceCents: 349, categoryId: "drinks", icon: "cup.and.saucer.fill", color: .brown),
        POSProduct(id: "beer", name: "Local Beer", priceCents: 599, categoryId: "drinks", icon: "mug.fill", color: .yellow),

        // Supplies
        POSProduct(id: "propane", name: "Propane Tank", priceCents: 2499, categoryId: "supplies", icon: "cylinder.fill", color: .blue),
        POSProduct(id: "flashlight", name: "Flashlight", priceCents: 1299, categoryId: "supplies", icon: "flashlight.on.fill", color: .yellow),
        POSProduct(id: "bug-spray", name: "Bug Spray", priceCents: 899, categoryId: "supplies", icon: "ant.fill", color: .green),
        POSProduct(id: "sunscreen", name: "Sunscreen", priceCents: 999, categoryId: "supplies", icon: "sun.max.fill", color: .orange),

        // Merch
        POSProduct(id: "tshirt", name: "Camp T-Shirt", priceCents: 2499, categoryId: "merch", icon: "tshirt.fill", color: .green),
        POSProduct(id: "hat", name: "Camp Hat", priceCents: 1999, categoryId: "merch", icon: "crown.fill", color: .blue),
        POSProduct(id: "sticker", name: "Sticker Pack", priceCents: 599, categoryId: "merch", icon: "star.fill", color: .purple)
    ]
}

// MARK: - Components

struct POSCategoryChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
            }
            .font(.campLabel)
            .foregroundColor(isSelected ? .white : .campTextPrimary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? Color.campPrimary : Color.campBackground)
            .cornerRadius(20)
        }
    }
}

struct POSProductCard: View {
    let product: POSProduct
    let cartQuantity: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                // Icon with quantity badge
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(product.color.opacity(0.15))
                        .frame(height: 70)
                        .overlay(
                            Image(systemName: product.icon)
                                .font(.system(size: 28))
                                .foregroundColor(product.color)
                        )

                    if cartQuantity > 0 {
                        Text("\(cartQuantity)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 22, height: 22)
                            .background(Color.campPrimary)
                            .clipShape(Circle())
                            .offset(x: 4, y: -4)
                    }
                }

                Text(product.name)
                    .font(.campCaption)
                    .foregroundColor(.campTextPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(height: 32)

                Text(formatMoney(cents: product.priceCents))
                    .font(.campLabel)
                    .foregroundColor(.campPrimary)
            }
            .padding(10)
            .background(Color.campSurface)
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

// MARK: - Checkout Sheet

struct POSCheckoutSheet: View {
    let cart: [POSCartItem]
    let total: Int
    let onComplete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedPaymentMethod: POSPaymentMethod = .terminal
    @State private var isProcessing = false
    @State private var linkedReservation: String = ""
    @State private var showSuccess = false

    var body: some View {
        NavigationStack {
            if showSuccess {
                successView
            } else {
                checkoutForm
            }
        }
    }

    private var checkoutForm: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Order summary
                VStack(alignment: .leading, spacing: 12) {
                    Text("Order Summary")
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    ForEach(cart, id: \.product.id) { item in
                        HStack {
                            Text("\(item.quantity)x")
                                .font(.campLabel)
                                .foregroundColor(.campTextHint)
                                .frame(width: 30, alignment: .leading)
                            Text(item.product.name)
                                .font(.campBody)
                                .foregroundColor(.campTextPrimary)
                            Spacer()
                            Text(formatMoney(cents: item.product.priceCents * item.quantity))
                                .font(.campLabel)
                                .foregroundColor(.campTextPrimary)
                        }
                    }

                    Divider()

                    HStack {
                        Text("Total")
                            .font(.campHeading3)
                        Spacer()
                        Text(formatMoney(cents: total))
                            .font(.campHeading2)
                            .foregroundColor(.campPrimary)
                    }
                }
                .padding(16)
                .background(Color.campSurface)
                .cornerRadius(12)

                // Link to reservation (optional)
                VStack(alignment: .leading, spacing: 8) {
                    Text("Link to Reservation (Optional)")
                        .font(.campLabel)
                        .foregroundColor(.campTextPrimary)

                    TextField("Confirmation # or guest name", text: $linkedReservation)
                        .textFieldStyle(.roundedBorder)
                }

                // Payment method
                VStack(alignment: .leading, spacing: 12) {
                    Text("Payment Method")
                        .font(.campHeading3)
                        .foregroundColor(.campTextPrimary)

                    ForEach(POSPaymentMethod.allCases, id: \.self) { method in
                        POSPaymentMethodRow(
                            method: method,
                            isSelected: selectedPaymentMethod == method
                        ) {
                            selectedPaymentMethod = method
                        }
                    }
                }

                // Process button
                PrimaryButton(
                    selectedPaymentMethod.buttonLabel,
                    icon: selectedPaymentMethod.icon,
                    isLoading: isProcessing
                ) {
                    Task { await processPayment() }
                }
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Checkout")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var successView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.campSuccess)

            Text("Payment Complete")
                .font(.campDisplaySmall)
                .foregroundColor(.campTextPrimary)

            Text(formatMoney(cents: total))
                .font(.campHeading2)
                .foregroundColor(.campPrimary)

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton("New Sale", icon: "plus") {
                    onComplete()
                }
                SecondaryButton("Print Receipt") {
                    // Would print receipt
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
    }

    private func processPayment() async {
        isProcessing = true
        try? await Task.sleep(for: .seconds(2))
        isProcessing = false
        showSuccess = true
    }

    private func formatMoney(cents: Int) -> String {
        let dollars = Double(cents) / 100.0
        return String(format: "$%.2f", dollars)
    }
}

enum POSPaymentMethod: CaseIterable {
    case terminal
    case card
    case cash
    case chargeRoom

    var title: String {
        switch self {
        case .terminal: return "Tap to Pay / Reader"
        case .card: return "Manual Card Entry"
        case .cash: return "Cash"
        case .chargeRoom: return "Charge to Room"
        }
    }

    var icon: String {
        switch self {
        case .terminal: return "wave.3.right"
        case .card: return "creditcard"
        case .cash: return "dollarsign.circle"
        case .chargeRoom: return "house.fill"
        }
    }

    var description: String {
        switch self {
        case .terminal: return "Use iPhone or external reader"
        case .card: return "Enter card details manually"
        case .cash: return "Record cash payment"
        case .chargeRoom: return "Add to guest's reservation balance"
        }
    }

    var buttonLabel: String {
        switch self {
        case .terminal: return "Present Reader"
        case .card: return "Enter Card"
        case .cash: return "Record Cash"
        case .chargeRoom: return "Charge to Room"
        }
    }
}

struct POSPaymentMethodRow: View {
    let method: POSPaymentMethod
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: method.icon)
                    .font(.system(size: 22))
                    .foregroundColor(isSelected ? .campPrimary : .campTextSecondary)
                    .frame(width: 28)

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
            .padding(14)
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

// MARK: - Quick Sale Sheet

struct POSQuickSaleSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var amount = ""
    @State private var description = ""
    @State private var selectedCategory = "General"
    @State private var linkToReservation = ""
    @State private var isProcessing = false
    @State private var showSuccess = false

    let categories = ["General", "Firewood", "Ice", "Store", "Services", "Other"]

    var body: some View {
        NavigationStack {
            if showSuccess {
                successView
            } else {
                saleForm
            }
        }
    }

    private var saleForm: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Amount entry
                VStack(spacing: 8) {
                    Text("Amount")
                        .font(.campCaption)
                        .foregroundColor(.campTextHint)

                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("$")
                            .font(.system(size: 40, weight: .light))
                            .foregroundColor(.campTextSecondary)

                        TextField("0.00", text: $amount)
                            .font(.system(size: 56, weight: .semibold))
                            .foregroundColor(.campTextPrimary)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 200)
                    }
                }
                .padding(32)
                .frame(maxWidth: .infinity)
                .background(Color.campSurface)
                .cornerRadius(20)

                // Description
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        TextField("What's this for?", text: $description)
                            .font(.campBody)
                            .padding(14)
                            .background(Color.campBackground)
                            .cornerRadius(10)
                    }

                    // Category
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Category")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(categories, id: \.self) { category in
                                    Button {
                                        selectedCategory = category
                                    } label: {
                                        Text(category)
                                            .font(.campCaption)
                                            .foregroundColor(selectedCategory == category ? .white : .campTextPrimary)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .background(selectedCategory == category ? Color.campPrimary : Color.campBackground)
                                            .cornerRadius(20)
                                    }
                                }
                            }
                        }
                    }

                    // Link to reservation (optional)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Link to Reservation (Optional)")
                            .font(.campLabel)
                            .foregroundColor(.campTextSecondary)

                        TextField("Confirmation # or guest name", text: $linkToReservation)
                            .font(.campBody)
                            .padding(14)
                            .background(Color.campBackground)
                            .cornerRadius(10)
                    }
                }
                .padding(20)
                .background(Color.campSurface)
                .cornerRadius(16)

                // Charge button
                PrimaryButton("Charge \(formattedAmount)", icon: "creditcard", isLoading: isProcessing) {
                    Task { await processSale() }
                }
                .disabled(amount.isEmpty || Double(amount) == nil || Double(amount)! <= 0)
            }
            .padding(16)
        }
        .background(Color.campBackground)
        .navigationTitle("Quick Sale")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var successView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.campSuccess)

            Text("Sale Complete")
                .font(.campDisplaySmall)
                .foregroundColor(.campTextPrimary)

            Text(formattedAmount)
                .font(.campHeading2)
                .foregroundColor(.campPrimary)

            Spacer()

            VStack(spacing: 12) {
                PrimaryButton("New Sale", icon: "plus") {
                    amount = ""
                    description = ""
                    linkToReservation = ""
                    showSuccess = false
                }

                SecondaryButton("Done") {
                    dismiss()
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.campBackground)
    }

    private var formattedAmount: String {
        guard let value = Double(amount), value > 0 else { return "$0.00" }
        return String(format: "$%.2f", value)
    }

    private func processSale() async {
        isProcessing = true
        try? await Task.sleep(for: .seconds(1.5))
        isProcessing = false
        showSuccess = true
    }
}
