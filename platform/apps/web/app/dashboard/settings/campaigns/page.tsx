"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// DOMPurify requires browser DOM - lazy load only on client
let DOMPurify: { sanitize: (html: string) => string } | null = null;
if (typeof window !== "undefined") {
  DOMPurify = require("dompurify");
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function CampaignsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [html, setHtml] = useState("<p>Hello from the campground!</p>");
  const [htmlMode, setHtmlMode] = useState<"visual" | "html">("visual");
  const [textBody, setTextBody] = useState("Hello from the campground!");
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [templateId, setTemplateId] = useState<string>("");
  const [templateCategory, setTemplateCategory] = useState<string>("general");
  const [filters, setFilters] = useState({
    siteType: "",
    notStayedThisYear: true,
    lastStayBefore: "",
    state: "",
    promoUsed: false,
    vip: false,
    loyaltyTier: "",
    stayFrom: "",
    stayTo: ""
  });
  const [audiencePreview, setAudiencePreview] = useState<{ count: number; sample: any[] } | null>(null);
  const [suggestions, setSuggestions] = useState<{ reason: string; filters: any }[]>([]);
  const [sendAt, setSendAt] = useState("");
  const [batchPerMinute, setBatchPerMinute] = useState("");
  const [confirmSend, setConfirmSend] = useState<null | { id: string; name: string; status: string }>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", campgroundId],
    queryFn: () => apiClient.listCampaigns(campgroundId),
    enabled: !!campgroundId
  });

  const templatesQuery = useQuery({
    queryKey: ["campaign-templates", campgroundId],
    queryFn: () => apiClient.listCampaignTemplates(campgroundId!),
    enabled: !!campgroundId
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createCampaign({
        campgroundId,
        name,
        subject,
        fromEmail,
        fromName: fromName || undefined,
        html,
        textBody,
        channel,
        templateId: templateId || undefined,
        audienceJson: filters,
        variables: {
          promoCode: "{{promoCode}}",
          unsubscribeLink: "{{unsubscribeLink}}"
        },
        scheduledAt: sendAt || null,
        batchPerMinute: batchPerMinute ? Number(batchPerMinute) : null
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campgroundId] });
      setName("");
      setSubject("");
      setFromEmail("");
      setFromName("");
      setHtml("<p>Hello from the campground!</p>");
      setTextBody("Hello from the campground!");
      toast({ title: "Saved", description: "Campaign created." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiClient.sendCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campgroundId] });
      toast({ title: "Sent", description: "Campaign send started." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" })
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-status-success/15 text-status-success border border-status-success/30">Sent</Badge>;
      case "sending":
        return <Badge className="bg-status-info/15 text-status-info border border-status-info/30">Sending</Badge>;
      case "scheduled":
        return <Badge className="bg-status-warning/15 text-status-warning border border-status-warning/30">Scheduled</Badge>;
      case "cancelled":
        return <Badge className="bg-muted text-foreground border border-border">Cancelled</Badge>;
      default:
        return <Badge className="bg-muted text-foreground border border-border">Draft</Badge>;
    }
  };

  const applyTemplate = (id: string) => {
    const tpl = templatesQuery.data?.find((t) => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setChannel(tpl.channel);
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.html) setHtml(tpl.html);
    if (tpl.textBody) setTextBody(tpl.textBody);
  };

  const previewAudience = async () => {
    if (!campgroundId) return;
    try {
      const data = await apiClient.previewCampaignAudience({ campgroundId, ...filters });
      setAudiencePreview(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const loadSuggestions = async () => {
    if (!campgroundId) return;
    try {
      const data = await apiClient.getCampaignSuggestions(campgroundId);
      // ensure filters field exists to satisfy state type
      setSuggestions((data || []).map((s: any) => ({ reason: s.reason, filters: s.filters || {} })));
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, [campgroundId]);

  const channelLabel = useMemo(() => {
    if (channel === "both") return "Email + SMS";
    return channel.toUpperCase();
  }, [channel]);

  const insertToken = (token: string) => {
    setHtml((h) => `${h}${token}`);
    setTextBody((t) => `${t} ${token}`);
  };

  const htmlPreview = useMemo(() => {
    if (htmlMode === "visual") {
      return (
        <div
          className="border rounded-md p-3 min-h-[200px] bg-card"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => setHtml((e.target as HTMLDivElement).innerHTML)}
          dangerouslySetInnerHTML={{ __html: DOMPurify?.sanitize(html) || html }}
        />
      );
    }
    return (
      <Textarea
        className="min-h-[200px]"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
      />
    );
  }, [html, htmlMode]);

  return (
    <div>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Email Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Draft and send marketing campaigns (email and SMS) to guests who opted in for the selected campground.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr] items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create campaign</CardTitle>
                <CardDescription>Subject, from info, body, channel, and audience filters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Campaign name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall Specials" />
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Welcome to Camp Everyday" />
              </div>
              <div className="space-y-1">
                <Label>Channel</Label>
                <div className="flex gap-3">
                  {(["email", "sms", "both"] as const).map((ch) => (
                    <Button
                      key={ch}
                      type="button"
                      variant={channel === ch ? "default" : "outline"}
                      onClick={() => setChannel(ch)}
                    >
                      {ch === "both" ? "Email + SMS" : ch.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>From email</Label>
                  <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourcamp.com" />
                </div>
                <div className="space-y-1">
                  <Label>From name (optional)</Label>
                  <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Camp Everyday Team" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>HTML body</Label>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Tabs value={htmlMode} onValueChange={(v) => setHtmlMode(v as "visual" | "html")}>
                      <TabsList className="h-7">
                        <TabsTrigger value="visual" className="text-xs h-7 px-2">Visual</TabsTrigger>
                        <TabsTrigger value="html" className="text-xs h-7 px-2">HTML</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="hidden md:flex items-center gap-1">
                      {["{{firstName}}", "{{lastName}}", "{{campgroundName}}", "{{siteType}}", "{{lastStayDate}}", "{{promoCode}}", "{{unsubscribeLink}}"].map((t) => (
                        <Button key={t} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertToken(t)}>
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                {htmlPreview}
                <div className="flex md:hidden flex-wrap gap-2">
                  {["{{firstName}}", "{{lastName}}", "{{campgroundName}}", "{{siteType}}", "{{lastStayDate}}", "{{promoCode}}", "{{unsubscribeLink}}"].map((t) => (
                    <Button key={t} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertToken(t)}>
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>SMS body</Label>
                <Textarea
                  className="min-h-[120px]"
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder="Short text for SMS (will include STOP to opt-out)."
                />
                <div className="text-xs text-muted-foreground">{textBody.length} chars</div>
              </div>
              <div className="space-y-1">
                <Label>Template</Label>
                <div className="flex gap-2">
                  <select
                    className="border rounded-md px-3 py-2 text-sm"
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">Select a template</option>
                    {templatesQuery.data
                      ?.sort((a, b) => (a.category || "").localeCompare(b.category || ""))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.channel}) [{t.category || "general"}]
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await apiClient.createCampaignTemplate({
                          campgroundId,
                          name: name || "Untitled",
                          channel,
                          category: templateCategory || "general",
                          subject,
                          html,
                          textBody
                        });
                        queryClient.invalidateQueries({ queryKey: ["campaign-templates", campgroundId] });
                        toast({ title: "Template saved" });
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message, variant: "destructive" });
                      }
                    }}
                  >
                    Save as template
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label>Template category</Label>
                  <Input
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    placeholder="e.g., promos, lapsed, vip"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Audience filters</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Site type</Label>
                    <select
                      className="border rounded-md px-3 py-2 text-sm"
                      value={filters.siteType}
                      onChange={(e) => setFilters((f) => ({ ...f, siteType: e.target.value }))}
                    >
                      <option value="">Any</option>
                      <option value="rv">RV</option>
                      <option value="tent">Tent</option>
                      <option value="cabin">Cabin</option>
                      <option value="group">Group</option>
                      <option value="glamping">Glamping</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>State/Province</Label>
                    <Input
                      value={filters.state}
                      onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
                      placeholder="e.g., CO"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Last stay before</Label>
                    <Input
                      type="date"
                      value={filters.lastStayBefore}
                      onChange={(e) => setFilters((f) => ({ ...f, lastStayBefore: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      id="notStayed"
                      type="checkbox"
                      checked={filters.notStayedThisYear}
                      onChange={(e) => setFilters((f) => ({ ...f, notStayedThisYear: e.target.checked }))}
                    />
                    <Label htmlFor="notStayed">Exclude guests who already stayed this year</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="promoUsed"
                      type="checkbox"
                      checked={filters.promoUsed}
                      onChange={(e) => setFilters((f) => ({ ...f, promoUsed: e.target.checked }))}
                    />
                    <Label htmlFor="promoUsed">Used a promo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="vip"
                      type="checkbox"
                      checked={filters.vip}
                      onChange={(e) => setFilters((f) => ({ ...f, vip: e.target.checked }))}
                    />
                    <Label htmlFor="vip">VIP / loyalty</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>Loyalty tier</Label>
                    <Input
                      value={filters.loyaltyTier}
                      onChange={(e) => setFilters((f) => ({ ...f, loyaltyTier: e.target.value }))}
                      placeholder="Bronze/Silver/Gold/Platinum"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Future stays from</Label>
                    <Input
                      type="date"
                      value={filters.stayFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, stayFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Future stays to</Label>
                    <Input
                      type="date"
                      value={filters.stayTo}
                      onChange={(e) => setFilters((f) => ({ ...f, stayTo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={previewAudience}>
                    Preview audience
                  </Button>
                  <Button type="button" variant="secondary" onClick={loadSuggestions}>
                    Refresh suggestions
                  </Button>
                  <div className="text-xs text-muted-foreground self-center">
                    Audience always honors marketing opt-in.
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => createMutation.mutate()} disabled={!campgroundId || createMutation.isPending}>
                  Save draft
                </Button>
                <div className="text-xs text-muted-foreground self-center">
                  Sends honor marketing opt-in and log via Postmark (email) / Twilio (SMS). Channel: {channelLabel}.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>Drafts and sends for this campground.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaignsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading campaigns…</div>}
                {!campaignsQuery.isLoading && (campaignsQuery.data?.length ?? 0) === 0 && (
                  <div className="text-sm text-muted-foreground">No campaigns yet.</div>
                )}
                <div className="space-y-3">
                  {campaignsQuery.data?.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-foreground">{c.name}</div>
                          <div className="text-sm text-muted-foreground">{c.subject}</div>
                        </div>
                        {statusBadge(c.status)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">From: {c.fromName ? `${c.fromName} ` : ""}&lt;{c.fromEmail}&gt;</div>
                      <div className="flex gap-3 mt-3">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmSend({ id: c.id, name: c.name, status: c.status })}
                          disabled={sendMutation.isPending || c.status === "sent" || c.status === "sending"}
                        >
                          Send now
                        </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const email = prompt("Test email (optional):", "") || undefined;
                            const phone = prompt("Test phone (optional):", "") || undefined;
                            if (!email && !phone) return;
                            try {
                              await apiClient.testCampaign(c.id, { email, phone });
                              toast({ title: "Test sent" });
                            } catch (err: any) {
                              toast({ title: "Error", description: err.message, variant: "destructive" });
                            }
                          }}
                        >
                          Send test
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 min-w-0 lg:max-w-lg">
            {audiencePreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Audience preview</CardTitle>
                  <CardDescription>Honors marketing opt-in</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-foreground">
                  <div>Audience size: {audiencePreview.count}</div>
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground text-xs">Sample</div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {audiencePreview.sample.map((s) => (
                        <li key={s.id}>{s.name || s.email || s.phone} ({s.email || "no email"})</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Suggested audiences</CardTitle>
                <CardDescription>Auto-detected gaps based on upcoming occupancy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestions.length === 0 && <div className="text-sm text-muted-foreground">No suggestions right now.</div>}
                {suggestions.map((s, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{s.reason}</div>
                      <div className="text-xs text-muted-foreground">Click apply to load filters.</div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setFilters((f) => ({ ...f, ...(s.filters || {}) }));
                        setAudiencePreview(null);
                        toast({ title: "Filters applied", description: s.reason });
                        await previewAudience();
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Saved email/SMS templates for quick reuse.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {templatesQuery.isLoading && <div className="text-sm text-muted-foreground">Loading templates…</div>}
                {!templatesQuery.isLoading && (templatesQuery.data?.length ?? 0) === 0 && (
                  <div className="text-sm text-muted-foreground">No templates yet. Save one from the create form.</div>
                )}
                {templatesQuery.data?.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.channel.toUpperCase()} • {t.subject || "No subject"} • {t.category || "general"}</div>
                    </div>
                    <Button variant="secondary" onClick={() => applyTemplate(t.id)}>
                      Use
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={!!confirmSend} onOpenChange={(o) => !o && setConfirmSend(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-foreground">
              <div className="font-semibold">{confirmSend?.name}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Schedule (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={sendAt}
                    onChange={(e) => setSendAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Uses campground timezone if set; otherwise browser local.</p>
                </div>
                <div>
                  <Label>Throttle (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g., 120 per minute"
                    value={batchPerMinute}
                    onChange={(e) => setBatchPerMinute(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to send as fast as provider allows.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Audience uses saved filters for this campaign and honors marketing opt-in. Email adds unsubscribe footer; SMS adds STOP instructions.
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmSend(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!confirmSend) return;
                  sendMutation.mutate(confirmSend.id, {
                    onSuccess: () => {
                      setConfirmSend(null);
                      setSendAt("");
                      setBatchPerMinute("");
                    }
                  });
                }}
                disabled={sendMutation.isPending}
              >
                Send now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

