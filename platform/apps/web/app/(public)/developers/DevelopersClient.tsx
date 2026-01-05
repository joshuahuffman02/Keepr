"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Code2,
  BookOpen,
  PlugZap,
  ShieldCheck,
  Zap,
  Globe,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react";

const codeExamples = {
  auth: `// Get an access token using client credentials
const response = await fetch('https://api.keeprstay.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    scope: 'reservations:read availability:read'
  })
});

const { access_token, expires_in } = await response.json();`,

  availability: `// Check site availability
const response = await fetch(
  'https://api.keeprstay.com/v1/campgrounds/{id}/availability?' +
  new URLSearchParams({
    startDate: '2024-06-01',
    endDate: '2024-06-07'
  }),
  {
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'Content-Type': 'application/json'
    }
  }
);

const availability = await response.json();`,

  webhook: `// Webhook payload example
{
  "event": "reservation.confirmed",
  "timestamp": "2024-06-01T12:00:00Z",
  "data": {
    "reservationId": "res_abc123",
    "guestName": "John Doe",
    "siteId": "site_xyz",
    "arrivalDate": "2024-06-15",
    "departureDate": "2024-06-18",
    "totalAmount": 29997
  },
  "signature": "sha256=abc123..."
}`,

  sdk: `import { CampreservClient } from '@keepr/sdk';

const client = new CampreservClient({
  clientId: process.env.CAMPRESERV_CLIENT_ID,
  clientSecret: process.env.CAMPRESERV_CLIENT_SECRET,
});

// Get availability
const availability = await client.availability.check({
  campgroundId: 'camp_123',
  startDate: '2024-06-01',
  endDate: '2024-06-07',
});

// Create a reservation
const reservation = await client.reservations.create({
  campgroundId: 'camp_123',
  siteId: 'site_456',
  guestEmail: 'hello@keeprstay.com',
  arrivalDate: '2024-06-15',
  departureDate: '2024-06-18',
});`,
};

