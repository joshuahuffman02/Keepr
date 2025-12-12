import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { IncidentsModule } from "../incidents/incidents.module";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/guards";
import { RolesGuard } from "../auth/guards/roles.guard";
import { IncidentsService } from "../incidents/incidents.service";
import { EvidenceType, IncidentStatus, IncidentTaskStatus } from "@prisma/client";

describe("Incidents permissions", () => {
  let app: INestApplication;
  const prismaStub = {
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    incidentTask: { count: jest.fn().mockResolvedValue(0) },
    incidentEvidence: { create: jest.fn() },
    certificateOfInsurance: { create: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IncidentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => false })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("blocks unauthenticated access", async () => {
    await request(app.getHttpServer()).get("/api/incidents?campgroundId=test-cg").expect(403);
  });
});

describe("IncidentsService core flows", () => {
  const baseIncident = {
    id: "inc-1",
    campgroundId: "cg-1",
    reservationId: null,
    guestId: null,
    notes: "initial",
    claimId: null,
  };
  const prismaMock = {
    incident: {
      findUnique: jest.fn().mockResolvedValue(baseIncident),
      update: jest.fn().mockResolvedValue(baseIncident),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([baseIncident]),
    },
    incidentEvidence: { create: jest.fn().mockResolvedValue({ id: "ev-1" }) },
    incidentTask: {
      create: jest.fn().mockResolvedValue({ id: "task-1", status: IncidentTaskStatus.pending }),
      findUnique: jest.fn().mockResolvedValue({ id: "task-1", incidentId: baseIncident.id }),
      update: jest.fn().mockResolvedValue({ id: "task-1", status: IncidentTaskStatus.done }),
      count: jest.fn().mockResolvedValue(0),
    },
    certificateOfInsurance: { create: jest.fn().mockResolvedValue({ id: "coi-1" }) },
  };

  const service = new IncidentsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches evidence when incident exists", async () => {
    await service.addEvidence(baseIncident.id, { type: EvidenceType.photo, url: "http://example.com/pic.jpg" });
    expect(prismaMock.incidentEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ incidentId: baseIncident.id, url: "http://example.com/pic.jpg" }),
      }),
    );
  });

  it("adds closedAt when status transitions to closed", async () => {
    await service.update(baseIncident.id, { status: IncidentStatus.closed });
    const payload = (prismaMock.incident.update as jest.Mock).mock.calls[0][0].data;
    expect(payload.closedAt).toBeInstanceOf(Date);
  });

  it("sets reminder on incident", async () => {
    const reminderAt = new Date().toISOString();
    await service.setReminder(baseIncident.id, { reminderAt });
    expect(prismaMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reminderAt: new Date(reminderAt) }),
      }),
    );
  });
});
