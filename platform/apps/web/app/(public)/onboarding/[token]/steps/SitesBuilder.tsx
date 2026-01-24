"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plus,
  Layers,
  Hash,
  Trash2,
  Check,
  Tent,
  Truck,
  Home,
  Sparkles,
  Ruler,
  Zap,
  ChevronDown,
  ChevronUp,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SiteClass {
  id: string;
  name: string;
  siteType: string;
  defaultRate: number;
  // RV-specific
  rvOrientation?: string;
  electricAmps?: number[];
}

export interface SiteData {
  id?: string;
  name: string;
  siteNumber: string;
  siteClassId: string;
  // Per-site overrides (RV only)
  rigMaxLength?: number;
  powerAmps?: number;
}

interface SitesBuilderProps {
  siteClasses: SiteClass[];
  initialSites?: SiteData[];
  onSave: (sites: SiteData[]) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const iconMap: Record<string, React.ElementType> = {
  rv: Truck,
  tent: Tent,
  cabin: Home,
  yurt: Sparkles,
  glamping: Sparkles,
};

// Individual site card for editing per-site details
function SiteCard({
  site,
  siteClass,
  onUpdate,
  onRemove,
}: {
  site: SiteData;
  siteClass: SiteClass | undefined;
  onUpdate: (data: Partial<SiteData>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRv = siteClass?.siteType === "rv";
  const hasAmpOptions = isRv && siteClass?.electricAmps && siteClass.electricAmps.length > 0;
  const needsConfig = isRv; // RV sites can have per-site config

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        expanded ? "border-emerald-500/50 bg-slate-800/50" : "border-slate-700 bg-slate-800/30",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer",
          needsConfig && "hover:bg-slate-800/50",
        )}
        onClick={() => needsConfig && setExpanded(!expanded)}
      >
        <Hash className="w-3 h-3 text-slate-500" />
        <span className="text-sm font-medium text-white flex-1">{site.siteNumber}</span>
        {isRv && site.powerAmps && (
          <span className="text-xs text-yellow-400 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {site.powerAmps}A
          </span>
        )}
        {isRv && site.rigMaxLength && (
          <span className="text-xs text-slate-400">{site.rigMaxLength}ft</span>
        )}
        {needsConfig &&
          (expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && needsConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-slate-700/50 space-y-3">
              {/* RV Length */}
              <div className="space-y-1">
                <Label className="text-xs text-slate-400 flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  Max RV Length (ft)
                </Label>
                <Input
                  type="number"
                  value={site.rigMaxLength || ""}
                  onChange={(e) =>
                    onUpdate({ rigMaxLength: parseInt(e.target.value) || undefined })
                  }
                  placeholder="45"
                  className="bg-slate-900/50 border-slate-600 text-white h-8 text-sm"
                />
              </div>

              {/* Electric Amp Selection */}
              {hasAmpOptions && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    Electric Hookup
                  </Label>
                  <Select
                    value={site.powerAmps?.toString() || ""}
                    onValueChange={(val) =>
                      onUpdate({ powerAmps: val ? parseInt(val) : undefined })
                    }
                  >
                    <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white h-8 text-sm">
                      <SelectValue placeholder="Select amp" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteClass.electricAmps!.map((amp) => (
                        <SelectItem key={amp} value={amp.toString()}>
                          {amp} Amp
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SitesBuilder({
  siteClasses,
  initialSites = [],
  onSave,
  onNext,
  isLoading = false,
}: SitesBuilderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [sites, setSites] = useState<SiteData[]>(initialSites);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"bulk" | "individual" | "quick">("bulk");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");

  // Quick entry state
  const [quickSiteClassId, setQuickSiteClassId] = useState<string>(siteClasses[0]?.id || "");
  const [quickText, setQuickText] = useState("");

  // Bulk creation state
  const [bulkSiteClassId, setBulkSiteClassId] = useState<string>(siteClasses[0]?.id || "");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);
  // Default per-site values for bulk creation
  const [bulkLength, setBulkLength] = useState<number | undefined>(undefined);

  // Individual creation state
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteClassId, setNewSiteClassId] = useState<string>(siteClasses[0]?.id || "");
  const [newSiteLength, setNewSiteLength] = useState<number | undefined>(undefined);
  const [newSiteAmp, setNewSiteAmp] = useState<number | undefined>(undefined);

  const selectedBulkClass = siteClasses.find((sc) => sc.id === bulkSiteClassId);
  const selectedNewClass = siteClasses.find((sc) => sc.id === newSiteClassId);
  const isBulkRv = selectedBulkClass?.siteType === "rv";
  const isNewRv = selectedNewClass?.siteType === "rv";

  const addBulkSites = () => {
    const newSites: SiteData[] = [];
    for (let i = 0; i < bulkCount; i++) {
      const num = bulkStart + i;
      const siteNumber = bulkPrefix ? `${bulkPrefix}${num}` : `${num}`;
      const site: SiteData = {
        name: `Site ${siteNumber}`,
        siteNumber,
        siteClassId: bulkSiteClassId,
      };
      // Add RV-specific fields if applicable (no powerAmps - site inherits all options from class)
      if (isBulkRv && bulkLength) {
        site.rigMaxLength = bulkLength;
      }
      newSites.push(site);
    }
    setSites((prev) => [...prev, ...newSites]);
    // Reset for next batch
    setBulkStart(bulkStart + bulkCount);
  };

  const addIndividualSite = () => {
    if (!newSiteName.trim()) return;
    const site: SiteData = {
      name: newSiteName,
      siteNumber: newSiteName,
      siteClassId: newSiteClassId,
    };
    // Add RV-specific fields if applicable
    if (isNewRv) {
      if (newSiteLength) site.rigMaxLength = newSiteLength;
      if (newSiteAmp) site.powerAmps = newSiteAmp;
    }
    setSites((prev) => [...prev, site]);
    setNewSiteName("");
    setNewSiteLength(undefined);
    setNewSiteAmp(undefined);
  };

  const addQuickSites = () => {
    if (!quickText.trim()) return;
    // Parse comma, newline, or space-separated site numbers
    const siteNumbers = quickText
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newSites: SiteData[] = siteNumbers.map((siteNumber) => ({
      name: `Site ${siteNumber}`,
      siteNumber,
      siteClassId: quickSiteClassId,
    }));

    setSites((prev) => [...prev, ...newSites]);
    setQuickText("");
  };

  const updateSite = (index: number, data: Partial<SiteData>) => {
    setSites((prev) => prev.map((s, i) => (i === index ? { ...s, ...data } : s)));
  };

  const removeSite = (index: number) => {
    setSites((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (sites.length === 0) return;
    setSaving(true);
    try {
      await onSave(sites);
      onNext();
    } catch (error) {
      console.error("Failed to save sites:", error);
    } finally {
      setSaving(false);
    }
  };

  // Group sites by class for display
  const sitesByClass = sites.reduce<Record<string, SiteData[]>>((acc, site) => {
    const classId = site.siteClassId;
    if (!acc[classId]) acc[classId] = [];
    acc[classId].push(site);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg w-fit">
          <button
            onClick={() => setMode("bulk")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              mode === "bulk" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white",
            )}
          >
            <Layers className="w-4 h-4 inline-block mr-2" />
            Sequential
          </button>
          <button
            onClick={() => setMode("quick")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              mode === "quick" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white",
            )}
          >
            <Edit2 className="w-4 h-4 inline-block mr-2" />
            Custom List
          </button>
          <button
            onClick={() => setMode("individual")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              mode === "individual"
                ? "bg-emerald-500 text-white"
                : "text-slate-400 hover:text-white",
            )}
          >
            <Plus className="w-4 h-4 inline-block mr-2" />
            One by One
          </button>
        </div>

        {/* Bulk creation form */}
        <AnimatePresence mode="wait">
          {mode === "bulk" && (
            <motion.div
              key="bulk"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-medium text-white">Create Multiple Sites</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Site Type</Label>
                  <Select value={bulkSiteClassId} onValueChange={setBulkSiteClassId}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {siteClasses.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Prefix (optional)</Label>
                  <Input
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value)}
                    placeholder="A, B, Loop-"
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Start Number</Label>
                  <Input
                    type="number"
                    value={bulkStart}
                    onChange={(e) => setBulkStart(parseInt(e.target.value) || 1)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">How Many?</Label>
                  <Input
                    type="number"
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* RV-specific bulk options */}
              {isBulkRv && (
                <div className="pt-2 border-t border-slate-700/50 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-slate-500" />
                      Default Max Length (ft)
                    </Label>
                    <Input
                      type="number"
                      value={bulkLength || ""}
                      onChange={(e) => setBulkLength(parseInt(e.target.value) || undefined)}
                      placeholder="45"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  {selectedBulkClass?.electricAmps && selectedBulkClass.electricAmps.length > 0 && (
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Electric Options
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedBulkClass.electricAmps.map((amp) => (
                          <span
                            key={amp}
                            className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm"
                          >
                            {amp}A
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        All sites will support these amp options. You can restrict individual sites
                        later.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Preview */}
              <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
                <p className="text-slate-400 mb-2">Preview:</p>
                <p className="text-white font-mono">
                  {bulkPrefix}
                  {bulkStart}, {bulkPrefix}
                  {bulkStart + 1}, ... {bulkPrefix}
                  {bulkStart + bulkCount - 1}
                </p>
                {isBulkRv && bulkLength && (
                  <p className="text-slate-500 text-xs mt-1">Each with: {bulkLength}ft max</p>
                )}
              </div>

              <Button onClick={addBulkSites} className="w-full bg-emerald-600 hover:bg-emerald-500">
                <Plus className="w-4 h-4 mr-2" />
                Add {bulkCount} Sites
              </Button>
            </motion.div>
          )}

          {mode === "quick" && (
            <motion.div
              key="quick"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-medium text-white">Add Custom Site Numbers</h3>
              <p className="text-sm text-slate-400">
                Enter your site numbers separated by commas or new lines. Perfect for parks with
                non-sequential numbering.
              </p>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Site Type</Label>
                <Select value={quickSiteClassId} onValueChange={setQuickSiteClassId}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {siteClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Site Numbers</Label>
                <textarea
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder="101, 105, 107, 112&#10;A-1, A-3, A-7&#10;Lakefront-1, Lakefront-2&#10;..."
                  rows={5}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none font-mono text-sm"
                />
              </div>

              {/* Preview */}
              {quickText.trim() && (
                <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
                  <p className="text-slate-400 mb-2">
                    Preview ({quickText.split(/[,\n]+/).filter((s) => s.trim()).length} sites):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {quickText
                      .split(/[,\n]+/)
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0)
                      .slice(0, 12)
                      .map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-800 rounded text-white text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    {quickText.split(/[,\n]+/).filter((s) => s.trim()).length > 12 && (
                      <span className="px-2 py-0.5 text-slate-500 text-xs">
                        +{quickText.split(/[,\n]+/).filter((s) => s.trim()).length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={addQuickSites}
                disabled={!quickText.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Sites
              </Button>
            </motion.div>
          )}

          {mode === "individual" && (
            <motion.div
              key="individual"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-medium text-white">Add Individual Site</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Site Name/Number</Label>
                  <Input
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="A1, Lakeside-5, etc."
                    className="bg-slate-800/50 border-slate-700 text-white"
                    onKeyDown={(e) => e.key === "Enter" && addIndividualSite()}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Site Type</Label>
                  <Select
                    value={newSiteClassId}
                    onValueChange={(val) => {
                      setNewSiteClassId(val);
                      setNewSiteAmp(undefined);
                    }}
                  >
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {siteClasses.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* RV-specific individual options */}
              {isNewRv && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-slate-500" />
                      Max Length (ft)
                    </Label>
                    <Input
                      type="number"
                      value={newSiteLength || ""}
                      onChange={(e) => setNewSiteLength(parseInt(e.target.value) || undefined)}
                      placeholder="45"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  {selectedNewClass?.electricAmps && selectedNewClass.electricAmps.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        Electric Hookup
                      </Label>
                      <Select
                        value={newSiteAmp?.toString() || ""}
                        onValueChange={(val) => setNewSiteAmp(val ? parseInt(val) : undefined)}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue placeholder="Select amp" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedNewClass.electricAmps.map((amp) => (
                            <SelectItem key={amp} value={amp.toString()}>
                              {amp} Amp
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={addIndividualSite}
                disabled={!newSiteName.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Site
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sites list */}
        {sites.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Your Sites ({sites.length})</h3>
              <div className="flex items-center gap-3">
                {/* View mode toggle */}
                <div className="flex gap-1 p-0.5 bg-slate-800/50 rounded-md">
                  <button
                    onClick={() => setViewMode("compact")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-all",
                      viewMode === "compact"
                        ? "bg-slate-700 text-white"
                        : "text-slate-500 hover:text-white",
                    )}
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setViewMode("detailed")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-all",
                      viewMode === "detailed"
                        ? "bg-slate-700 text-white"
                        : "text-slate-500 hover:text-white",
                    )}
                  >
                    Detailed
                  </button>
                </div>
                {sites.length > 0 && (
                  <button
                    onClick={() => setSites([])}
                    className="text-sm text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {Object.entries(sitesByClass).map(([classId, classSites]) => {
              const siteClass = siteClasses.find((sc) => sc.id === classId);
              const Icon = iconMap[siteClass?.siteType || "tent"] || Tent;
              const isRvClass = siteClass?.siteType === "rv";

              return (
                <div key={classId} className="border border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/50 px-4 py-3 flex items-center gap-3">
                    <Icon className="w-5 h-5 text-emerald-400" />
                    <span className="font-medium text-white">{siteClass?.name || "Unknown"}</span>
                    <span className="text-sm text-slate-500">({classSites.length} sites)</span>
                    {isRvClass && viewMode === "compact" && (
                      <span className="text-xs text-slate-500 ml-auto">
                        Click a site to edit length/amp
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "p-4",
                      viewMode === "compact" ? "flex flex-wrap gap-2" : "space-y-2",
                    )}
                  >
                    <AnimatePresence mode="popLayout">
                      {classSites.map((site, i) => {
                        const globalIndex = sites.findIndex(
                          (s) =>
                            s.siteNumber === site.siteNumber && s.siteClassId === site.siteClassId,
                        );

                        if (viewMode === "detailed" || isRvClass) {
                          return (
                            <SiteCard
                              key={`${site.siteNumber}-${i}`}
                              site={site}
                              siteClass={siteClass}
                              onUpdate={(data) => updateSite(globalIndex, data)}
                              onRemove={() => removeSite(globalIndex)}
                            />
                          );
                        }

                        // Compact view for non-RV sites
                        return (
                          <motion.div
                            key={`${site.siteNumber}-${i}`}
                            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                            exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                            className="group flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5"
                          >
                            <Hash className="w-3 h-3 text-slate-500" />
                            <span className="text-sm text-white">{site.siteNumber}</span>
                            <button
                              onClick={() => removeSite(globalIndex)}
                              className="ml-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Empty state */}
        {sites.length === 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="text-center py-12 text-slate-500"
          >
            <Tent className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No sites yet. Use the form above to add some.</p>
          </motion.div>
        )}

        {/* Continue button */}
        {sites.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            className="pt-4"
          >
            <Button
              onClick={handleSave}
              disabled={saving || isLoading}
              className={cn(
                "w-full py-6 text-lg font-semibold transition-all",
                "bg-gradient-to-r from-emerald-500 to-teal-500",
                "hover:from-emerald-400 hover:to-teal-400",
                "disabled:opacity-50",
              )}
            >
              {saving ? "Creating Sites..." : `Create ${sites.length} Sites`}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
