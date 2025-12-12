import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { IdempotencyStatus, OnboardingStatus, OnboardingStep } from "@prisma/client";
import { OnboardingService } from "../onboarding/onboarding.service";

const buildPrisma = () => {
  const invites: any[] = [];
  const sessions: any[] = [];

  return {
    onboardingInvite: {
      create: jest.fn(async ({ data }: any) => {
        const invite = { ...data, id: data.id ?? `invite_${invites.length}`, session: null };
        invites.push(invite);
        return invite;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.token) return invites.find((i) => i.token === where.token) ?? null;
        if (where?.id) return invites.find((i) => i.id === where.id) ?? null;
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const invite = invites.find((i) => i.id === where.id);
        if (!invite) throw new Error("not found");
        Object.assign(invite, data);
        return invite;
      }),
    },
    onboardingSession: {
      create: jest.fn(async ({ data }: any) => {
        const session = { ...data, id: data.id ?? `session_${sessions.length}` };
        sessions.push(session);
        const invite = invites.find((i) => i.id === data.inviteId);
        if (invite) invite.session = session;
        return session;
      }),
      findUnique: jest.fn(async ({ where }: any) => sessions.find((s) => s.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const session = sessions.find((s) => s.id === where.id);
        if (!session) throw new Error("not found");
        Object.assign(session, data);
        return session;
      }),
    },
  };
};

const buildIdempotency = () => ({
  start: jest.fn(),
  complete: jest.fn(),
});

const email = { sendEmail: jest.fn() };

describe("OnboardingService", () => {
  it("creates and resumes a session from the same invite token", async () => {
    const prisma = buildPrisma();
    await prisma.onboardingInvite.create({
      data: { email: "owner@camp.com", token: "tok-123", expiresAt: new Date(Date.now() + 3600_000) }
    });

    const service = new OnboardingService(prisma as any, email as any, buildIdempotency() as any);

    const first = await service.startSession({ token: "tok-123" });
    expect(first.session.status).toBe(OnboardingStatus.in_progress);

    const resumed = await service.startSession({ token: "tok-123" });
    expect(resumed.session.id).toBe(first.session.id);
  });

  it("rejects expired invites", async () => {
    const prisma = buildPrisma();
    await prisma.onboardingInvite.create({
      data: { email: "owner@camp.com", token: "expired-token", expiresAt: new Date(Date.now() - 10_000) }
    });

    const service = new OnboardingService(prisma as any, email as any, buildIdempotency() as any);
    await expect(service.startSession({ token: "expired-token" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("honors idempotent step saves", async () => {
    const prisma = buildPrisma();
    const invite = await prisma.onboardingInvite.create({
      data: { email: "owner@camp.com", token: "tok-abc", expiresAt: new Date(Date.now() + 3600_000) }
    });
    const idempotency = buildIdempotency();
    idempotency.start = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: IdempotencyStatus.succeeded, responseJson: { cached: true } });

    const service = new OnboardingService(prisma as any, email as any, idempotency as any);
    const { session } = await service.startSession({ token: invite.token });

    await service.saveStep(
      session.id,
      invite.token,
      OnboardingStep.account_profile,
      { campgroundName: "Camp A", contactName: "Alex", contactEmail: "alex@camp.com" },
      "idem-1"
    );
    const second = await service.saveStep(
      session.id,
      invite.token,
      OnboardingStep.account_profile,
      { campgroundName: "Camp A", contactName: "Alex", contactEmail: "alex@camp.com" },
      "idem-1"
    );

    expect(second).toEqual({ cached: true });
  });

  it("validates step payloads", async () => {
    const prisma = buildPrisma();
    const invite = await prisma.onboardingInvite.create({
      data: { email: "owner@camp.com", token: "tok-bad", expiresAt: new Date(Date.now() + 3600_000) }
    });
    const service = new OnboardingService(prisma as any, email as any, buildIdempotency() as any);
    const { session } = await service.startSession({ token: invite.token });

    await expect(
      service.saveStep(session.id, invite.token, OnboardingStep.account_profile, { contactName: "Missing email" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
