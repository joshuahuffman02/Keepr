"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  BarChart3,
  ExternalLink,
  Edit,
  Trash2,
  DollarSign,
  Bell,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const SITE_TYPES = [
  { value: "rv", label: "RV" },
  { value: "tent", label: "Tent" },
  { value: "cabin", label: "Cabin" },
  { value: "glamping", label: "Glamping" },
  { value: "hotel_room", label: "Hotel Room" },
  { value: "yurt", label: "Yurt" },
];

type Competitor = {
  id: string;
  campgroundId: string;
  name: string;
  url?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rates?: CompetitorRate[];
};

type CompetitorRate = {
  id: string;
  competitorId: string;
  siteType: string;
  rateNightly: number;
  source: string;
  capturedAt: string;
  validFrom?: string;
  validTo?: string;
  notes?: string;
  competitor?: Competitor;
};

type MarketPosition = {
  siteType: string;
  yourRate: number;
  position: number;
  totalCompetitors: number;
  positionLabel: string;
  averageMarketRate: number;
  lowestRate: number;
  highestRate: number;
  competitorRates: Array<{
    competitorId: string;
    competitorName: string;
    rate: number;
    difference: number;
    percentDifference: number;
  }>;
};

type RateParityAlert = {
  id: string;
  campgroundId: string;
  siteType: string;
  directRateCents: number;
  otaRateCents: number;
  otaSource: string;
  difference: number;
  status: "active" | "acknowledged" | "resolved";
  createdAt: string;
};

