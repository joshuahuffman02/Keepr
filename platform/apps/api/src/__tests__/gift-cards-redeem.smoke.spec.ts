// @ts-nocheck
import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { GiftCardsController } from "../gift-cards/gift-cards.controller";
import { GiftCardsService } from "../gift-cards/gift-cards.service";
import { PrismaService } from "../prisma/prisma.service";
import { StoredValueService } from "../stored-value/stored-value.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";

// Mock the ledger posting utility
jest.mock("../ledger/ledger-posting.util", () => ({
  postBalancedLedgerEntries: jest.fn().mockResolvedValue(undefined)
}));

describe("Gift cards & store credit redeem smoke", () => {
  let app: any;
  let storedValue: any;

  const prisma = {
    storedValueCode: {
      findUnique: jest.fn()
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    reservation: {
      update: jest.fn()
    },
    payment: {
      create: jest.fn()
    },
    storeOrder: {
      findUnique: jest.fn()
    },
    site: {
      findUnique: jest.fn()
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GiftCardsController],
      providers: [
        GiftCardsService,
        {
          provide: PrismaService,
          useValue: prisma
        },
        {
          provide: StoredValueService,
          useValue: {
            balanceByAccount: jest.fn(),
            redeem: jest.fn()
          }
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: "user-1",
            role: "owner",
            platformRole: null,
            memberships: [{ campgroundId: "camp-1" }]
          };
          return true;
        }
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    storedValue = moduleRef.get(StoredValueService);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    const storedValueCodes = {
      "CARD-BOOK-100": {
        accountId: "acc-book",
        active: true,
        account: { id: "acc-book", status: "active", currency: "usd", type: "gift" }
      },
      "CREDIT-POS-20": {
        accountId: "acc-pos",
        active: true,
        account: { id: "acc-pos", status: "active", currency: "usd", type: "credit" }
      }
    };

    prisma.storedValueCode.findUnique.mockImplementation(({ where }) => storedValueCodes[where.code] ?? null);
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
        $queryRaw: jest.fn().mockResolvedValue([{
          id: "booking-1",
          campgroundId: "camp-1",
          guestId: "guest-1",
          siteId: "site-1",
          paidAmount: 0,
          totalAmount: 10000,
          status: "confirmed"
        }])
      };
      return callback(mockTx);
    });

    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      siteClass: {
        glCode: "SITE_REVENUE",
        clientAccount: "Site Revenue"
      }
    });

    prisma.storeOrder.findUnique.mockResolvedValue({
      id: "order-99",
      campgroundId: "camp-1"
    });

    prisma.reservation.update.mockResolvedValue({
      id: "booking-1",
      paidAmount: 2500
    });

    prisma.payment.create.mockResolvedValue({
      id: "payment-1"
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("redeems gift card against booking endpoint and returns updated balance", async () => {
    const api = request(app.getHttpServer());

    const res = await api
      .post("/api/bookings/booking-1/gift-cards/redeem")
      .set("x-campground-id", "camp-1")
      .send({ code: "CARD-BOOK-100", amountCents: 2500 })
      .expect(200);

    expect(res.body.balanceCents).toBe(7500);
    const [firstCall] = storedValue.redeem.mock.calls;
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        code: "CARD-BOOK-100",
        amountCents: 2500,
        currency: "usd",
        referenceType: "reservation",
        referenceId: "booking-1"
      })
    );
  });

  it("redeems store credit against POS endpoint and returns updated balance", async () => {
    const api = request(app.getHttpServer());

    const res = await api
      .post("/api/pos/orders/order-99/gift-cards/redeem")
      .set("x-campground-id", "camp-1")
      .send({ code: "CREDIT-POS-20", amountCents: 1500 })
      .expect(200);

    expect(res.body.balanceCents).toBe(500);
    const [firstCall] = storedValue.redeem.mock.calls;
    expect(firstCall?.[0]).toEqual(
      expect.objectContaining({
        code: "CREDIT-POS-20",
        amountCents: 1500,
        currency: "usd",
        referenceType: "pos_order",
        referenceId: "order-99"
      })
    );
  });
});
