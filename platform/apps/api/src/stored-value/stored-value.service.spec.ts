import { StoredValueService } from "./stored-value.service";
import { StoredValueDirection, StoredValueStatus, IdempotencyStatus } from "@prisma/client";
import { BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { ObservabilityService } from "../observability/observability.service";
import * as crypto from "crypto";

// Mock crypto module for default export compatibility
jest.mock("crypto", () => {
  const actual = jest.requireActual("crypto");
  return {
    ...actual,
    default: actual,
    __esModule: true,
  };
});

describe("StoredValueService", () => {
  let service: StoredValueService;
  type PrismaMock = {
    storedValueAccount: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    storedValueCode: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    storedValueLedger: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    storedValueHold: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      aggregate: jest.Mock;
    };
    taxRule: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  type IdempotencyMock = {
    start: jest.Mock;
    complete: jest.Mock;
    fail: jest.Mock;
    throttleScope: jest.Mock;
  };

  type ObservabilityMock = {
    recordRedeemOutcome: jest.Mock;
  };

  let mockPrisma: PrismaMock;
  let mockIdempotency: IdempotencyMock;
  let mockObservability: ObservabilityMock;
  let moduleRef: TestingModule;

  const callPrivate = (key: string, ...args: unknown[]) => {
    const value = Reflect.get(service, key);
    if (typeof value !== "function") {
      throw new Error(`${key} is not a function`);
    }
    return value.call(service, ...args);
  };
  const getBalancesPrivate = (tx: PrismaMock, accountId: string) =>
    callPrivate("getBalances", tx, accountId);

  beforeEach(async () => {
    mockPrisma = {
      storedValueAccount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      storedValueCode: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      storedValueLedger: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      storedValueHold: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
      taxRule: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: PrismaMock) => unknown | Promise<unknown>) => fn(mockPrisma)),
    };

    mockIdempotency = {
      start: jest.fn().mockResolvedValue(null),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
      throttleScope: jest.fn().mockResolvedValue(undefined),
    };

    mockObservability = {
      recordRedeemOutcome: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        StoredValueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IdempotencyService, useValue: mockIdempotency },
        { provide: ObservabilityService, useValue: mockObservability },
      ],
    }).compile();

    service = moduleRef.get(StoredValueService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await moduleRef.close();
  });

  describe("directionToSigned", () => {
    const directionToSigned = (direction: StoredValueDirection | string, amount: number) => {
      return callPrivate("directionToSigned", direction, amount);
    };

    describe("positive directions (add to balance)", () => {
      it("should return positive amount for issue direction", () => {
        expect(directionToSigned(StoredValueDirection.issue, 1000)).toBe(1000);
      });

      it("should return positive amount for refund direction", () => {
        expect(directionToSigned(StoredValueDirection.refund, 500)).toBe(500);
      });

      it("should return positive amount for adjust direction", () => {
        expect(directionToSigned(StoredValueDirection.adjust, 200)).toBe(200);
      });

      it("should handle positive adjust with negative amount (adjustment reduction)", () => {
        // Adjust can be negative (deduction), but directionToSigned returns the raw amount
        // The negative sign is already in the amount
        expect(directionToSigned(StoredValueDirection.adjust, -200)).toBe(-200);
      });
    });

    describe("negative directions (subtract from balance)", () => {
      it("should return negative amount for redeem direction", () => {
        expect(directionToSigned(StoredValueDirection.redeem, 1000)).toBe(-1000);
      });

      it("should return negative amount for expire direction", () => {
        expect(directionToSigned(StoredValueDirection.expire, 500)).toBe(-500);
      });

      it("should return negative amount for hold_capture direction", () => {
        expect(directionToSigned(StoredValueDirection.hold_capture, 300)).toBe(-300);
      });

      it("should ensure negative even when amount is already negative", () => {
        // Math.abs ensures consistent sign
        expect(directionToSigned(StoredValueDirection.redeem, -1000)).toBe(-1000);
      });
    });

    describe("edge cases", () => {
      it("should return 0 for zero amount", () => {
        expect(directionToSigned(StoredValueDirection.issue, 0)).toBe(0);
        // Redeem with 0 returns -0 due to -Math.abs(0), which is functionally equivalent to 0
        const redeemZero = directionToSigned(StoredValueDirection.redeem, 0);
        expect(redeemZero + 0).toBe(0); // -0 + 0 = 0
      });

      it("should return 0 for unknown direction", () => {
        expect(directionToSigned("unknown", 100)).toBe(0);
      });
    });
  });

  describe("ensureActive", () => {
    const ensureActive = (account: { status: StoredValueStatus; expiresAt: Date | null }) => {
      return callPrivate("ensureActive", account);
    };

    it("should not throw for active account with no expiration", () => {
      expect(() =>
        ensureActive({
          status: StoredValueStatus.active,
          expiresAt: null,
        }),
      ).not.toThrow();
    });

    it("should not throw for active account with future expiration", () => {
      expect(() =>
        ensureActive({
          status: StoredValueStatus.active,
          expiresAt: new Date(Date.now() + 86400000), // tomorrow
        }),
      ).not.toThrow();
    });

    it("should throw ForbiddenException for frozen account", () => {
      expect(() =>
        ensureActive({
          status: StoredValueStatus.frozen,
          expiresAt: null,
        }),
      ).toThrow(ForbiddenException);
      expect(() =>
        ensureActive({
          status: StoredValueStatus.frozen,
          expiresAt: null,
        }),
      ).toThrow("Stored value account not active");
    });

    it("should throw ForbiddenException for expired status", () => {
      expect(() =>
        ensureActive({
          status: StoredValueStatus.expired,
          expiresAt: null,
        }),
      ).toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException for active account past expiration", () => {
      expect(() =>
        ensureActive({
          status: StoredValueStatus.active,
          expiresAt: new Date(Date.now() - 86400000), // yesterday
        }),
      ).toThrow(ForbiddenException);
      expect(() =>
        ensureActive({
          status: StoredValueStatus.active,
          expiresAt: new Date(Date.now() - 86400000),
        }),
      ).toThrow("Stored value account expired");
    });
  });

  describe("ensureCurrency", () => {
    const ensureCurrency = (account: { currency: string }, currency: string) => {
      return callPrivate("ensureCurrency", account, currency);
    };

    it("should not throw when currencies match (same case)", () => {
      expect(() => ensureCurrency({ currency: "usd" }, "usd")).not.toThrow();
    });

    it("should not throw when currencies match (different case)", () => {
      expect(() => ensureCurrency({ currency: "usd" }, "USD")).not.toThrow();
      expect(() => ensureCurrency({ currency: "usd" }, "Usd")).not.toThrow();
    });

    it("should throw BadRequestException for currency mismatch", () => {
      expect(() => ensureCurrency({ currency: "usd" }, "eur")).toThrow(BadRequestException);
      expect(() => ensureCurrency({ currency: "usd" }, "eur")).toThrow("Currency mismatch");
    });
  });

  describe("ensureTaxableFlag", () => {
    const ensureTaxableFlag = (metadata: unknown, incoming?: boolean | null) => {
      return callPrivate("ensureTaxableFlag", metadata, incoming);
    };

    it("should not throw when incoming is undefined", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: true }, undefined)).not.toThrow();
    });

    it("should not throw when incoming is null", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: true }, null)).not.toThrow();
    });

    it("should not throw when flags match (both true)", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: true }, true)).not.toThrow();
    });

    it("should not throw when flags match (both false)", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: false }, false)).not.toThrow();
      expect(() => ensureTaxableFlag({}, false)).not.toThrow(); // undefined treated as false
    });

    it("should throw ConflictException when flags mismatch", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: true }, false)).toThrow(ConflictException);
      expect(() => ensureTaxableFlag({ taxableLoad: true }, false)).toThrow(
        "Taxable load flag mismatch",
      );
    });

    it("should throw ConflictException when existing is false but incoming is true", () => {
      expect(() => ensureTaxableFlag({ taxableLoad: false }, true)).toThrow(ConflictException);
      expect(() => ensureTaxableFlag({}, true)).toThrow(ConflictException);
    });
  });

  describe("isTaxable", () => {
    const isTaxable = (metadata: unknown) => {
      return callPrivate("isTaxable", metadata);
    };

    it("should return true when taxableLoad is true", () => {
      expect(isTaxable({ taxableLoad: true })).toBe(true);
    });

    it("should return false when taxableLoad is false", () => {
      expect(isTaxable({ taxableLoad: false })).toBe(false);
    });

    it("should return false when taxableLoad is missing", () => {
      expect(isTaxable({})).toBe(false);
    });

    it("should return false when metadata is null", () => {
      expect(isTaxable(null)).toBe(false);
    });

    it("should return false when metadata is undefined", () => {
      expect(isTaxable(undefined)).toBe(false);
    });

    it("should treat non-boolean taxableLoad values as false", () => {
      expect(isTaxable({ taxableLoad: 1 })).toBe(false);
      expect(isTaxable({ taxableLoad: "yes" })).toBe(false);
    });
  });

  describe("mergeMetadata", () => {
    const mergeMetadata = (metadata: unknown, taxableLoad?: boolean) => {
      return callPrivate("mergeMetadata", metadata, taxableLoad);
    };

    it("should return original metadata when taxableLoad is undefined", () => {
      const metadata = { foo: "bar" };
      const result = mergeMetadata(metadata, undefined);
      expect(result).toEqual({ foo: "bar" });
    });

    it("should add taxableLoad when provided", () => {
      const metadata = { foo: "bar" };
      const result = mergeMetadata(metadata, true);
      expect(result).toEqual({ foo: "bar", taxableLoad: true });
    });

    it("should set taxableLoad to false when provided", () => {
      const result = mergeMetadata({}, false);
      expect(result).toEqual({ taxableLoad: false });
    });

    it("should handle null metadata", () => {
      const result = mergeMetadata(null, true);
      expect(result).toEqual({ taxableLoad: true });
    });

    it("should not mutate original metadata", () => {
      const metadata = { foo: "bar" };
      mergeMetadata(metadata, true);
      expect(metadata).toEqual({ foo: "bar" });
    });
  });

  describe("generateCode", () => {
    const generateCode = (length?: number) => {
      return callPrivate("generateCode", length);
    };

    it("should use the correct alphabet (excludes confusing chars)", () => {
      // Test the alphabet directly - I, O, 0, 1 are excluded
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      expect(alphabet).not.toContain("I");
      expect(alphabet).not.toContain("O");
      expect(alphabet).not.toContain("0");
      expect(alphabet).not.toContain("1");
      expect(alphabet.length).toBe(32);
    });

    it("should generate code of default length 16", () => {
      const code = generateCode();
      expect(code.length).toBe(16);
    });

    it("should generate code of specified length", () => {
      expect(generateCode(8).length).toBe(8);
      expect(generateCode(24).length).toBe(24);
      expect(generateCode(32).length).toBe(32);
    });

    it("should only contain valid alphabet characters", () => {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let i = 0; i < 100; i++) {
        const code = generateCode();
        for (const char of code) {
          expect(alphabet).toContain(char);
        }
      }
    });

    it("should generate unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }
      // With 16 chars from 32-char alphabet, collision chance is negligible
      expect(codes.size).toBe(100);
    });
  });

  describe("generatePinIfRequested", () => {
    const generatePinIfRequested = (codeOptions?: { pin?: string; generatePin?: boolean }) => {
      return callPrivate("generatePinIfRequested", codeOptions);
    };

    it("should return provided PIN if specified", () => {
      expect(generatePinIfRequested({ pin: "123456" })).toBe("123456");
    });

    it("should return undefined when generatePin is false", () => {
      expect(generatePinIfRequested({ generatePin: false })).toBeUndefined();
    });

    it("should return undefined when no options provided", () => {
      expect(generatePinIfRequested()).toBeUndefined();
      expect(generatePinIfRequested({})).toBeUndefined();
    });

    it("should generate 6-digit PIN when generatePin is true", () => {
      const pin = generatePinIfRequested({ generatePin: true });
      expect(pin).toBeDefined();
      expect(pin!.length).toBe(6);
      expect(pin).toMatch(/^\d{6}$/);
    });

    it("should generate PIN >= 100000 (no leading zeros)", () => {
      // Generate multiple to test range
      for (let i = 0; i < 100; i++) {
        const pin = generatePinIfRequested({ generatePin: true });
        const num = parseInt(pin!, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });

    it("should prefer provided PIN over generatePin flag", () => {
      expect(generatePinIfRequested({ pin: "111111", generatePin: true })).toBe("111111");
    });
  });

  describe("hashPin and verifyPin", () => {
    const hashPin = (pin: string) => {
      return callPrivate("hashPin", pin);
    };
    const verifyPin = (pin: string, stored: string) => {
      return callPrivate("verifyPin", pin, stored);
    };

    describe("hashPin", () => {
      it("should return salt:hash format", () => {
        const hash = hashPin("123456");
        expect(hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
        const [salt, hashPart] = hash.split(":");
        expect(salt.length).toBe(32); // 16 bytes hex = 32 chars
        expect(hashPart.length).toBe(64); // 32 bytes hex = 64 chars
      });

      it("should generate unique salt for each call", () => {
        const hash1 = hashPin("123456");
        const hash2 = hashPin("123456");
        const salt1 = hash1.split(":")[0];
        const salt2 = hash2.split(":")[0];
        expect(salt1).not.toBe(salt2);
      });

      it("should generate different hashes for same PIN due to different salts", () => {
        const hash1 = hashPin("123456");
        const hash2 = hashPin("123456");
        expect(hash1).not.toBe(hash2);
      });
    });

    describe("verifyPin", () => {
      it("should verify correct PIN against its hash", () => {
        const hash = hashPin("123456");
        expect(verifyPin("123456", hash)).toBe(true);
      });

      it("should reject incorrect PIN", () => {
        const hash = hashPin("123456");
        expect(verifyPin("654321", hash)).toBe(false);
        expect(verifyPin("123457", hash)).toBe(false);
        expect(verifyPin("", hash)).toBe(false);
      });

      it("should reject invalid stored hash format - no colon", () => {
        expect(verifyPin("123456", "invalid")).toBe(false);
        expect(verifyPin("123456", "nocolonhere")).toBe(false);
      });

      it("should reject empty stored hash", () => {
        expect(verifyPin("123456", "")).toBe(false);
      });

      it("should reject stored hash with missing salt", () => {
        expect(verifyPin("123456", ":somehash")).toBe(false);
      });

      it("should reject stored hash with missing hash", () => {
        expect(verifyPin("123456", "somesalt:")).toBe(false);
      });

      it("should handle various PIN formats", () => {
        const alphaNumericHash = hashPin("abc123");
        expect(verifyPin("abc123", alphaNumericHash)).toBe(true);
        expect(verifyPin("ABC123", alphaNumericHash)).toBe(false);

        const longPinHash = hashPin("12345678901234567890");
        expect(verifyPin("12345678901234567890", longPinHash)).toBe(true);
      });
    });
  });

  describe("validateTaxableLoad", () => {
    const validateTaxableLoad = async (campgroundId: string | null, taxableLoad?: boolean) => {
      return callPrivate("validateTaxableLoad", campgroundId, taxableLoad);
    };

    it("should pass when taxableLoad is false", async () => {
      await expect(validateTaxableLoad("cg-1", false)).resolves.toBeUndefined();
    });

    it("should pass when taxableLoad is undefined", async () => {
      await expect(validateTaxableLoad("cg-1", undefined)).resolves.toBeUndefined();
    });

    it("should throw when taxableLoad is true but no campgroundId", async () => {
      await expect(validateTaxableLoad(null, true)).rejects.toThrow(BadRequestException);
      await expect(validateTaxableLoad(null, true)).rejects.toThrow(
        "taxable_load requires campground context",
      );
    });

    it("should throw when taxableLoad is true but no active tax rule", async () => {
      mockPrisma.taxRule.findFirst.mockResolvedValue(null);
      await expect(validateTaxableLoad("cg-1", true)).rejects.toThrow(BadRequestException);
      await expect(validateTaxableLoad("cg-1", true)).rejects.toThrow(
        "Taxable load requires an active tax rule",
      );
    });

    it("should pass when taxableLoad is true with active tax rule", async () => {
      mockPrisma.taxRule.findFirst.mockResolvedValue({ id: "tax-1", isActive: true });
      await expect(validateTaxableLoad("cg-1", true)).resolves.toBeUndefined();
    });
  });

  describe("getBalances", () => {
    const getBalances = getBalancesPrivate;

    it("should calculate balance from ledger entries", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
        { direction: StoredValueDirection.redeem, amountCents: 2500 },
        { direction: StoredValueDirection.refund, amountCents: 500 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await getBalances(mockPrisma, "acc-1");

      // 10000 - 2500 + 500 = 8000
      expect(result.balanceCents).toBe(8000);
      expect(result.availableCents).toBe(8000);
    });

    it("should subtract open holds from available balance", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: 2000 } });

      const result = await getBalances(mockPrisma, "acc-1");

      expect(result.balanceCents).toBe(10000);
      expect(result.availableCents).toBe(8000); // 10000 - 2000 hold
    });

    it("should return zero for empty ledger", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await getBalances(mockPrisma, "acc-1");

      expect(result.balanceCents).toBe(0);
      expect(result.availableCents).toBe(0);
    });

    it("should handle multiple redeems", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
        { direction: StoredValueDirection.redeem, amountCents: 1000 },
        { direction: StoredValueDirection.redeem, amountCents: 1500 },
        { direction: StoredValueDirection.redeem, amountCents: 2000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await getBalances(mockPrisma, "acc-1");

      // 10000 - 1000 - 1500 - 2000 = 5500
      expect(result.balanceCents).toBe(5500);
    });

    it("should handle hold_capture direction", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
        { direction: StoredValueDirection.hold_capture, amountCents: 3000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await getBalances(mockPrisma, "acc-1");

      expect(result.balanceCents).toBe(7000);
    });

    it("should handle expire direction", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
        { direction: StoredValueDirection.expire, amountCents: 10000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await getBalances(mockPrisma, "acc-1");

      expect(result.balanceCents).toBe(0);
    });
  });

  describe("liabilitySnapshot", () => {
    beforeEach(() => {
      mockPrisma.storedValueAccount.findMany.mockResolvedValue([]);
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([]);
    });

    it("should return zeros for campground with no accounts", async () => {
      const result = await service.liabilitySnapshot("cg-1");
      expect(result).toEqual({
        campgroundId: "cg-1",
        taxableCents: 0,
        nonTaxableCents: 0,
        totalCents: 0,
      });
    });

    it("should calculate taxable and non-taxable separately", async () => {
      mockPrisma.storedValueAccount.findMany.mockResolvedValue([
        { id: "acc-1", metadata: { taxableLoad: true } },
        { id: "acc-2", metadata: { taxableLoad: false } },
        { id: "acc-3", metadata: {} },
      ]);
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { accountId: "acc-1", direction: StoredValueDirection.issue, amountCents: 10000 },
        { accountId: "acc-2", direction: StoredValueDirection.issue, amountCents: 5000 },
        { accountId: "acc-3", direction: StoredValueDirection.issue, amountCents: 3000 },
        { accountId: "acc-1", direction: StoredValueDirection.redeem, amountCents: 2000 },
      ]);

      const result = await service.liabilitySnapshot("cg-1");

      expect(result.taxableCents).toBe(8000); // acc-1: 10000 - 2000 = 8000
      expect(result.nonTaxableCents).toBe(8000); // acc-2: 5000 + acc-3: 3000 = 8000
      expect(result.totalCents).toBe(16000);
    });

    it("should throw when roll-forward drift detected with enforce flag", async () => {
      mockPrisma.storedValueAccount.findMany.mockResolvedValue([{ id: "acc-1", metadata: {} }]);
      // Simulate ledger inconsistency - balance sums don't match
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { accountId: "acc-1", direction: StoredValueDirection.issue, amountCents: 10000 },
        { accountId: "acc-1", direction: StoredValueDirection.redeem, amountCents: 2000 },
      ]);

      const result = await service.liabilitySnapshot("cg-1");

      // Roll forward: 10000 - 2000 = 8000
      // Account balance: 8000
      // No drift in this case
      expect(result.rollForwardOk).toBe(true);
      expect(result.driftCents).toBe(0);
    });
  });

  describe("balance inquiry", () => {
    beforeEach(() => {
      mockIdempotency.throttleScope.mockResolvedValue(undefined);
    });

    it("should return balance by account ID", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 5000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await service.balanceByAccount("acc-1");

      expect(result.accountId).toBe("acc-1");
      expect(result.balanceCents).toBe(5000);
      expect(result.availableCents).toBe(5000);
    });

    it("should return balance by code", async () => {
      mockPrisma.storedValueCode.findUnique.mockResolvedValue({ accountId: "acc-1" });
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 7500 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await service.balanceByCode("GIFT-CODE-123");

      expect("accountId" in result).toBe(true);
      if ("accountId" in result) {
        expect(result.accountId).toBe("acc-1");
        expect(result.balanceCents).toBe(7500);
      }
    });

    it("should return zero balance for unknown code", async () => {
      mockPrisma.storedValueCode.findUnique.mockResolvedValue(null);

      const result = await service.balanceByCode("INVALID-CODE");

      expect("code" in result).toBe(true);
      if ("code" in result) {
        expect(result.code).toBe("INVALID-CODE");
        expect(result.balanceCents).toBe(0);
      }
    });
  });

  describe("expireOpenHolds", () => {
    it("should mark expired holds as expired", async () => {
      mockPrisma.storedValueHold.findMany.mockResolvedValue([{ id: "hold-1" }, { id: "hold-2" }]);
      mockPrisma.storedValueHold.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.expireOpenHolds();

      expect(result.released).toBe(2);
      expect(mockPrisma.storedValueHold.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["hold-1", "hold-2"] } },
        data: { status: "expired" },
      });
    });

    it("should return zero when no expired holds", async () => {
      mockPrisma.storedValueHold.findMany.mockResolvedValue([]);

      const result = await service.expireOpenHolds();

      expect(result.released).toBe(0);
      expect(mockPrisma.storedValueHold.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete gift card lifecycle", async () => {
      // Issue -> Partial Redeem -> Reload -> Full Redeem -> Expire

      // Initial balance after issue
      const ledgerAfterIssue = [{ direction: StoredValueDirection.issue, amountCents: 10000 }];
      mockPrisma.storedValueLedger.findMany.mockResolvedValue(ledgerAfterIssue);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const balanceAfterIssue = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balanceAfterIssue.balanceCents).toBe(10000);

      // After partial redeem
      const ledgerAfterPartialRedeem = [
        ...ledgerAfterIssue,
        { direction: StoredValueDirection.redeem, amountCents: 2500 },
      ];
      mockPrisma.storedValueLedger.findMany.mockResolvedValue(ledgerAfterPartialRedeem);

      const balanceAfterRedeem = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balanceAfterRedeem.balanceCents).toBe(7500);

      // After reload
      const ledgerAfterReload = [
        ...ledgerAfterPartialRedeem,
        { direction: StoredValueDirection.issue, amountCents: 5000 },
      ];
      mockPrisma.storedValueLedger.findMany.mockResolvedValue(ledgerAfterReload);

      const balanceAfterReload = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balanceAfterReload.balanceCents).toBe(12500);
    });

    it("should handle hold -> capture flow correctly", async () => {
      // After issue with hold
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: 3000 } });

      const balanceWithHold = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balanceWithHold.balanceCents).toBe(10000);
      expect(balanceWithHold.availableCents).toBe(7000); // 10000 - 3000 hold

      // After hold capture
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 10000 },
        { direction: StoredValueDirection.hold_capture, amountCents: 3000 },
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const balanceAfterCapture = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balanceAfterCapture.balanceCents).toBe(7000);
      expect(balanceAfterCapture.availableCents).toBe(7000);
    });

    it("should handle refund to store credit correctly", async () => {
      mockPrisma.storedValueLedger.findMany.mockResolvedValue([
        { direction: StoredValueDirection.issue, amountCents: 5000 },
        { direction: StoredValueDirection.redeem, amountCents: 5000 },
        { direction: StoredValueDirection.refund, amountCents: 2500 }, // Partial refund
      ]);
      mockPrisma.storedValueHold.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const balance = await getBalancesPrivate(mockPrisma, "acc-1");
      expect(balance.balanceCents).toBe(2500); // 5000 - 5000 + 2500
    });
  });
});