export default function CompetitorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddCompetitorOpen, setIsAddCompetitorOpen] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [activeTab, setActiveTab] = useState<"competitors" | "comparison" | "alerts">("competitors");

  // Form states
  const [competitorForm, setCompetitorForm] = useState({
    name: "",
    url: "",
    notes: "",
  });
  const [rateForm, setRateForm] = useState({
    competitorId: "",
    siteType: "rv",
    rateNightly: "",
    source: "manual",
    notes: "",
  });

  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get competitors
  const { data: competitors = [], isLoading: loadingCompetitors } = useQuery({
    queryKey: ["competitors", campground?.id],
    queryFn: () => apiClient.getCompetitors(campground!.id),
    enabled: !!campground?.id,
  });

  // Get market position
  const { data: marketPosition = [], isLoading: loadingPosition } = useQuery({
    queryKey: ["market-position", campground?.id],
    queryFn: () => apiClient.getMarketPosition(campground!.id),
    enabled: !!campground?.id,
  });

  // Get rate parity alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ["rate-parity-alerts", campground?.id],
    queryFn: () => apiClient.getRateParityAlerts(campground!.id),
    enabled: !!campground?.id,
  });

  // Mutations
  const createCompetitorMutation = useMutation({
    mutationFn: (data: typeof competitorForm) =>
      apiClient.createCompetitor(campground!.id, data),
    onSuccess: () => {
      toast({ title: "Competitor added successfully" });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      setIsAddCompetitorOpen(false);
      setCompetitorForm({ name: "", url: "", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add competitor", description: error.message, variant: "destructive" });
    },
  });

  const deleteCompetitorMutation = useMutation({
    mutationFn: (competitorId: string) =>
      apiClient.deleteCompetitor(campground!.id, competitorId),
    onSuccess: () => {
      toast({ title: "Competitor deleted" });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete competitor", description: error.message, variant: "destructive" });
    },
  });

  const createRateMutation = useMutation({
    mutationFn: (data: typeof rateForm) =>
      apiClient.createCompetitorRate(campground!.id, {
        ...data,
        rateNightly: Math.round(parseFloat(data.rateNightly) * 100),
      }),
    onSuccess: () => {
      toast({ title: "Rate added successfully" });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      queryClient.invalidateQueries({ queryKey: ["market-position"] });
      setIsAddRateOpen(false);
      setRateForm({ competitorId: "", siteType: "rv", rateNightly: "", source: "manual", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add rate", description: error.message, variant: "destructive" });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiClient.acknowledgeRateParityAlert(campground!.id, alertId),
    onSuccess: () => {
      toast({ title: "Alert acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["rate-parity-alerts"] });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiClient.resolveRateParityAlert(campground!.id, alertId),
    onSuccess: () => {
      toast({ title: "Alert resolved" });
      queryClient.invalidateQueries({ queryKey: ["rate-parity-alerts"] });
    },
  });

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view competitive intelligence</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const activeAlerts = (alerts as RateParityAlert[]).filter((a) => a.status === "active");

  return (
    <DashboardShell>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Link href="/ai">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Competitive Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Track competitors and monitor your market position
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddCompetitorOpen} onOpenChange={setIsAddCompetitorOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Competitor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Competitor</DialogTitle>
                  <DialogDescription>
                    Track a new competitor to compare rates and market position.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Competitor Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Sunny RV Park"
                      value={competitorForm.name}
                      onChange={(e) => setCompetitorForm({ ...competitorForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Website URL (optional)</Label>
                    <Input
                      id="url"
                      placeholder="https://..."
                      value={competitorForm.url}
                      onChange={(e) => setCompetitorForm({ ...competitorForm, url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional notes about this competitor..."
                      value={competitorForm.notes}
                      onChange={(e) => setCompetitorForm({ ...competitorForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddCompetitorOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createCompetitorMutation.mutate(competitorForm)}
                    disabled={!competitorForm.name || createCompetitorMutation.isPending}
                  >
                    {createCompetitorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Competitor
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddRateOpen} onOpenChange={setIsAddRateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  Log Rate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Competitor Rate</DialogTitle>
                  <DialogDescription>
                    Manually enter a rate you observed from a competitor.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Competitor</Label>
                    <Select
                      value={rateForm.competitorId}
                      onValueChange={(v) => setRateForm({ ...rateForm, competitorId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select competitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {(competitors as Competitor[]).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Site Type</Label>
                    <Select
                      value={rateForm.siteType}
                      onValueChange={(v) => setRateForm({ ...rateForm, siteType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITE_TYPES.map((st) => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateNightly">Nightly Rate ($)</Label>
                    <Input
                      id="rateNightly"
                      type="number"
                      placeholder="e.g., 45.00"
                      value={rateForm.rateNightly}
                      onChange={(e) => setRateForm({ ...rateForm, rateNightly: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={rateForm.source}
                      onValueChange={(v) => setRateForm({ ...rateForm, source: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual Entry</SelectItem>
                        <SelectItem value="ota">OTA Listing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rateNotes">Notes (optional)</Label>
                    <Textarea
                      id="rateNotes"
                      placeholder="e.g., Weekend rate, peak season..."
                      value={rateForm.notes}
                      onChange={(e) => setRateForm({ ...rateForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddRateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createRateMutation.mutate(rateForm)}
                    disabled={!rateForm.competitorId || !rateForm.rateNightly || createRateMutation.isPending}
                  >
                    {createRateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log Rate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="h-5 w-5 text-violet-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(competitors as Competitor[]).length}
              </div>
              <p className="text-xs text-muted-foreground">Tracked Competitors</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(marketPosition as MarketPosition[]).length > 0
                  ? Math.round(
                      (marketPosition as MarketPosition[]).reduce((acc, p) => acc + p.position, 0) /
                        (marketPosition as MarketPosition[]).length
                    )
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">Avg. Market Position</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(marketPosition as MarketPosition[]).length > 0
                  ? `$${((marketPosition as MarketPosition[]).reduce((acc, p) => acc + p.averageMarketRate, 0) / (marketPosition as MarketPosition[]).length / 100).toFixed(0)}`
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">Avg. Market Rate</p>
            </CardContent>
          </Card>

          <Card className={cn(activeAlerts.length > 0 && "border-amber-500")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className={cn("h-5 w-5", activeAlerts.length > 0 ? "text-amber-500" : "text-muted-foreground")} />
              </div>
              <div className="text-2xl font-bold text-foreground">{activeAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Rate Parity Alerts</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          {(["competitors", "comparison", "alerts"] as const).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              className={cn(
                "capitalize rounded-b-none border-b-2 border-transparent",
                activeTab === tab && "border-primary"
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === "alerts" && activeAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {activeAlerts.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "competitors" && (
            <motion.div
              key="competitors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={SPRING_CONFIG}
            >
              {loadingCompetitors ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (competitors as Competitor[]).length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Competitors Added</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start tracking competitors to compare your rates and market position.
                      </p>
                      <Button onClick={() => setIsAddCompetitorOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Your First Competitor
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(competitors as Competitor[]).map((competitor) => (
                    <Card key={competitor.id}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{competitor.name}</h3>
                              {competitor.url && (
                                <a
                                  href={competitor.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  {competitor.url}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {competitor.notes && (
                                <p className="text-sm text-muted-foreground mt-1">{competitor.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteCompetitorMutation.mutate(competitor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {competitor.rates && competitor.rates.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Latest Rates</h4>
                            <div className="flex flex-wrap gap-2">
                              {competitor.rates.slice(0, 5).map((rate) => (
                                <Badge key={rate.id} variant="secondary" className="gap-1">
                                  <span className="uppercase text-xs">{rate.siteType}:</span>
                                  ${(rate.rateNightly / 100).toFixed(0)}/night
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "comparison" && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={SPRING_CONFIG}
            >
              {loadingPosition ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (marketPosition as MarketPosition[]).length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Comparison Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Add competitors and log their rates to see your market position.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(marketPosition as MarketPosition[]).map((pos) => (
                    <Card key={pos.siteType}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg uppercase">{pos.siteType.replace("_", " ")}</CardTitle>
                          <Badge
                            variant={pos.position === 1 ? "default" : pos.position <= 3 ? "secondary" : "outline"}
                            className={cn(
                              pos.position === 1 && "bg-emerald-500",
                              pos.position === pos.totalCompetitors && "bg-amber-500"
                            )}
                          >
                            {pos.positionLabel}
                          </Badge>
                        </div>
                        <CardDescription>
                          Your rate: ${(pos.yourRate / 100).toFixed(0)} | Market avg: ${(pos.averageMarketRate / 100).toFixed(0)} | Range: ${(pos.lowestRate / 100).toFixed(0)} - ${(pos.highestRate / 100).toFixed(0)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Competitor</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">vs. You</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="bg-primary/5">
                              <TableCell className="font-medium">Your Rate</TableCell>
                              <TableCell className="text-right font-bold">${(pos.yourRate / 100).toFixed(0)}</TableCell>
                              <TableCell className="text-right">-</TableCell>
                            </TableRow>
                            {pos.competitorRates.map((cr) => (
                              <TableRow key={cr.competitorId}>
                                <TableCell>{cr.competitorName}</TableCell>
                                <TableCell className="text-right">${(cr.rate / 100).toFixed(0)}</TableCell>
                                <TableCell className="text-right">
                                  <span className={cn(
                                    "flex items-center justify-end gap-1",
                                    cr.difference > 0 ? "text-emerald-600" : cr.difference < 0 ? "text-red-600" : "text-muted-foreground"
                                  )}>
                                    {cr.difference > 0 ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : cr.difference < 0 ? (
                                      <TrendingDown className="h-3 w-3" />
                                    ) : null}
                                    {cr.difference > 0 ? "+" : ""}{cr.percentDifference}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "alerts" && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={SPRING_CONFIG}
            >
              {loadingAlerts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (alerts as RateParityAlert[]).length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Rate Parity Issues</h3>
                      <p className="text-sm text-muted-foreground">
                        Your direct rates are competitive with OTA listings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(alerts as RateParityAlert[]).map((alert) => (
                    <Card key={alert.id} className={cn(
                      alert.status === "active" && "border-l-4 border-l-amber-500"
                    )}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg",
                              alert.status === "active"
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                                : "bg-muted text-muted-foreground"
                            )}>
                              <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground uppercase">
                                  {alert.siteType.replace("_", " ")}
                                </h3>
                                <Badge variant={alert.status === "active" ? "destructive" : "secondary"}>
                                  {alert.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {alert.otaSource} has this at <span className="font-bold">${(alert.otaRateCents / 100).toFixed(0)}</span>,
                                but your direct rate is <span className="font-bold">${(alert.directRateCents / 100).toFixed(0)}</span>.
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Difference: ${(alert.difference / 100).toFixed(2)} ({Math.round((alert.difference / alert.directRateCents) * 100)}% lower on OTA)
                              </p>
                            </div>
                          </div>
                          {alert.status === "active" && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                              >
                                Acknowledge
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => resolveAlertMutation.mutate(alert.id)}
                              >
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
