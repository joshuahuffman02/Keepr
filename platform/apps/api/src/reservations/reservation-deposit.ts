import { BadRequestException } from "@nestjs/common";
import { DepositPoliciesService } from "../deposit-policies/deposit-policies.service";

type DepositResult = { depositAmount: number; depositPolicyVersion: string };
type DepositCalculator = Pick<DepositPoliciesService, "calculateDeposit">;

export async function calculateReservationDepositV2(
  depositPoliciesService: DepositCalculator,
  params: {
    campgroundId: string;
    siteClassId: string | null;
    totalAmountCents: number;
    lodgingOnlyCents: number;
    nights: number;
  },
): Promise<DepositResult> {
  const v2Calc = await depositPoliciesService.calculateDeposit(
    params.campgroundId,
    params.siteClassId,
    params.totalAmountCents,
    params.lodgingOnlyCents,
    params.nights,
  );

  if (!v2Calc) {
    return { depositAmount: 0, depositPolicyVersion: "v2:none" };
  }

  return {
    depositAmount: v2Calc.depositAmountCents,
    depositPolicyVersion: v2Calc.depositPolicyVersion,
  };
}

export async function assertReservationDepositV2(
  depositPoliciesService: DepositCalculator,
  params: {
    campgroundId: string;
    siteClassId: string | null;
    totalAmountCents: number;
    lodgingOnlyCents: number;
    paidAmountCents: number;
    nights: number;
  },
): Promise<DepositResult> {
  const v2Calc = await depositPoliciesService.calculateDeposit(
    params.campgroundId,
    params.siteClassId,
    params.totalAmountCents,
    params.lodgingOnlyCents,
    params.nights,
  );

  if (!v2Calc) {
    return { depositAmount: 0, depositPolicyVersion: "v2:none" };
  }

  if (params.paidAmountCents < v2Calc.depositAmountCents) {
    throw new BadRequestException(
      `Deposit of at least $${(v2Calc.depositAmountCents / 100).toFixed(2)} required (${v2Calc.policy.name}: ${v2Calc.policy.strategy})`,
    );
  }

  return {
    depositAmount: v2Calc.depositAmountCents,
    depositPolicyVersion: v2Calc.depositPolicyVersion,
  };
}
