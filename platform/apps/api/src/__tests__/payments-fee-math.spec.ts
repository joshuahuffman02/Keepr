import { PaymentsController } from "../payments/payments.controller";

const buildController = () =>
  new PaymentsController(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  ) as any;

describe("PaymentsController fee calculations", () => {
  it("adds gateway pass-through percent + flat when enabled", () => {
    const controller = buildController();
    const result = controller["computeChargeAmounts"]({
      reservation: { balanceAmount: 10000, totalAmount: 10000, paidAmount: 0 },
      platformFeeMode: "absorb",
      applicationFeeCents: 300,
      gatewayFeeMode: "pass_through",
      gatewayFeePercentBasisPoints: 290,
      gatewayFeeFlatCents: 30
    });

    expect(result.amountCents).toBe(10320);
    expect(result.platformPassThroughFeeCents).toBe(0);
    expect(result.gatewayPassThroughFeeCents).toBe(320);
  });

  it("caps amount to base + platform fee when pass-through", () => {
    const controller = buildController();
    const result = controller["computeChargeAmounts"]({
      reservation: { balanceAmount: 5000, totalAmount: 5000, paidAmount: 0 },
      platformFeeMode: "pass_through",
      applicationFeeCents: 300,
      gatewayFeeMode: "absorb",
      gatewayFeePercentBasisPoints: 0,
      gatewayFeeFlatCents: 0
    });

    expect(result.amountCents).toBe(5300);
    expect(result.platformPassThroughFeeCents).toBe(300);
    expect(result.gatewayPassThroughFeeCents).toBe(0);
  });
});
