import { Test, type TestingModule } from "@nestjs/testing";
import { PiiClassification, RedactionMode } from "@prisma/client";
import { PrivacyService } from "../privacy/privacy.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Privacy redaction preview", () => {
  let moduleRef: TestingModule;
  let service: PrivacyService;
  const campgroundId = "camp-privacy-preview";
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const piiTags: Array<{
    resource: string;
    field: string;
    classification: PiiClassification;
    redactionMode: RedactionMode | null;
  }> = [];
  const prismaStub = {
    piiFieldTag: {
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { resource_field: { resource: string; field: string } };
          create: {
            id?: string;
            resource: string;
            field: string;
            classification: PiiClassification;
            redactionMode?: RedactionMode | null;
          };
          update: { classification: PiiClassification; redactionMode?: RedactionMode | null };
        }) => {
          const index = piiTags.findIndex(
            (tag) =>
              tag.resource === where.resource_field.resource &&
              tag.field === where.resource_field.field,
          );
          if (index >= 0) {
            const existing = piiTags[index];
            const updated = {
              ...existing,
              classification: update.classification,
              redactionMode: update.redactionMode ?? existing.redactionMode,
            };
            piiTags[index] = updated;
            return updated;
          }
          const created = {
            resource: create.resource,
            field: create.field,
            classification: create.classification,
            redactionMode: create.redactionMode ?? null,
          };
          piiTags.push(created);
          return created;
        },
      ),
      findMany: jest.fn(async () => piiTags),
      deleteMany: jest.fn(async ({ where }: { where: { resource: string; field: string } }) => {
        let removed = 0;
        for (let i = piiTags.length - 1; i >= 0; i -= 1) {
          const tag = piiTags[i];
          if (tag.resource === where.resource && tag.field === where.field) {
            piiTags.splice(i, 1);
            removed += 1;
          }
        }
        return { count: removed };
      }),
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [PrivacyService, { provide: PrismaService, useValue: prismaStub }],
    }).compile();

    service = moduleRef.get(PrivacyService);

    await prismaStub.piiFieldTag.upsert({
      where: { resource_field: { resource: "guest", field: "ssn" } },
      update: { classification: PiiClassification.secret, redactionMode: RedactionMode.remove },
      create: {
        id: "pii-ssn",
        resource: "guest",
        field: "ssn",
        classification: PiiClassification.secret,
        redactionMode: RedactionMode.remove,
      },
    });
  });

  afterAll(async () => {
    await prismaStub.piiFieldTag.deleteMany({ where: { resource: "guest", field: "ssn" } });
    await moduleRef.close();
  });

  it("masks email/phone and drops removed fields via preview endpoint", async () => {
    const res = await service.previewRedaction(campgroundId, "guest", {
      email: "person@example.com",
      phone: "555-000-1111",
      ssn: "123-45-6789",
      notes: "Call back at 555-222-3333",
    });

    if (!isRecord(res.redacted)) {
      throw new Error("Expected redacted to be an object");
    }
    const redactedRecord = res.redacted;
    expect(redactedRecord.email).toBe("***@redacted");
    expect(redactedRecord.phone).toBe("***-***-****");
    expect(redactedRecord.ssn).toBeUndefined();
    expect(String(redactedRecord.notes)).toContain("***-***-****");
    expect(Array.isArray(res.rulesApplied)).toBe(true);
  });
});
