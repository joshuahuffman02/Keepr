import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface DataNotAvailableReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
  reportName: string;
  description: string;
  requiredData: string[];
}

export function DataNotAvailableReport({
  reportName,
  description,
  requiredData,
}: DataNotAvailableReportProps) {
  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="flex flex-row items-center gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600" />
          <div>
            <CardTitle className="text-amber-900">{reportName}</CardTitle>
            <p className="text-sm text-amber-700">{description}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-amber-800">
              This report requires additional data that hasn't been configured yet.
            </p>
            <div className="bg-card/50 rounded-lg p-4 border border-amber-200">
              <div className="text-xs font-medium text-amber-700 uppercase mb-2">Required Data</div>
              <ul className="text-sm text-amber-800 space-y-1">
                {requiredData.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-amber-600">
              Contact support to enable this feature for your campground.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrapper components for each missing report

export function GuestFeedbackReport({
  campgroundId,
  dateRange,
}: {
  campgroundId: string;
  dateRange: { start: string; end: string };
}) {
  return (
    <DataNotAvailableReport
      campgroundId={campgroundId}
      dateRange={dateRange}
      reportName="Guest Feedback & NPS"
      description="View satisfaction scores and guest reviews"
      requiredData={["Reviews table", "NPS survey integration", "Feedback collection enabled"]}
    />
  );
}

export function GuestPreferencesReport({
  campgroundId,
  dateRange,
}: {
  campgroundId: string;
  dateRange: { start: string; end: string };
}) {
  return (
    <DataNotAvailableReport
      campgroundId={campgroundId}
      dateRange={dateRange}
      reportName="Guest Preferences"
      description="Track common requests and site preferences"
      requiredData={["Preferences field on guest profile", "Special requests tracking"]}
    />
  );
}

export function BannedListReport({
  campgroundId,
  dateRange,
}: {
  campgroundId: string;
  dateRange: { start: string; end: string };
}) {
  return (
    <DataNotAvailableReport
      campgroundId={campgroundId}
      dateRange={dateRange}
      reportName="Do Not Rent List"
      description="View guests flagged as restricted"
      requiredData={["Banned/flagged field on guest profile", "DNR reason tracking"]}
    />
  );
}

export function SpecialDatesReport({
  campgroundId,
  dateRange,
}: {
  campgroundId: string;
  dateRange: { start: string; end: string };
}) {
  return (
    <DataNotAvailableReport
      campgroundId={campgroundId}
      dateRange={dateRange}
      reportName="Birthdays & Special Dates"
      description="Guests with celebrations this month"
      requiredData={["Birthday field on guest profile", "Anniversary dates"]}
    />
  );
}

export function LoyaltyMembershipReport({
  campgroundId,
  dateRange,
}: {
  campgroundId: string;
  dateRange: { start: string; end: string };
}) {
  return (
    <DataNotAvailableReport
      campgroundId={campgroundId}
      dateRange={dateRange}
      reportName="Loyalty & Memberships"
      description="Track loyalty program performance"
      requiredData={["Loyalty program configuration", "Membership tiers", "Points tracking"]}
    />
  );
}
