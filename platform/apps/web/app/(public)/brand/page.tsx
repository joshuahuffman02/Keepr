import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";

export const metadata: Metadata = {
  title: "Brand Guidelines",
  description: "Keepr brand system - colors, typography, and components",
};

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12 space-y-16">
        {/* Header */}
        <header className="space-y-4">
          <Logo size="xl" />
          <h1 className="font-display text-5xl font-bold tracking-tighter text-foreground">
            Brand System
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Reservation software for places worth returning to. Calm, trustworthy, human, premium.
          </p>
        </header>

        {/* Logo */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Logo</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Light background */}
            <Card>
              <CardHeader>
                <CardTitle>On light backgrounds</CardTitle>
                <CardDescription>Evergreen variant (default)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Logo size="sm" />
                  <Logo size="md" />
                  <Logo size="lg" />
                  <Logo size="xl" />
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {`<Logo size="sm|md|lg|xl" />`}
                </p>
              </CardContent>
            </Card>

            {/* Dark background */}
            <Card className="bg-keepr-evergreen text-white border-keepr-evergreen">
              <CardHeader>
                <CardTitle className="text-white">On dark backgrounds</CardTitle>
                <CardDescription className="text-white/70">White variant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Logo size="sm" variant="white" />
                  <Logo size="md" variant="white" />
                  <Logo size="lg" variant="white" />
                  <Logo size="xl" variant="white" />
                </div>
                <p className="text-xs text-white/70 font-mono">
                  {`<Logo variant="white" />`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Usage</p>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`import { Logo } from "@/components/brand";

// Default - Evergreen on light backgrounds
<Logo />

// Size variants
<Logo size="sm" />  // 24px height
<Logo size="md" />  // 32px height (default)
<Logo size="lg" />  // 40px height
<Logo size="xl" />  // 48px height

// Color variants
<Logo variant="evergreen" />  // Default
<Logo variant="white" />      // For dark backgrounds
<Logo variant="charcoal" />   // Alternative dark`}
            </pre>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Color Palette</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Evergreen */}
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-keepr-evergreen flex items-end p-3">
                <span className="text-white text-sm font-medium">Evergreen</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-mono">#1F3D34</p>
                <p>Primary actions, brand emphasis</p>
              </div>
            </div>

            {/* Charcoal */}
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-keepr-charcoal flex items-end p-3">
                <span className="text-white text-sm font-medium">Charcoal</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-mono">#2F2F2C</p>
                <p>Text, UI elements</p>
              </div>
            </div>

            {/* Clay */}
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-keepr-clay flex items-end p-3">
                <span className="text-white text-sm font-medium">Soft Clay</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-mono">#C47A63</p>
                <p>Focus rings, accents (5%)</p>
              </div>
            </div>

            {/* Off-White */}
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-keepr-off-white border border-border flex items-end p-3">
                <span className="text-foreground text-sm font-medium">Off-White</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-mono">#FAF7F2</p>
                <p>Background</p>
              </div>
            </div>
          </div>

          {/* Color Ratios */}
          <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
            <div className="bg-keepr-off-white flex-[70] flex items-center justify-center text-xs font-medium">
              65-70%
            </div>
            <div className="bg-keepr-evergreen flex-[25] flex items-center justify-center text-xs font-medium text-white">
              20-25%
            </div>
            <div className="bg-keepr-clay flex-[5] flex items-center justify-center text-xs font-medium text-white">
              5%
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Typography</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Headlines */}
            <Card>
              <CardHeader>
                <CardTitle>DM Sans - Headlines</CardTitle>
                <CardDescription>Weights 500, 700 | tracking-tighter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">H1 - 48-56px, Bold</p>
                  <h1 className="font-display text-5xl font-bold tracking-tighter">Welcome to Keepr</h1>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">H2 - 32-40px, Medium</p>
                  <h2 className="font-display text-4xl font-medium tracking-tighter">Section heading</h2>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">H3 - 24-28px, Medium</p>
                  <h3 className="font-display text-2xl font-medium tracking-tighter">Card title style</h3>
                </div>
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader>
                <CardTitle>Inter - Body & UI</CardTitle>
                <CardDescription>Weights 400, 500 | normal tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Body - 16-18px, Regular</p>
                  <p className="text-base leading-relaxed">
                    Modern campground management software. Streamline reservations,
                    payments, and guest experiences with Keepr.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">UI Label - 14-15px, Medium</p>
                  <p className="text-sm font-medium">Email address</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Caption - 12-14px, Regular</p>
                  <p className="text-sm text-muted-foreground">
                    Last updated 2 hours ago
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Buttons</h2>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="space-y-2 text-center">
                  <Button>Primary</Button>
                  <p className="text-xs text-muted-foreground">Default</p>
                </div>
                <div className="space-y-2 text-center">
                  <Button variant="secondary">Secondary</Button>
                  <p className="text-xs text-muted-foreground">Secondary</p>
                </div>
                <div className="space-y-2 text-center">
                  <Button variant="outline">Outline</Button>
                  <p className="text-xs text-muted-foreground">Outline</p>
                </div>
                <div className="space-y-2 text-center">
                  <Button variant="ghost">Ghost</Button>
                  <p className="text-xs text-muted-foreground">Ghost</p>
                </div>
                <div className="space-y-2 text-center">
                  <Button variant="destructive">Destructive</Button>
                  <p className="text-xs text-muted-foreground">Destructive</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Focus ring demo</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Tab through the buttons to see the Clay focus ring
                </p>
                <div className="flex gap-4">
                  <Button>Tab to me</Button>
                  <Button variant="secondary">Then me</Button>
                  <Button variant="outline">And me</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Inputs */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Inputs</h2>

          <Card>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="default">Default input</Label>
                  <Input id="default" placeholder="Enter your email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focused">Focus state</Label>
                  <Input id="focused" placeholder="Click to see focus ring" />
                  <p className="text-xs text-muted-foreground">
                    Focus ring uses Soft Clay
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disabled">Disabled</Label>
                  <Input id="disabled" placeholder="Cannot edit" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="with-value">With value</Label>
                  <Input id="with-value" defaultValue="hello@keeprstay.com" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badges */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Badges</h2>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="error">Error</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Cards</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Simple card</CardTitle>
                <CardDescription>With description text</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card content goes here. Notice the display font on the title.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-glow cursor-pointer">
              <CardHeader>
                <CardTitle>Interactive card</CardTitle>
                <CardDescription>With hover glow effect</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Hover over this card to see the subtle glow effect.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Card with action</CardTitle>
                <CardDescription>Includes a button</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cards can contain any content including buttons.
                </p>
                <Button size="sm">Learn more</Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Status Colors */}
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-medium tracking-tighter">Status Colors</h2>

          <div className="grid md:grid-cols-4 gap-4">
            <Card className="border-status-success-border bg-status-success-bg">
              <CardHeader>
                <CardTitle className="text-status-success-text">Success</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-status-success-text">Confirmed, completed</p>
              </CardContent>
            </Card>

            <Card className="border-status-warning-border bg-status-warning-bg">
              <CardHeader>
                <CardTitle className="text-status-warning-text">Warning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-status-warning-text">Attention needed</p>
              </CardContent>
            </Card>

            <Card className="border-status-error-border bg-status-error-bg">
              <CardHeader>
                <CardTitle className="text-status-error-text">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-status-error-text">Critical, failed</p>
              </CardContent>
            </Card>

            <Card className="border-status-info-border bg-status-info-bg">
              <CardHeader>
                <CardTitle className="text-status-info-text">Info</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-status-info-text">Informational</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            See <code className="bg-muted px-1 py-0.5 rounded">docs/BRAND.md</code> for full documentation.
          </p>
        </footer>
      </div>
    </div>
  );
}
