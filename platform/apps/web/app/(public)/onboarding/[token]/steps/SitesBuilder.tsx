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

interface SiteClass {
  id: string;
  name: string;
  siteType: string;
  defaultRate: number;
}

interface SiteData {
  id?: string;
  name: string;
  siteNumber: string;
  siteClassId: string;
}

interface SitesBuilderProps {
  siteClasses: SiteClass[];
  initialSites?: SiteData[];
  onSave: (sites: SiteData[]) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const iconMap: Record<string, React.ElementType> = {
  rv: Truck,
  tent: Tent,
  cabin: Home,
  yurt: Sparkles,
};

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
  const [mode, setMode] = useState<"bulk" | "individual">("bulk");

  // Bulk creation state
  const [bulkSiteClassId, setBulkSiteClassId] = useState<string>(
    siteClasses[0]?.id || ""
  );
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);

  // Individual creation state
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteClassId, setNewSiteClassId] = useState<string>(
    siteClasses[0]?.id || ""
  );

  const addBulkSites = () => {
    const newSites: SiteData[] = [];
    for (let i = 0; i < bulkCount; i++) {
      const num = bulkStart + i;
      const siteNumber = bulkPrefix ? `${bulkPrefix}${num}` : `${num}`;
      newSites.push({
        name: `Site ${siteNumber}`,
        siteNumber,
        siteClassId: bulkSiteClassId,
      });
    }
    setSites((prev) => [...prev, ...newSites]);
    // Reset for next batch
    setBulkStart(bulkStart + bulkCount);
  };

  const addIndividualSite = () => {
    if (!newSiteName.trim()) return;
    setSites((prev) => [
      ...prev,
      {
        name: newSiteName,
        siteNumber: newSiteName,
        siteClassId: newSiteClassId,
      },
    ]);
    setNewSiteName("");
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
  const sitesByClass = sites.reduce(
    (acc, site) => {
      const classId = site.siteClassId;
      if (!acc[classId]) acc[classId] = [];
      acc[classId].push(site);
      return acc;
    },
    {} as Record<string, SiteData[]>
  );

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
              mode === "bulk"
                ? "bg-emerald-500 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Layers className="w-4 h-4 inline-block mr-2" />
            Bulk Add
          </button>
          <button
            onClick={() => setMode("individual")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              mode === "individual"
                ? "bg-emerald-500 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Plus className="w-4 h-4 inline-block mr-2" />
            One at a Time
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
                  <Select
                    value={bulkSiteClassId}
                    onValueChange={setBulkSiteClassId}
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

                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">
                    Prefix (optional)
                  </Label>
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
                    onChange={(e) =>
                      setBulkCount(parseInt(e.target.value) || 1)
                    }
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-900/50 rounded-lg p-3 text-sm">
                <p className="text-slate-400 mb-2">Preview:</p>
                <p className="text-white font-mono">
                  {bulkPrefix}
                  {bulkStart}, {bulkPrefix}
                  {bulkStart + 1}, ... {bulkPrefix}
                  {bulkStart + bulkCount - 1}
                </p>
              </div>

              <Button
                onClick={addBulkSites}
                className="w-full bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add {bulkCount} Sites
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
                  <Label className="text-sm text-slate-300">
                    Site Name/Number
                  </Label>
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
                    onValueChange={setNewSiteClassId}
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
              <h3 className="font-medium text-white">
                Your Sites ({sites.length})
              </h3>
              {sites.length > 0 && (
                <button
                  onClick={() => setSites([])}
                  className="text-sm text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {Object.entries(sitesByClass).map(([classId, classSites]) => {
              const siteClass = siteClasses.find((sc) => sc.id === classId);
              const Icon = iconMap[siteClass?.siteType || "tent"] || Tent;

              return (
                <div
                  key={classId}
                  className="border border-slate-700 rounded-xl overflow-hidden"
                >
                  <div className="bg-slate-800/50 px-4 py-3 flex items-center gap-3">
                    <Icon className="w-5 h-5 text-emerald-400" />
                    <span className="font-medium text-white">
                      {siteClass?.name || "Unknown"}
                    </span>
                    <span className="text-sm text-slate-500">
                      ({classSites.length} sites)
                    </span>
                  </div>

                  <div className="p-4 flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {classSites.map((site, i) => {
                        const globalIndex = sites.findIndex(
                          (s) =>
                            s.siteNumber === site.siteNumber &&
                            s.siteClassId === site.siteClassId
                        );
                        return (
                          <motion.div
                            key={`${site.siteNumber}-${i}`}
                            initial={
                              prefersReducedMotion
                                ? {}
                                : { opacity: 0, scale: 0.8 }
                            }
                            animate={
                              prefersReducedMotion ? {} : { opacity: 1, scale: 1 }
                            }
                            exit={
                              prefersReducedMotion
                                ? {}
                                : { opacity: 0, scale: 0.8 }
                            }
                            className="group flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5"
                          >
                            <Hash className="w-3 h-3 text-slate-500" />
                            <span className="text-sm text-white">
                              {site.siteNumber}
                            </span>
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
                "disabled:opacity-50"
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
