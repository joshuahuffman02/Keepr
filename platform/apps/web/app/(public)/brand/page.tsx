import { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";

export const metadata: Metadata = {
  title: "Brand System",
  description: "Keepr brand system - modern palette, typography, and UI guidance.",
};

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-keepr-evergreen/15 blur-3xl animate-float-slow"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-16 right-[-4rem] h-64 w-64 rounded-full bg-keepr-clay/20 blur-3xl animate-float-medium"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-keepr-evergreen/10 blur-[120px] animate-float-fast"
        />

        <div className="container relative py-12 lg:py-20 space-y-16">
          <header className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-end">
            <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
              <div className="flex flex-wrap items-center gap-4">
                <Logo size="xl" />
                <Badge variant="secondary" className="uppercase tracking-[0.3em] text-[10px]">
                  Brand Guide
                </Badge>
              </div>
              <h1 className="font-display text-5xl lg:text-6xl font-semibold tracking-tight">
                Modern outdoor hospitality, kept simple.
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Keepr is the reservation and guest experience platform for campgrounds and outdoor
                stays. Clear, refreshing, and quietly bold.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-keepr-evergreen/30 text-keepr-evergreen">
                  Grounded
                </Badge>
                <Badge variant="outline" className="border-keepr-evergreen/30 text-keepr-evergreen">
                  Optimistic
                </Badge>
                <Badge variant="outline" className="border-keepr-evergreen/30 text-keepr-evergreen">
                  Precise
                </Badge>
                <Badge variant="outline" className="border-keepr-evergreen/30 text-keepr-evergreen">
                  Adventurous
                </Badge>
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                keeprstay.com
              </p>
            </div>

            <Card
              className="bg-white/80 border-white/60 shadow-xl backdrop-blur animate-fade-in-up"
              style={{ animationDelay: "0.15s" }}
            >
              <CardHeader>
                <CardTitle>Brand essence</CardTitle>
                <CardDescription>Decision filters for every touchpoint.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-2.5 w-2.5 rounded-full bg-keepr-evergreen" />
                  <p>
                    <span className="text-foreground font-medium">Clarity over clutter.</span> Keep
                    hierarchy simple and confident.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-2.5 w-2.5 rounded-full bg-keepr-clay" />
                  <p>
                    <span className="text-foreground font-medium">Warm precision.</span> Human copy,
                    fast flows, no noise.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 h-2.5 w-2.5 rounded-full bg-keepr-evergreen" />
                  <p>
                    <span className="text-foreground font-medium">Momentum.</span> The next step is
                    always obvious.
                  </p>
                </div>
              </CardContent>
            </Card>
          </header>

          <section className="space-y-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Logo</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>On light backgrounds</CardTitle>
                  <CardDescription>Evergreen wordmark</CardDescription>
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
                  <p className="text-xs text-white/70 font-mono">{`<Logo variant="white" />`}</p>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-xl border border-border bg-card/70 p-4">
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

          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">Color system</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Cool, high-contrast tones with a crisp accent. Keep the palette restrained and let
                  whitespace do the work.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Contrast first</Badge>
                <Badge variant="secondary">Focus ring uses Trail Clay</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-2xl bg-keepr-evergreen flex items-end p-3">
                  <span className="text-white text-sm font-medium">Evergreen</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-mono">#0E4A52</p>
                  <p>Primary actions, nav, highlights</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-24 rounded-2xl bg-keepr-charcoal flex items-end p-3">
                  <span className="text-white text-sm font-medium">Charcoal</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-mono">#0F172A</p>
                  <p>Body text and UI labels</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-24 rounded-2xl bg-keepr-clay flex items-end p-3">
                  <span className="text-white text-sm font-medium">Trail Clay</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-mono">#CC4A34</p>
                  <p>Accents, focus rings, emphasis</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-24 rounded-2xl bg-keepr-off-white border border-border flex items-end p-3">
                  <span className="text-foreground text-sm font-medium">Glacier</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-mono">#F5FAFC</p>
                  <p>Primary background</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="h-20 rounded-2xl bg-secondary border border-border flex items-end p-3">
                  <span className="text-foreground text-xs font-medium">Mist</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">#E9F0F4</div>
              </div>
              <div className="space-y-2">
                <div className="h-20 rounded-2xl bg-border flex items-end p-3">
                  <span className="text-foreground text-xs font-medium">Fog</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">#D7E2E8</div>
              </div>
              <div className="space-y-2">
                <div className="h-20 rounded-2xl bg-white border border-border flex items-end p-3">
                  <span className="text-foreground text-xs font-medium">White</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">#FFFFFF</div>
              </div>
            </div>

            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
              <div className="bg-keepr-off-white flex-[70] flex items-center justify-center text-xs font-medium">
                70%
              </div>
              <div className="bg-keepr-evergreen flex-[20] flex items-center justify-center text-xs font-medium text-white">
                20%
              </div>
              <div className="bg-keepr-clay flex-[10] flex items-center justify-center text-xs font-medium text-white">
                10%
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Typography</h2>

            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Sora - Display</CardTitle>
                  <CardDescription>Weights 500, 600, 700 | tight tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">H1 - 48-56px, Semibold</p>
                    <h1 className="font-display text-5xl font-semibold tracking-tight">
                      Welcome to Keepr
                    </h1>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">H2 - 32-40px, Semibold</p>
                    <h2 className="font-display text-4xl font-semibold tracking-tight">
                      Section heading
                    </h2>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">H3 - 24-28px, Medium</p>
                    <h3 className="font-display text-2xl font-medium tracking-tight">
                      Card title style
                    </h3>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manrope - Body & UI</CardTitle>
                  <CardDescription>Weights 400, 500, 600 | normal tracking</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Body - 16-18px, Regular</p>
                    <p className="text-base leading-relaxed">
                      Modern campground management software. Streamline reservations, payments, and
                      guest experiences with Keepr.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">UI Label - 14-15px, Medium</p>
                    <p className="text-sm font-medium">Email address</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Caption - 12-14px, Regular</p>
                    <p className="text-sm text-muted-foreground">Last updated 2 hours ago</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Components</h2>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Buttons</CardTitle>
                  <CardDescription>Evergreen primary with Trail Clay focus</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Focus ring demo</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Tab through the buttons to see the Trail Clay ring
                    </p>
                    <div className="flex gap-4 flex-wrap">
                      <Button>Tab to me</Button>
                      <Button variant="secondary">Then me</Button>
                      <Button variant="outline">And me</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inputs</CardTitle>
                  <CardDescription>Light borders, clear focus state</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="default">Default input</Label>
                      <Input id="default" placeholder="Enter your email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="focused">Focus state</Label>
                      <Input id="focused" placeholder="Click to see focus ring" />
                      <p className="text-xs text-muted-foreground">Focus ring uses Trail Clay</p>
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
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tags & status</CardTitle>
                  <CardDescription>Short, confident labels that read like UI copy.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Context
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="border-keepr-evergreen/30 text-keepr-evergreen"
                        >
                          Direct booking
                        </Badge>
                        <Badge variant="secondary">Seasonal rate</Badge>
                        <Badge
                          variant="outline"
                          className="border-keepr-evergreen/30 text-keepr-evergreen"
                        >
                          Auto-pay on
                        </Badge>
                        <Badge variant="secondary">Waitlist open</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use outline or secondary for neutral tags and filters.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Status
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="success">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full bg-status-success"
                            />
                            Confirmed
                          </span>
                        </Badge>
                        <Badge variant="warning">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full bg-status-warning"
                            />
                            Needs attention
                          </span>
                        </Badge>
                        <Badge variant="error">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="h-1.5 w-1.5 rounded-full bg-status-error"
                            />
                            Blocked
                          </span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pair color with a clear word; avoid stacking multiple statuses.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cards</CardTitle>
                  <CardDescription>Structured surfaces with soft shadows</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Simple card</p>
                    <p className="text-sm text-muted-foreground">
                      Cards frame important blocks without heavy borders.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border bg-muted/40">
                    <p className="text-sm font-medium">Accent card</p>
                    <p className="text-sm text-muted-foreground">
                      Use for highlights, never for primary flows.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Accessibility</h2>
            <Card>
              <CardContent className="pt-6 grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
                <div className="space-y-3">
                  <p className="text-foreground font-medium">Always do</p>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Use Charcoal for body copy on Glacier backgrounds.</li>
                    <li>Keep focus states visible with the Trail Clay ring.</li>
                    <li>Prefer clear labels over placeholder-only fields.</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <p className="text-foreground font-medium">Avoid</p>
                  <ul className="space-y-2 list-disc pl-5">
                    <li>Using Trail Clay for small body text.</li>
                    <li>Stacking accents on top of accents.</li>
                    <li>Low-contrast text on image backgrounds.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          <footer className="pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Brand assets and press kit: hello@keeprstay.com
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
