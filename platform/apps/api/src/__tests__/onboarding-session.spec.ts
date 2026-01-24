import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IdempotencyStatus, OnboardingStatus, OnboardingStep } from "@prisma/client";
import { OnboardingService } from "../onboarding/onboarding.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { IdempotencyService } from "../payments/idempotency.service";

type Invite = {
  id: string;
  token: string;
  email: string;
  expiresAt: Date;
  OnboardingSession?: Session | null;
  [key: string]: unknown;
};

type Session = {
  id: string;
  inviteId: string;
  status?: OnboardingStatus;
  [key: string]: unknown;
};

type InviteInput = {
  id?: string;
  token: string;
  email: string;
  expiresAt: Date;
  OnboardingSession?: Session | null;
  [key: string]: unknown;
};

type SessionInput = {
  id?: string;
  inviteId: string;
  status?: OnboardingStatus;
  [key: string]: unknown;
};

type PrismaMock = {
  onboardingInvite: {
    create: jest.Mock<Promise<Invite>, [{ data: InviteInput }]>;
    findUnique: jest.Mock<Promise<Invite | null>, [{ where: { token?: string; id?: string } }]>;
    update: jest.Mock<Promise<Invite>, [{ where: { id: string }; data: Partial<InviteInput> }]>;
  };
  onboardingSession: {
    create: jest.Mock<Promise<Session>, [{ data: SessionInput }]>;
    findUnique: jest.Mock<Promise<Session | null>, [{ where: { id: string } }]>;
    update: jest.Mock<Promise<Session>, [{ where: { id: string }; data: Partial<SessionInput> }]>;
  };
  campground: {
    findUnique: jest.Mock<
      Promise<{ id: string; slug: string; name: string } | null>,
      [{ where: { slug: string } }]
    >;
    create: jest.Mock<
      Promise<{ id: string; slug: string; name: string }>,
      [{ data: { id?: string; name: string; slug: string } }]
    >;
  };
};

type IdempotencyMock = {
  start: jest.Mock;
  complete: jest.Mock;
  fail: jest.Mock;
};

const buildPrisma = (): PrismaMock => {
  const invites: Invite[] = [];
  const sessions: Session[] = [];

  return {
    onboardingInvite: {
      create: jest.fn(async ({ data }: { data: InviteInput }) => {
        const invite: Invite = {
          ...data,
          id: data.id ?? `invite_${invites.length}`,
          OnboardingSession: null,
        };
        invites.push(invite);
        return invite;
      }),
      findUnique: jest.fn(async ({ where }: { where: { token?: string; id?: string } }) => {
        if (where?.token) return invites.find((invite) => invite.token === where.token) ?? null;
        if (where?.id) return invites.find((invite) => invite.id === where.id) ?? null;
        return null;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<InviteInput> }) => {
          const invite = invites.find((entry) => entry.id === where.id);
          if (!invite) throw new Error("not found");
          Object.assign(invite, data);
          return invite;
        },
      ),
    },
    onboardingSession: {
      create: jest.fn(async ({ data }: { data: SessionInput }) => {
        const session: Session = { ...data, id: data.id ?? `session_${sessions.length}` };
        sessions.push(session);
        const invite = invites.find((entry) => entry.id === data.inviteId);
        if (invite) invite.OnboardingSession = session;
        return session;
      }),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) =>
          sessions.find((entry) => entry.id === where.id) ?? null,
      ),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<SessionInput> }) => {
          const session = sessions.find((entry) => entry.id === where.id);
          if (!session) throw new Error("not found");
          Object.assign(session, data);
          return session;
        },
      ),
    },
    campground: {
      findUnique: jest.fn(async ({ where: _where }: { where: { slug: string } }) => null),
      create: jest.fn(async ({ data }: { data: { id?: string; name: string; slug: string } }) => ({
        id: data.id ?? `camp_${invites.length}`,
        name: data.name,
        slug: data.slug,
      })),
    },
  };
};

const buildIdempotency = (overrides: Partial<IdempotencyMock> = {}): IdempotencyMock => ({
  start: jest.fn().mockResolvedValue(undefined),
  complete: jest.fn().mockResolvedValue(undefined),
  fail: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const email = { sendEmail: jest.fn() };

const createService = async (prisma: PrismaMock, idempotency: IdempotencyMock) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      OnboardingService,
      { provide: PrismaService, useValue: prisma },
      { provide: EmailService, useValue: email },
      { provide: IdempotencyService, useValue: idempotency },
    ],
  }).compile();

  return { service: moduleRef.get(OnboardingService), close: () => moduleRef.close() };
};

describe("OnboardingService", () => {
  it("creates and resumes a session from the same invite token", async () => {
    const prisma = buildPrisma();
    await prisma.onboardingInvite.create({
      data: {
        email: "owner@camp.com",
        token: "tok-123",
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const idempotency = buildIdempotency();
    const { service, close } = await createService(prisma, idempotency);

    try {
      const first = await service.startSession({ token: "tok-123" });
      expect(first.session.status).toBe(OnboardingStatus.in_progress);

      const resumed = await service.startSession({ token: "tok-123" });
      expect(resumed.session.id).toBe(first.session.id);
    } finally {
      await close();
    }
  });

  it("rejects expired invites", async () => {
    const prisma = buildPrisma();
    await prisma.onboardingInvite.create({
      data: {
        email: "owner@camp.com",
        token: "expired-token",
        expiresAt: new Date(Date.now() - 10_000),
      },
    });

    const idempotency = buildIdempotency();
    const { service, close } = await createService(prisma, idempotency);
    try {
      await expect(service.startSession({ token: "expired-token" })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    } finally {
      await close();
    }
  });

  it("honors idempotent step saves", async () => {
    const prisma = buildPrisma();
    const invite = await prisma.onboardingInvite.create({
      data: {
        email: "owner@camp.com",
        token: "tok-abc",
        expiresAt: new Date(Date.now() + 3600_000),
        organizationId: "org-1",
      },
    });
    const idempotency = buildIdempotency({
      start: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          status: IdempotencyStatus.succeeded,
          responseJson: { cached: true },
        }),
    });
    const { service, close } = await createService(prisma, idempotency);

    try {
      const { session } = await service.startSession({ token: invite.token });

      await service.saveStep(
        session.id,
        invite.token,
        OnboardingStep.account_profile,
        { campgroundName: "Camp A", contactName: "Alex", contactEmail: "alex@camp.com" },
        "idem-1",
      );
      const second = await service.saveStep(
        session.id,
        invite.token,
        OnboardingStep.account_profile,
        { campgroundName: "Camp A", contactName: "Alex", contactEmail: "alex@camp.com" },
        "idem-1",
      );

      expect(second).toEqual({ cached: true });
    } finally {
      await close();
    }
  });

  it("validates step payloads", async () => {
    const prisma = buildPrisma();
    const invite = await prisma.onboardingInvite.create({
      data: {
        email: "owner@camp.com",
        token: "tok-bad",
        expiresAt: new Date(Date.now() + 3600_000),
        organizationId: "org-1",
      },
    });
    const idempotency = buildIdempotency();
    const { service, close } = await createService(prisma, idempotency);

    try {
      const { session } = await service.startSession({ token: invite.token });

      await expect(
        service.saveStep(session.id, invite.token, OnboardingStep.account_profile, {
          contactName: "Missing email",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      await close();
    }
  });
});
