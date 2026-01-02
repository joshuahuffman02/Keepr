"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  Mail,
  MessageSquare,
  MapPin,
  Calendar,
  FileText,
  Cloud,
  Info,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: "connected" | "disconnected" | "error";
  category: string;
  configUrl?: string;
}

const integrations: Integration[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Process credit card payments securely",
    icon: CreditCard,
    status: "connected",
    category: "Payments",
    configUrl: "/dashboard/settings/payments",
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Send transactional emails",
    icon: Mail,
    status: "connected",
    category: "Communications",
    configUrl: "/dashboard/settings/email",
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS notifications and alerts",
    icon: MessageSquare,
    status: "disconnected",
    category: "Communications",
    configUrl: "/dashboard/settings/sms",
  },
  {
    id: "google-maps",
    name: "Google Maps",
    description: "Interactive maps and directions",
    icon: MapPin,
    status: "connected",
    category: "Maps",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync reservations to calendar",
    icon: Calendar,
    status: "disconnected",
    category: "Calendars",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Sync invoices and payments",
    icon: FileText,
    status: "error",
    category: "Accounting",
    configUrl: "/dashboard/settings/accounting",
  },
  {
    id: "campspot",
    name: "Campspot",
    description: "OTA channel management",
    icon: Cloud,
    status: "disconnected",
    category: "Channels",
  },
  {
    id: "hipcamp",
    name: "Hipcamp",
    description: "List on Hipcamp marketplace",
    icon: Cloud,
    status: "disconnected",
    category: "Channels",
  },
];

const statusConfig = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    className: "bg-status-success/15 text-status-success",
  },
  disconnected: {
    label: "Not Connected",
    icon: XCircle,
    className: "bg-muted text-muted-foreground",
  },
  error: {
    label: "Error",
    icon: XCircle,
    className: "bg-status-error/15 text-status-error",
  },
};

export default function IntegrationsPage() {
  const categories = [...new Set(integrations.map((i) => i.category))];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect third-party services to extend functionality
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Integrations extend Campreserv's capabilities by connecting to external
          services. Some integrations may require API keys or additional configuration.
        </AlertDescription>
      </Alert>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {integrations.filter((i) => i.status === "connected").length}
                </p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {integrations.filter((i) => i.status === "disconnected").length}
                </p>
                <p className="text-sm text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-error/15">
                <XCircle className="h-5 w-5 text-status-error" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {integrations.filter((i) => i.status === "error").length}
                </p>
                <p className="text-sm text-muted-foreground">Needs Attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integrations by Category */}
      {categories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">{category}</h3>
          <div className="grid gap-3">
            {integrations
              .filter((i) => i.category === category)
              .map((integration) => {
                const Icon = integration.icon;
                const status = statusConfig[integration.status];
                const StatusIcon = status.icon;

                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">
                                {integration.name}
                              </h4>
                              <Badge className={status.className}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {integration.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {integration.status === "connected" && integration.configUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={integration.configUrl}>
                                <Settings className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant={integration.status === "connected" ? "outline" : "default"}
                            size="sm"
                          >
                            {integration.status === "connected" ? "Disconnect" : "Connect"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
