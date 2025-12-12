import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { OtaController } from "../ota/ota.controller";
import { OtaService } from "../ota/ota.service";
import { JwtAuthGuard } from "../auth/guards";
import { PrismaService } from "../prisma/prisma.service";

describe("OTA monitor/alerts", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OtaController],
      providers: [
        OtaService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns monitor shape", async () => {
    const res = await request(app.getHttpServer()).get("/api/ota/monitor").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns alerts thresholds shape", async () => {
    const res = await request(app.getHttpServer()).get("/api/ota/alerts").expect(200);
    expect(res.body).toMatchObject({
      thresholds: expect.any(Object),
      freshnessBreaches: expect.any(Array),
      webhookBreaches: expect.any(Array),
    });
  });
});
