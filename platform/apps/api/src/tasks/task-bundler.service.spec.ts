import { Test, TestingModule } from "@nestjs/testing";
import { TaskBundlerService } from "./task-bundler.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TaskBundlerService", () => {
    let moduleRef: TestingModule;
    let service: TaskBundlerService;
    let prisma: PrismaService;

    const mockTasks = [
        {
            id: "t1",
            siteId: "s1",
            priority: "high",
            slaStatus: "at_risk",
            tenantId: "camp1",
            state: "pending",
            slaDueAt: new Date(),
        },
        {
            id: "t2",
            siteId: "s1",
            priority: "low",
            slaStatus: "on_track",
            tenantId: "camp1",
            state: "pending",
            slaDueAt: new Date(),
        },
        {
            id: "t3",
            siteId: "s2",
            priority: "critical",
            slaStatus: "breached",
            tenantId: "camp1",
            state: "pending",
            slaDueAt: new Date(),
        },
    ];

    const mockSites = [
        { id: "s1", siteNumber: "A1" },
        { id: "s2", siteNumber: "B2" },
    ];

    beforeEach(async () => {
        moduleRef = await Test.createTestingModule({
            providers: [
                TaskBundlerService,
                {
                    provide: PrismaService,
                    useValue: {
                        task: {
                            findMany: jest.fn().mockResolvedValue(mockTasks),
                        },
                        site: {
                            findMany: jest.fn().mockResolvedValue(mockSites),
                        },
                    },
                },
            ],
        }).compile();

        service = moduleRef.get<TaskBundlerService>(TaskBundlerService);
        prisma = moduleRef.get<PrismaService>(PrismaService);
    });

    afterEach(async () => {
        await moduleRef?.close();
    });

    it("should be defined", () => {
        expect(service).toBeDefined();
    });

    it("should group tasks by site and calculate bundle metrics", async () => {
        const bundles = await service.getBundles("camp1");

        expect(bundles).toHaveLength(2);

        // Check Bundle 2 (s2) - Should be first because it is breached
        const bundleS2 = bundles[0];
        expect(bundleS2.siteId).toBe("s2");
        expect(bundleS2.siteNumber).toBe("B2");
        expect(bundleS2.slaStatus).toBe("breached"); // t3 is breached
        expect(bundleS2.bundlePriority).toBe(4); // critical = 4
        expect(bundleS2.taskCount).toBe(1);

        // Check Bundle 1 (s1)
        const bundleS1 = bundles[1];
        expect(bundleS1.siteId).toBe("s1");
        expect(bundleS1.siteNumber).toBe("A1");
        expect(bundleS1.slaStatus).toBe("at_risk"); // t1 is at_risk, t2 is on_track -> at_risk wins
        expect(bundleS1.bundlePriority).toBe(3); // high(3) > low(1)
        expect(bundleS1.taskCount).toBe(2);
    });
});
