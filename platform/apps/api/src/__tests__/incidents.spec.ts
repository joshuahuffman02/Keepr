import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { IncidentsService } from "../incidents/incidents.service";
import { EvidenceType, IncidentStatus, IncidentTaskStatus } from "@prisma/client";

describe("Incidents list", () => {
  let moduleRef: TestingModule;
  let service: IncidentsService;
  const prismaStub = {
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    incidentTask: { count: jest.fn().mockResolvedValue(0) },
    incidentEvidence: { create: jest.fn() },
    certificateOfInsurance: { create: jest.fn() },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [IncidentsService, { provide: PrismaService, useValue: prismaStub }],
    }).compile();
    service = moduleRef.get(IncidentsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("returns empty list for a campground", async () => {
    const result = await service.list("test-cg");
    expect(result).toEqual([]);
    expect(prismaStub.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campgroundId: "test-cg" } }),
    );
  });
});

describe("IncidentsService core flows", () => {
  type PrismaMock = {
    incident: { findUnique: jest.Mock; update: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock };
    incidentEvidence: { create: jest.Mock };
    incidentTask: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
    certificateOfInsurance: { create: jest.Mock };
  };

  let service: IncidentsService;
  let moduleRef: TestingModule;
  let prismaMock: PrismaMock;

  const baseIncident = {
    id: "inc-1",
    campgroundId: "cg-1",
    reservationId: null,
    guestId: null,
    notes: "initial",
    claimId: null,
  };

  beforeEach(async () => {
    prismaMock = {
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

    moduleRef = await Test.createTestingModule({
      providers: [IncidentsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(IncidentsService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await moduleRef.close();
  });

  it("attaches evidence when incident exists", async () => {
    await service.addEvidence(baseIncident.id, {
      type: EvidenceType.photo,
      url: "http://example.com/pic.jpg",
    });
    expect(prismaMock.incidentEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: baseIncident.id,
          url: "http://example.com/pic.jpg",
        }),
      }),
    );
  });

  it("adds closedAt when status transitions to closed", async () => {
    await service.update(baseIncident.id, { status: IncidentStatus.closed });
    const payload = prismaMock.incident.update.mock.calls[0][0].data;
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
