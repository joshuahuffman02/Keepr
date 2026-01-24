import { Test, type TestingModule } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { GiftCardsService } from "../gift-cards/gift-cards.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoredValueService } from "../stored-value/stored-value.service";
import type { AuthUser } from "../auth/auth.types";

// Mock the ledger posting utility
jest.mock("../ledger/ledger-posting.util", () => ({
  postBalancedLedgerEntries: jest.fn().mockResolvedValue(undefined),
}));

describe("Gift cards & store credit redeem smoke", () => {
  let giftCards: GiftCardsService;
  let moduleRef: TestingModule;
  const storedValue = {
    balanceByAccount: jest.fn(),
    redeem: jest.fn(),
  };

  const prisma = {
    storedValueCode: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    reservation: {
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    storeOrder: {
      findUnique: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        GiftCardsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: StoredValueService,
          useValue: storedValue,
        },
      ],
    }).compile();

    giftCards = moduleRef.get(GiftCardsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    const storedValueCodes: Record<
      string,
      {
        accountId: string;
        active: boolean;
        StoredValueAccount: { id: string; status: string; currency: string; type: string };
      }
    > = {
      "CARD-BOOK-100": {
        accountId: "acc-book",
        active: true,
        StoredValueAccount: { id: "acc-book", status: "active", currency: "usd", type: "gift" },
      },
      "CREDIT-POS-20": {
        accountId: "acc-pos",
        active: true,
        StoredValueAccount: { id: "acc-pos", status: "active", currency: "usd", type: "credit" },
      },
    };

    prisma.storedValueCode.findUnique.mockImplementation(
      ({ where }: { where: { code: string } }) => storedValueCodes[where.code] ?? null,
    );
    storedValue.balanceByAccount.mockImplementation((accountId) => {
      if (accountId === "acc-book") return { balanceCents: 10000, availableCents: 10000 };
      if (accountId === "acc-pos") return { balanceCents: 2000, availableCents: 2000 };
      return { balanceCents: 0, availableCents: 0 };
    });
    storedValue.redeem.mockImplementation(({ code }) => {
      if (code === "CARD-BOOK-100") return { accountId: "acc-book", balanceCents: 7500 };
      if (code === "CREDIT-POS-20") return { accountId: "acc-pos", balanceCents: 500 };
      return { accountId: "acc-unknown", balanceCents: 0 };
    });

    // Mock transaction to execute the callback immediately
    prisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        ...prisma,
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: "booking-1",
            campgroundId: "camp-1",
            guestId: "guest-1",
            siteId: "site-1",
            paidAmount: 0,
            totalAmount: 10000,
            status: "confirmed",
          },
        ]),
      };
      return callback(mockTx);
    });

    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      SiteClass: {
        glCode: "SITE_REVENUE",
        clientAccount: "Site Revenue",
      },
    });

    prisma.storeOrder.findUnique.mockResolvedValue({
      id: "order-99",
      campgroundId: "camp-1",
    });

    prisma.reservation.update.mockResolvedValue({
      id: "booking-1",
      paidAmount: 2500,
    });

    prisma.payment.create.mockResolvedValue({
      id: "payment-1",
    });
  });

  const baseUser: AuthUser = {
    id: "user-1",
    email: "owner@keepr.test",
    firstName: "Casey",
    lastName: "Owner",
    region: null,
    platformRole: null,
    platformRegion: null,
    platformActive: true,
    ownershipRoles: [],
    role: UserRole.owner,
    memberships: [
      {
        id: "membership-1",
        campgroundId: "camp-1",
        role: UserRole.owner,
      },
    ],
  };

  it("redeems gift card against booking endpoint and returns updated balance", async () => {
    const actor = { ...baseUser, campgroundId: "camp-1" };
    const result = await giftCards.redeemAgainstBooking("CARD-BOOK-100", 2500, "booking-1", actor);

    expect(result.balanceCents).toBe(7500);
    const [firstCall] = storedValue.redeem.mock.calls;
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        code: "CARD-BOOK-100",
        amountCents: 2500,
        currency: "usd",
        referenceType: "reservation",
        referenceId: "booking-1",
      }),
    );
  });

  it("redeems store credit against POS endpoint and returns updated balance", async () => {
    const actor = { ...baseUser, campgroundId: "camp-1" };
    const result = await giftCards.redeemAgainstPosOrder("CREDIT-POS-20", 1500, "order-99", actor);

    expect(result.balanceCents).toBe(500);
    const [firstCall] = storedValue.redeem.mock.calls;
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        code: "CREDIT-POS-20",
        amountCents: 1500,
        currency: "usd",
        referenceType: "pos_order",
        referenceId: "order-99",
      }),
    );
  });
});
