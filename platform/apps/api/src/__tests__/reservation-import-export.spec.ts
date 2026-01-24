import { Test } from "@nestjs/testing";
import { reservationImportRecordSchema } from "../reservations/dto/reservation-import.dto";
import { ReservationImportExportService } from "../reservations/reservation-import-export.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationsService } from "../reservations/reservations.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { JobQueueService } from "../observability/job-queue.service";
import { AuditService } from "../audit/audit.service";
import { ObservabilityService } from "../observability/observability.service";

type PrismaMock = {
  reservation: { findMany: jest.Mock };
  integrationExportJob: { findMany: jest.Mock };
};

describe("Reservation import/export helpers", () => {
  it("rejects import rows where departure is not after arrival", () => {
    const result = reservationImportRecordSchema.safeParse({
      campgroundId: "camp-1",
      siteId: "site-1",
      guestId: "guest-1",
      arrivalDate: "2025-01-10",
      departureDate: "2025-01-09",
      adults: 2,
      totalAmount: 10000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("departureDate");
    }
  });

  it("paginates reservation export with resumable tokens", async () => {
    process.env.RESERVATION_EXPORT_MAX_ROWS = "5";
    const prismaStub: PrismaMock = {
      reservation: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: "r1",
              campgroundId: "camp-1",
              siteId: "s1",
              guestId: "g1",
              arrivalDate: new Date(),
              departureDate: new Date(),
              totalAmount: 1000,
              paidAmount: 500,
              status: "confirmed",
              source: "online",
              notes: null,
              createdAt: new Date(),
            },
            {
              id: "r2",
              campgroundId: "camp-1",
              siteId: "s1",
              guestId: "g1",
              arrivalDate: new Date(),
              departureDate: new Date(),
              totalAmount: 1000,
              paidAmount: 500,
              status: "confirmed",
              source: "online",
              notes: null,
              createdAt: new Date(),
            },
            {
              id: "r3",
              campgroundId: "camp-1",
              siteId: "s1",
              guestId: "g1",
              arrivalDate: new Date(),
              departureDate: new Date(),
              totalAmount: 1000,
              paidAmount: 500,
              status: "confirmed",
              source: "online",
              notes: null,
              createdAt: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "r4",
              campgroundId: "camp-1",
              siteId: "s1",
              guestId: "g1",
              arrivalDate: new Date(),
              departureDate: new Date(),
              totalAmount: 1000,
              paidAmount: 500,
              status: "confirmed",
              source: "online",
              notes: null,
              createdAt: new Date(),
            },
            {
              id: "r5",
              campgroundId: "camp-1",
              siteId: "s1",
              guestId: "g1",
              arrivalDate: new Date(),
              departureDate: new Date(),
              totalAmount: 1000,
              paidAmount: 500,
              status: "confirmed",
              source: "online",
              notes: null,
              createdAt: new Date(),
            },
          ]),
      },
      integrationExportJob: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const idempStub = {
      throttleScope: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationImportExportService,
        { provide: PrismaService, useValue: prismaStub },
        { provide: ReservationsService, useValue: {} },
        { provide: IdempotencyService, useValue: idempStub },
        {
          provide: JobQueueService,
          useValue: { getQueueState: () => ({ pending: 0, running: 0 }) },
        },
        { provide: AuditService, useValue: { recordExport: jest.fn() } },
        { provide: ObservabilityService, useValue: { recordJobRun: jest.fn() } },
      ],
    }).compile();

    const service = moduleRef.get(ReservationImportExportService);

    const first = await service.exportReservations({ campgroundId: "camp-1", pageSize: 3 });
    expect(first.rows).toHaveLength(3);
    expect(first.nextToken).toBeTruthy();

    const second = await service.exportReservations({
      campgroundId: "camp-1",
      paginationToken: first.nextToken ?? undefined,
      pageSize: 3,
    });
    expect(second.rows).toHaveLength(2);
    expect(second.nextToken).toBeNull();
    expect(second.emitted).toBe(5);

    await moduleRef.close();
  });
});
