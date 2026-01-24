import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Loader2 } from "lucide-react";

interface ZipCodeData {
  zipCode: string;
  city?: string;
  state?: string;
  count: number;
  revenue: number;
}

interface StateData {
  state: string;
  count: number;
  revenue: number;
}

interface GuestOriginsData {
  byZipCode: ZipCodeData[];
  byState: StateData[];
}

interface GuestOriginsTabProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseZipCode = (value: unknown): ZipCodeData | null => {
  if (!isRecord(value)) return null;
  if (!isString(value.zipCode) || !isNumber(value.count) || !isNumber(value.revenue)) return null;
  return {
    zipCode: value.zipCode,
    city: isString(value.city) ? value.city : undefined,
    state: isString(value.state) ? value.state : undefined,
    count: value.count,
    revenue: value.revenue,
  };
};

const parseState = (value: unknown): StateData | null => {
  if (!isRecord(value)) return null;
  if (!isString(value.state) || !isNumber(value.count) || !isNumber(value.revenue)) return null;
  return { state: value.state, count: value.count, revenue: value.revenue };
};

const isZipCodeData = (value: ZipCodeData | null): value is ZipCodeData => value !== null;

const isStateData = (value: StateData | null): value is StateData => value !== null;

const parseGuestOrigins = (value: unknown): GuestOriginsData => {
  if (!isRecord(value)) {
    return { byZipCode: [], byState: [] };
  }
  const byZipCode = Array.isArray(value.byZipCode)
    ? value.byZipCode.map(parseZipCode).filter(isZipCodeData)
    : [];
  const byState = Array.isArray(value.byState)
    ? value.byState.map(parseState).filter(isStateData)
    : [];
  return { byZipCode, byState };
};

export function GuestOriginsTab({ campgroundId, dateRange }: GuestOriginsTabProps) {
  const { data, isLoading } = useQuery<GuestOriginsData>({
    queryKey: ["reports-guest-origins", campgroundId, dateRange],
    queryFn: async () => {
      const result = await apiClient.getGuestOrigins(campgroundId, {
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      return parseGuestOrigins(result);
    },
    enabled: !!campgroundId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!data) return <div>No data available</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Top Zip Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zip Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byZipCode.slice(0, 10).map((item) => (
                <TableRow key={item.zipCode}>
                  <TableCell className="font-medium">{item.zipCode}</TableCell>
                  <TableCell>
                    {item.city}
                    {item.city && item.state ? ", " : ""}
                    {item.state}
                  </TableCell>
                  <TableCell className="text-right">{item.count}</TableCell>
                  <TableCell className="text-right">
                    $
                    {item.revenue.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {data.byZipCode.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    No location data found matching these dates.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top States</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byState.slice(0, 10).map((item) => (
                <TableRow key={item.state}>
                  <TableCell className="font-medium">{item.state}</TableCell>
                  <TableCell className="text-right">{item.count}</TableCell>
                  <TableCell className="text-right">
                    $
                    {item.revenue.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {data.byState.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    No state data found matching these dates.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