function CodeBlock({ code, language = "typescript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-keepr-charcoal text-white/90 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-md bg-keepr-charcoal/80 text-white/60 hover:text-white hover:bg-keepr-charcoal opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "auth", label: "Authentication" },
  { id: "webhooks", label: "Webhooks" },
  { id: "sdks", label: "SDKs" },
];

const featureStyles = {
  evergreen: {
    iconBg: "bg-keepr-evergreen/10",
    iconText: "text-keepr-evergreen",
  },
  clay: {
    iconBg: "bg-keepr-clay/10",
    iconText: "text-keepr-clay",
  },
  charcoal: {
    iconBg: "bg-keepr-charcoal/10",
    iconText: "text-keepr-charcoal",
  },
};

export default function DevelopersClient() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-b from-keepr-off-white to-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-keepr-charcoal via-keepr-charcoal to-keepr-evergreen-dark text-white">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-keepr-clay/15 text-keepr-clay-light text-xs font-semibold border border-keepr-clay/30 mb-6">
            <Zap className="h-3 w-3" />
            Developer Preview
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Build with Keepr API
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mb-8">
            Integrate campground availability, reservations, and payments into your applications with our RESTful API.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard/settings/developers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white font-semibold rounded-lg transition-colors"
            >
              Get API Keys
              <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_API_BASE || "https://api.keeprstay.com"}/api-docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              View API Docs
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 -mt-10">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Code2,
              title: "REST API",
              desc: "Simple, predictable REST endpoints with JSON responses. Versioned and documented.",
              tone: "evergreen",
            },
            {
              icon: ShieldCheck,
              title: "OAuth 2.0",
              desc: "Industry-standard OAuth 2.0 authentication with granular scopes and token refresh.",
              tone: "charcoal",
            },
            {
              icon: PlugZap,
              title: "Webhooks",
              desc: "Real-time event notifications for reservations, payments, and availability changes.",
              tone: "clay",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-xl border border-border p-6 shadow-lg shadow-keepr-charcoal/10"
            >
              <div
                className={`h-12 w-12 rounded-lg ${featureStyles[feature.tone as keyof typeof featureStyles].iconBg} ${featureStyles[feature.tone as keyof typeof featureStyles].iconText} flex items-center justify-center mb-4`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="border-b border-border mb-8">
          <nav className="flex gap-8 -mb-px" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-keepr-evergreen text-keepr-evergreen"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              <div className="prose prose-slate max-w-none">
                <h2 className="text-2xl font-bold text-foreground">API Overview</h2>
                <p className="text-muted-foreground">
                  The Keepr API provides programmatic access to campground management
                  functionality. Use it to build integrations, sync data with external systems,
                  or create custom booking experiences.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: "Campgrounds", desc: "Get campground details, sites, and amenities" },
                  { title: "Availability", desc: "Check real-time site availability" },
                  { title: "Reservations", desc: "Create, update, and manage bookings" },
                  { title: "Guests", desc: "Access guest profiles and history" },
                  { title: "Payments", desc: "Process payments and refunds" },
                  { title: "Reports", desc: "Generate occupancy and revenue reports" },
                ].map((endpoint) => (
                  <div
                    key={endpoint.title}
                    className="flex items-start gap-4 p-4 bg-muted rounded-lg"
                  >
                    <div className="h-8 w-8 rounded bg-keepr-evergreen/10 text-keepr-evergreen flex items-center justify-center flex-shrink-0">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{endpoint.title}</h4>
                      <p className="text-sm text-muted-foreground">{endpoint.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-keepr-clay/10 border border-keepr-clay/20 rounded-lg p-4">
                <p className="text-sm text-keepr-clay">
                  <strong>Preview Status:</strong> The API is in developer preview. Endpoints and
                  authentication scopes may change before general availability.
                </p>
              </div>
            </div>
          )}

          {activeTab === "quickstart" && (
            <div className="space-y-8">
              <div className="prose prose-slate max-w-none">
                <h2 className="text-2xl font-bold text-foreground">Quickstart</h2>
                <p className="text-muted-foreground">
                  Get up and running with the Keepr API in minutes.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-keepr-evergreen/10 text-keepr-evergreen flex items-center justify-center font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Get your API credentials</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate a client ID and secret in your dashboard settings.
                    </p>
                    <Link
                      href="/dashboard/settings/developers"
                      className="text-sm font-medium text-keepr-evergreen hover:text-keepr-evergreen-light"
                    >
                      Go to Developer Settings
                    </Link>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-keepr-evergreen/10 text-keepr-evergreen flex items-center justify-center font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Get an access token</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Exchange your credentials for an access token.
                    </p>
                    <CodeBlock code={codeExamples.auth} />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-keepr-evergreen/10 text-keepr-evergreen flex items-center justify-center font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">Make your first request</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use the access token to call API endpoints.
                    </p>
                    <CodeBlock code={codeExamples.availability} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "auth" && (
            <div className="space-y-8">
              <div className="prose prose-slate max-w-none">
                <h2 className="text-2xl font-bold text-foreground">Authentication</h2>
                <p className="text-muted-foreground">
                  The API uses OAuth 2.0 for authentication. We support the client credentials
                  flow for server-to-server integrations.
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">Available Scopes</h3>
                  <div className="space-y-3">
                    {[
                      { scope: "campgrounds:read", desc: "Read campground information" },
                      { scope: "availability:read", desc: "Check site availability" },
                      { scope: "reservations:read", desc: "View reservations" },
                      { scope: "reservations:write", desc: "Create and modify reservations" },
                      { scope: "guests:read", desc: "Access guest profiles" },
                      { scope: "payments:read", desc: "View payment history" },
                      { scope: "payments:write", desc: "Process payments" },
                    ].map((item) => (
                      <div key={item.scope} className="flex items-center gap-4">
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {item.scope}
                        </code>
                        <span className="text-sm text-muted-foreground">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">Token Endpoint</h3>
                  <CodeBlock code={codeExamples.auth} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="space-y-8">
              <div className="prose prose-slate max-w-none">
                <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
                <p className="text-muted-foreground">
                  Receive real-time notifications when events occur in your campground.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4">Available Events</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    "reservation.created",
                    "reservation.confirmed",
                    "reservation.cancelled",
                    "reservation.checked_in",
                    "reservation.checked_out",
                    "payment.succeeded",
                    "payment.failed",
                    "payment.refunded",
                    "availability.updated",
                    "guest.created",
                  ].map((event) => (
                    <div key={event} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-keepr-evergreen" />
                      <code className="text-sm font-mono text-foreground">{event}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4">Payload Example</h3>
                <CodeBlock code={codeExamples.webhook} language="json" />
              </div>

              <div className="bg-keepr-charcoal/5 border border-keepr-charcoal/10 rounded-lg p-4">
                <p className="text-sm text-keepr-charcoal">
                  <strong>Security:</strong> All webhook payloads include a signature header.
                  Verify the signature using your webhook secret to ensure authenticity.
                </p>
              </div>
            </div>
          )}

          {activeTab === "sdks" && (
            <div className="space-y-8">
              <div className="prose prose-slate max-w-none">
                <h2 className="text-2xl font-bold text-foreground">SDKs & Libraries</h2>
                <p className="text-muted-foreground">
                  Official client libraries to simplify API integration.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded bg-keepr-charcoal/10 flex items-center justify-center">
                      <span className="text-keepr-charcoal font-bold text-sm">TS</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">TypeScript SDK</h3>
                      <p className="text-xs text-muted-foreground">@keepr/sdk</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Full TypeScript support with type-safe requests and responses.
                  </p>
                  <code className="block px-3 py-2 bg-muted rounded text-sm font-mono">
                    npm install @keepr/sdk
                  </code>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded bg-keepr-clay/15 flex items-center justify-center">
                      <span className="text-keepr-clay font-bold text-sm">Py</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Python SDK</h3>
                      <p className="text-xs text-muted-foreground">campreserv</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Async-ready Python client with full type hints.
                  </p>
                  <code className="block px-3 py-2 bg-muted rounded text-sm font-mono text-muted-foreground">
                    pip install campreserv (coming soon)
                  </code>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4">TypeScript Example</h3>
                <CodeBlock code={codeExamples.sdk} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-keepr-charcoal text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to build?</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            Get your API keys and start integrating with Keepr today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard/settings/developers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white font-semibold rounded-lg transition-colors"
            >
              Get API Keys
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
