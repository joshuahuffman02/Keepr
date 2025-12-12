import { z } from "zod";

export const reservationImportRecordSchema = z.object({
  externalId: z.string().min(1).optional(),
  campgroundId: z.string().min(1),
  siteId: z.string().min(1),
  guestId: z.string().min(1),
  arrivalDate: z.string().min(1),
  departureDate: z.string().min(1),
  adults: z.coerce.number().int().nonnegative(),
  children: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]).default("confirmed"),
  totalAmount: z.coerce.number().int().nonnegative(),
  paidAmount: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  promoCode: z.string().optional(),
  rigType: z.string().optional(),
  rigLength: z.coerce.number().int().nonnegative().optional(),
  holdId: z.string().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
}).superRefine((value, ctx) => {
  const arrival = new Date(value.arrivalDate);
  const departure = new Date(value.departureDate);
  if (!(arrival instanceof Date) || isNaN(arrival.valueOf())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arrivalDate"], message: "Invalid arrivalDate" });
  }
  if (!(departure instanceof Date) || isNaN(departure.valueOf())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departureDate"], message: "Invalid departureDate" });
  }
  if (arrival instanceof Date && departure instanceof Date && !isNaN(arrival.valueOf()) && !isNaN(departure.valueOf()) && departure <= arrival) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["departureDate"], message: "departureDate must be after arrivalDate" });
  }
});

export type ReservationImportRecord = z.infer<typeof reservationImportRecordSchema>;

export type ReservationImportValidationError = {
  row: number;
  field?: string;
  message: string;
  value?: any;
};

export const reservationImportCsvColumns = [
  "campgroundId",
  "siteId",
  "guestId",
  "arrivalDate",
  "departureDate",
  "adults",
  "children",
  "status",
  "totalAmount",
  "paidAmount",
  "notes",
  "source",
  "promoCode",
  "externalId",
  "rigType",
  "rigLength",
  "holdId"
];

export const reservationImportSchemaSummary = {
  requiredFields: ["campgroundId", "siteId", "guestId", "arrivalDate", "departureDate", "adults", "totalAmount"],
  optionalFields: ["children", "status", "paidAmount", "notes", "source", "promoCode", "externalId", "rigType", "rigLength", "holdId"],
  rules: [
    "departureDate must be after arrivalDate",
    "totals and paid amounts must be non-negative integers (cents)",
    "status must be one of pending|confirmed|checked_in|checked_out|cancelled",
    "campgroundId in file must match request path",
    "adults/children parsed as integers; defaults children to 0",
  ],
};
