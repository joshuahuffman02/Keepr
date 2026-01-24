import { Reservation } from "@keepr/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Caravan, Tent, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface StayDetailsProps {
  reservation: Reservation;
  site: NonNullable<Reservation["site"]>;
}

export function StayDetails({ reservation, site }: StayDetailsProps) {
  const nights = differenceInDays(
    new Date(reservation.departureDate),
    new Date(reservation.arrivalDate),
  );
  const siteLabel = site.siteNumber ?? site.name ?? "";
  const siteLabelText = siteLabel ? `Site ${siteLabel}` : "Site";
  const siteTypeLabel = site.siteType ? site.siteType.replace("_", " ") : "unknown";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tent className="w-5 h-5 text-muted-foreground" />
          Stay Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded-lg border border-border">
            <div className="text-xs text-muted-foreground uppercase font-medium mb-1">Check In</div>
            <div className="font-semibold text-foreground">
              {format(new Date(reservation.arrivalDate), "EEE, MMM d")}
            </div>
            <div className="text-sm text-muted-foreground">After 3:00 PM</div>
          </div>
          <div className="p-3 bg-muted rounded-lg border border-border">
            <div className="text-xs text-muted-foreground uppercase font-medium mb-1">
              Check Out
            </div>
            <div className="font-semibold text-foreground">
              {format(new Date(reservation.departureDate), "EEE, MMM d")}
            </div>
            <div className="text-sm text-muted-foreground">Before 11:00 AM</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Duration</span>
            </div>
            <span className="font-medium text-foreground">{nights} Nights</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Tent className="w-4 h-4" />
              <span>Site</span>
            </div>
            <div className="text-right">
              <div className="font-medium text-foreground">{siteLabelText}</div>
              <div className="text-xs text-muted-foreground capitalize">{siteTypeLabel}</div>
            </div>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Guests</span>
            </div>
            <span className="font-medium text-foreground">
              {reservation.adults} Adults, {reservation.children} Children
            </span>
          </div>

          {reservation.rigType && (
            <div className="flex justify-between items-start py-2 border-b border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Caravan className="w-4 h-4" />
                <span>Equipment</span>
              </div>
              <div className="text-right">
                <div className="font-medium text-foreground capitalize">
                  {reservation.rigType === "rv"
                    ? "RV / Motorhome"
                    : reservation.rigType === "trailer"
                      ? "Travel Trailer"
                      : reservation.rigType === "tent"
                        ? "Tent"
                        : reservation.rigType === "car"
                          ? "Car / Van"
                          : reservation.rigType}
                </div>
                {(reservation.rigLength || reservation.vehiclePlate) && (
                  <div className="text-xs text-muted-foreground">
                    {reservation.rigLength && `${reservation.rigLength}ft`}
                    {reservation.rigLength && reservation.vehiclePlate && " • "}
                    {reservation.vehiclePlate && (
                      <span className="font-mono">
                        {reservation.vehiclePlate}
                        {reservation.vehicleState && ` (${reservation.vehicleState})`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
