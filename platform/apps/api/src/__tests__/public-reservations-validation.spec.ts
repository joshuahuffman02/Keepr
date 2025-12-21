import { PublicReservationsService } from "../public-reservations/public-reservations.service";

// Lightweight unit tests to guard rig-fit logic used by availability + reservation creation
describe("PublicReservationsService rig validation", () => {
    // We only need the private helper, so stub dependencies with empty objects
    const service = new PublicReservationsService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
    );
    const isRigCompatible: (site: any, rigType?: string | null, rigLength?: number | null) => boolean =
        (service as any).isRigCompatible.bind(service);

    it("allows tents and cars on non-RV sites", () => {
        expect(isRigCompatible({ siteType: "tent" }, "tent", null)).toBe(true);
        expect(isRigCompatible({ siteType: "cabin" }, "car", null)).toBe(true);
    });

    it("rejects RVs on non-RV sites", () => {
        expect(isRigCompatible({ siteType: "tent" }, "rv", 20)).toBe(false);
    });

    it("rejects rigs that exceed maximum length", () => {
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 30 }, "rv", 35)).toBe(false);
    });

    it("allows rigs within maximum length", () => {
        expect(isRigCompatible({ siteType: "rv", rigMaxLength: 35 }, "rv", 32)).toBe(true);
    });
});
