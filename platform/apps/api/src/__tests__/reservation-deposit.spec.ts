import {
  assertReservationDepositV2,
  calculateReservationDepositV2,
} from "../reservations/reservation-deposit";

describe("Reservation deposit v2 helpers", () => {
  it("returns v2:none when no deposit policy exists", async () => {
    const depositPoliciesService = { calculateDeposit: jest.fn().mockResolvedValue(null) };
    const result = await calculateReservationDepositV2(depositPoliciesService, {
      campgroundId: "cg1",
      siteClassId: null,
      totalAmountCents: 20000,
      lodgingOnlyCents: 20000,
      nights: 2,
    });

    expect(result.depositAmount).toBe(0);
    expect(result.depositPolicyVersion).toBe("v2:none");
  });

  it("throws when paid amount is below the required deposit", async () => {
    const depositPoliciesService = {
      calculateDeposit: jest.fn().mockResolvedValue({
        depositAmountCents: 5000,
        depositPolicyVersion: "dp:1:v1",
        policy: { name: "Standard", strategy: "percent" },
      }),
    };

    await expect(
      assertReservationDepositV2(depositPoliciesService, {
        campgroundId: "cg1",
        siteClassId: null,
        totalAmountCents: 20000,
        lodgingOnlyCents: 20000,
        paidAmountCents: 1000,
        nights: 2,
      }),
    ).rejects.toThrow("Deposit of at least $50.00 required");
  });

  it("returns policy version when paid amount meets deposit requirement", async () => {
    const depositPoliciesService = {
      calculateDeposit: jest.fn().mockResolvedValue({
        depositAmountCents: 5000,
        depositPolicyVersion: "dp:1:v1",
        policy: { name: "Standard", strategy: "percent" },
      }),
    };

    const result = await assertReservationDepositV2(depositPoliciesService, {
      campgroundId: "cg1",
      siteClassId: null,
      totalAmountCents: 20000,
      lodgingOnlyCents: 20000,
      paidAmountCents: 6000,
      nights: 2,
    });

    expect(result.depositAmount).toBe(5000);
    expect(result.depositPolicyVersion).toBe("dp:1:v1");
  });
});
