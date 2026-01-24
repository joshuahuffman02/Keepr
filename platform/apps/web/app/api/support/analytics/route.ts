export const dynamic = "force-dynamic";

type SlaSet = {
  region: string;
  campgroundId: string;
  campgroundName: string;
  onTime: number;
  overdue: number;
  slaTargetHours: number;
};

type CategoryCount = {
  region: string;
  category: string;
  count: number;
};

type NeedsAttentionItem = {
  id: string;
  title: string;
  region: string;
  campgroundId: string;
  campgroundName: string;
  status: string;
  category: string;
  reportedAt: string;
  slaBreachedMinutes: number;
  assignee: string | null;
};

const SLA_SETS: SlaSet[] = [
  {
    region: "north",
    campgroundId: "cg-north",
    campgroundName: "North Pines",
    onTime: 42,
    overdue: 3,
    slaTargetHours: 24,
  },
  {
    region: "south",
    campgroundId: "cg-south",
    campgroundName: "Sunset Dunes",
    onTime: 35,
    overdue: 6,
    slaTargetHours: 24,
  },
  {
    region: "east",
    campgroundId: "cg-east",
    campgroundName: "River Bend",
    onTime: 28,
    overdue: 2,
    slaTargetHours: 24,
  },
  {
    region: "west",
    campgroundId: "cg-west",
    campgroundName: "Canyon Base",
    onTime: 22,
    overdue: 4,
    slaTargetHours: 24,
  },
];

const CATEGORY_COUNTS: CategoryCount[] = [
  { region: "north", category: "Bugs / Errors", count: 12 },
  { region: "north", category: "Billing / Refunds", count: 8 },
  { region: "north", category: "Access / Login", count: 6 },
  { region: "south", category: "Bugs / Errors", count: 9 },
  { region: "south", category: "Integrations", count: 5 },
  { region: "south", category: "Feature Requests", count: 4 },
  { region: "east", category: "Billing / Refunds", count: 7 },
  { region: "east", category: "Data Corrections", count: 5 },
  { region: "west", category: "Access / Login", count: 6 },
  { region: "west", category: "Bugs / Errors", count: 5 },
  { region: "west", category: "Feature Requests", count: 4 },
];

const NEEDS_ATTENTION: NeedsAttentionItem[] = [
  {
    id: "sup-201",
    title: "Check-in kiosk throws 500 during card swipe",
    region: "north",
    campgroundId: "cg-north",
    campgroundName: "North Pines",
    status: "overdue",
    category: "Bugs / Errors",
    reportedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    slaBreachedMinutes: 95,
    assignee: "ops-north-1",
  },
  {
    id: "sup-202",
    title: "Refund export failed for last payout batch",
    region: "south",
    campgroundId: "cg-south",
    campgroundName: "Sunset Dunes",
    status: "overdue",
    category: "Billing / Refunds",
    reportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    slaBreachedMinutes: 130,
    assignee: null,
  },
  {
    id: "sup-203",
    title: "Integrations: PMS webhook retries spiking",
    region: "south",
    campgroundId: "cg-south",
    campgroundName: "Sunset Dunes",
    status: "at-risk",
    category: "Integrations",
    reportedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    slaBreachedMinutes: 0,
    assignee: "ops-south-2",
  },
  {
    id: "sup-204",
    title: "Guests see stale rates on River Bend landing page",
    region: "east",
    campgroundId: "cg-east",
    campgroundName: "River Bend",
    status: "at-risk",
    category: "Feature Requests",
    reportedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    slaBreachedMinutes: 0,
    assignee: null,
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const campgroundId = searchParams.get("campgroundId");

  const matchesScope = (row: { region: string; campgroundId?: string }) => {
    const regionOk = !region || region === "all" || row.region === region;
    const campOk = !campgroundId || row.campgroundId === campgroundId;
    return regionOk && campOk;
  };

  const slaSummary = SLA_SETS.filter(matchesScope);
  const needsAttention = NEEDS_ATTENTION.filter(matchesScope);

  const volumesByCategory = CATEGORY_COUNTS.filter(matchesScope).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.category] = (acc[row.category] ?? 0) + row.count;
      return acc;
    },
    {},
  );

  const volumeRows = Object.entries(volumesByCategory).map(([category, count]) => ({
    category,
    count,
  }));

  return Response.json({
    generatedAt: new Date().toISOString(),
    source: "stub",
    region: region ?? "all",
    campgroundId: campgroundId ?? null,
    slaSummary,
    volumesByCategory: volumeRows,
    needsAttention,
  });
}
