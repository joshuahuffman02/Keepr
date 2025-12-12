import { StaffService } from "../staff/staff.service";
import { aggregateExportRows, formatOnPayCsv, minutesBetween } from "../staff/payroll.service";

const buildService = (overrides: Partial<any> = {}) => {
  const prisma = {
    staffShift: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    staffTimeEntry: {
      updateMany: jest.fn()
    },
    shiftApproval: {
      create: jest.fn()
    },
    ...overrides
  } as any;

  const audit = { record: jest.fn() } as any;
  return { service: new StaffService(prisma, audit), prisma };
};

describe("shift calculations", () => {
  it("calculates minutes between two punches", () => {
    const minutes = minutesBetween({
      clockInAt: new Date("2024-01-01T10:00:00Z"),
      clockOutAt: new Date("2024-01-01T11:15:00Z")
    });
    expect(minutes).toBe(75);
  });

  it("approves shift and totals minutes from time entries", async () => {
    const { service, prisma } = buildService();
    prisma.staffShift.findUnique.mockResolvedValue({
      id: "shift-1",
      timeEntries: [
        { clockInAt: new Date("2024-01-01T10:00:00Z"), clockOutAt: new Date("2024-01-01T12:00:00Z") },
        { clockInAt: new Date("2024-01-01T13:00:00Z"), clockOutAt: new Date("2024-01-01T14:30:00Z") }
      ]
    });
    prisma.shiftApproval.create.mockResolvedValue({ id: "approval-1" });
    prisma.staffShift.update.mockResolvedValue({});
    prisma.staffTimeEntry.updateMany.mockResolvedValue({});

    const result = await service.approveShift("shift-1", "manager-1", "looks good");
    expect(result.minutes).toBe(210); // 3.5 hours * 60
    expect(prisma.shiftApproval.create).toHaveBeenCalled();
    expect(prisma.staffTimeEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shiftId: "shift-1" } })
    );
  });
});

describe("payroll export formatting", () => {
  it("aggregates duplicate earnings codes", () => {
    const rows = aggregateExportRows([
      { userId: "u1", hours: 2, earningCode: "REG", roleCode: "front" },
      { userId: "u1", hours: 1.5, earningCode: "REG", roleCode: "front" },
      { userId: "u2", hours: 1, earningCode: "OT", roleCode: "kitchen" }
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === "u1")?.hours).toBe(3.5);
  });

  it("formats OnPay CSV rows", () => {
    const csv = formatOnPayCsv([
      { userId: "emp-123", hours: 8, earningCode: "REG", rate: 18.5, roleCode: "FRONT" }
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("EmployeeId");
    expect(lines[1]).toBe("emp-123,REG,8.00,18.50,FRONT");
  });
});
