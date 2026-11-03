import SwiftUI

enum CommonTabStyle {
    static let background = Color(uiColor: .systemGroupedBackground)
    static let surface = Color(uiColor: .secondarySystemGroupedBackground)
    static let ink = Color(red: 0.04, green: 0.22, blue: 0.25)
    static let deepInk = Color(red: 0.03, green: 0.13, blue: 0.18)
    static let mint = Color(red: 0.50, green: 0.91, blue: 0.77)
}

struct SurfaceCard<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(CommonTabStyle.surface, in: RoundedRectangle(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .strokeBorder(Color.primary.opacity(0.05))
            }
    }
}

struct SectionHeading: View {
    let title: String
    let subtitle: String?

    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.title3.weight(.bold))
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SymbolTile: View {
    let symbol: String
    var size: CGFloat = 46

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(Color.accentColor)
            .frame(width: size, height: size)
            .background(Color.accentColor.opacity(0.11), in: RoundedRectangle(cornerRadius: size * 0.28))
            .accessibilityHidden(true)
    }
}

struct ExpenseSummaryRow: View {
    let expense: SavedExpense
    let context: String

    var body: some View {
        HStack(spacing: 12) {
            SymbolTile(symbol: expense.category.symbol, size: 42)
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.merchant)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(context)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(expense.amount.formatted(.currency(code: expense.currencyCode)))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .minimumScaleFactor(0.8)
                .lineLimit(1)
        }
        .padding(.vertical, 3)
    }
}

private extension ExpenseCategory {
    var symbol: String {
        switch self {
        case .groceries: "basket.fill"
        case .dining: "fork.knife"
        case .travel: "airplane"
        case .shopping: "bag.fill"
        case .household: "house.fill"
        case .health: "cross.case.fill"
        case .other: "receipt.fill"
        }
    }
}
