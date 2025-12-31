import XCTest
@testable import CampreservUI

final class CampreservUITests: XCTestCase {

    func testVersionExists() {
        XCTAssertFalse(campreservUIVersion.isEmpty)
        XCTAssertEqual(campreservUIVersion, "1.0.0")
    }

    func testStatusBadgeRawValueInit() {
        // Test all status raw values parse correctly
        let pending = StatusBadge.Status(rawValue: "pending")
        XCTAssertEqual(pending, .pending)

        let confirmed = StatusBadge.Status(rawValue: "confirmed")
        XCTAssertEqual(confirmed, .confirmed)

        let checkedIn = StatusBadge.Status(rawValue: "checked_in")
        XCTAssertEqual(checkedIn, .checkedIn)

        let checkedOut = StatusBadge.Status(rawValue: "checked_out")
        XCTAssertEqual(checkedOut, .checkedOut)

        let cancelled = StatusBadge.Status(rawValue: "cancelled")
        XCTAssertEqual(cancelled, .cancelled)

        // Unknown values return nil
        let unknown = StatusBadge.Status(rawValue: "unknown_status")
        XCTAssertNil(unknown)
    }

    func testStatusDisplayNames() {
        XCTAssertEqual(StatusBadge.Status.pending.displayName, "Pending")
        XCTAssertEqual(StatusBadge.Status.confirmed.displayName, "Confirmed")
        XCTAssertEqual(StatusBadge.Status.checkedIn.displayName, "Checked In")
        XCTAssertEqual(StatusBadge.Status.checkedOut.displayName, "Checked Out")
        XCTAssertEqual(StatusBadge.Status.cancelled.displayName, "Cancelled")
    }

    func testStatusIcons() {
        XCTAssertEqual(StatusBadge.Status.pending.icon, "clock")
        XCTAssertEqual(StatusBadge.Status.confirmed.icon, "checkmark.circle")
        XCTAssertEqual(StatusBadge.Status.checkedIn.icon, "arrow.down.circle")
        XCTAssertEqual(StatusBadge.Status.checkedOut.icon, "arrow.up.circle")
        XCTAssertEqual(StatusBadge.Status.cancelled.icon, "xmark.circle")
    }

    func testAllStatusCases() {
        // Ensure all cases are accounted for
        let allCases = StatusBadge.Status.allCases
        XCTAssertEqual(allCases.count, 5)
        XCTAssertTrue(allCases.contains(.pending))
        XCTAssertTrue(allCases.contains(.confirmed))
        XCTAssertTrue(allCases.contains(.checkedIn))
        XCTAssertTrue(allCases.contains(.checkedOut))
        XCTAssertTrue(allCases.contains(.cancelled))
    }
}
