import XCTest
@testable import CampreservCore

final class MoneyFormatterTests: XCTestCase {

    func testFormatCents() {
        // Test basic formatting
        XCTAssertEqual(MoneyFormatter.format(cents: 9999), "$99.99")
        XCTAssertEqual(MoneyFormatter.format(cents: 100), "$1.00")
        XCTAssertEqual(MoneyFormatter.format(cents: 0), "$0.00")
        XCTAssertEqual(MoneyFormatter.format(cents: 1), "$0.01")
    }

    func testParseToCents() {
        // Test parsing currency strings
        XCTAssertEqual(MoneyFormatter.parseToCents("$99.99"), 9999)
        XCTAssertEqual(MoneyFormatter.parseToCents("99.99"), 9999)
        XCTAssertEqual(MoneyFormatter.parseToCents("$1.00"), 100)
        XCTAssertEqual(MoneyFormatter.parseToCents("$0.01"), 1)
        XCTAssertEqual(MoneyFormatter.parseToCents("invalid"), nil)
    }

    func testFormatCompact() {
        // Test compact formatting
        XCTAssertEqual(MoneyFormatter.formatCompact(cents: 999900), "$9,999")
        XCTAssertEqual(MoneyFormatter.formatCompact(cents: 10000), "$100")
    }
}
