import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(campgroundId: string, orgId?: string) {
    const campground = await this.prisma.campground.findFirst({
      where: { id: campgroundId, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, organizationId: true, name: true },
    });
    if (!campground) throw new NotFoundException("Campground not found");

    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 30);

    // Run all queries in parallel - use SQL aggregation instead of fetching all rows
    const [sites, reservationStats, maintenanceOpen, maintenanceOverdue] = await Promise.all([
      this.prisma.site.count({ where: { campgroundId } }),
      this.prisma.$queryRaw<
        [
          {
            future_reservations: bigint;
            booked_nights: bigint;
            total_nights: bigint;
            revenue_cents: bigint;
            overdue_cents: bigint;
          },
        ]
      >`
        SELECT
          COUNT(*) FILTER (WHERE "arrivalDate" >= ${now}) as future_reservations,
          COALESCE(SUM(
            GREATEST(0,
              EXTRACT(EPOCH FROM (
                LEAST("departureDate", ${windowEnd}::timestamp) -
                GREATEST("arrivalDate", ${now}::timestamp)
              )) / 86400
            )::int
          ) FILTER (WHERE "departureDate" > ${now} AND "arrivalDate" < ${windowEnd}), 0) as booked_nights,
          COALESCE(SUM(
            GREATEST(0, EXTRACT(EPOCH FROM ("departureDate" - "arrivalDate")) / 86400)::int
          ), 0) as total_nights,
          COALESCE(SUM("totalAmount"), 0) as revenue_cents,
          COALESCE(SUM(
            GREATEST(0, "totalAmount" - COALESCE("paidAmount", 0))
          ) FILTER (WHERE "arrivalDate" < ${now} AND "totalAmount" > COALESCE("paidAmount", 0)), 0) as overdue_cents
        FROM "Reservation"
        WHERE "campgroundId" = ${campgroundId}
          AND "status" != 'cancelled'
      `,
      this.prisma.maintenanceTicket.count({
        where: { campgroundId, status: { not: "closed" } },
      }),
      this.prisma.maintenanceTicket.count({
        where: {
          campgroundId,
          status: { not: "closed" },
          dueDate: { lt: now },
        },
      }),
    ]);

    const stats = reservationStats[0];
    const futureReservations = Number(stats?.future_reservations ?? 0);
    const bookedNights = Number(stats?.booked_nights ?? 0);
    const totalNights = Number(stats?.total_nights ?? 0);
    const revenueCents = Number(stats?.revenue_cents ?? 0);
    const overdueBalancesCents = Number(stats?.overdue_cents ?? 0);

    const occupancy =
      sites > 0 ? Math.min(100, Math.round((bookedNights / (sites * 30)) * 100)) : 0;
    const adr = totalNights > 0 ? revenueCents / 100 / totalNights : 0;
    const revpar = sites > 0 ? revenueCents / 100 / (sites * 30) : 0;

    return {
      campground: { id: campground.id, name: campground.name },
      sites,
      futureReservations,
      occupancy,
      adr,
      revpar,
      revenue: revenueCents / 100,
      overdueBalance: overdueBalancesCents / 100,
      maintenanceOpen,
      maintenanceOverdue,
    };
  }
}
