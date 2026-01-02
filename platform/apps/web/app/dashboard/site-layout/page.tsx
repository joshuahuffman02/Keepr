"use client";

import { useState } from "react";
import { SiteLayoutEditor, LayoutData } from "@/components/maps/SiteLayoutEditor";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Map,
  Save,
  Upload,
  HelpCircle,
  Keyboard,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Demo initial layout
const DEMO_LAYOUT: Partial<LayoutData> = {
  sites: [
    { id: "site-1", x: 100, y: 100, width: 60, height: 40, rotation: 0, siteNumber: "A1", siteType: "rv", color: "#3b82f6" },
    { id: "site-2", x: 180, y: 100, width: 60, height: 40, rotation: 0, siteNumber: "A2", siteType: "rv", color: "#3b82f6" },
    { id: "site-3", x: 260, y: 100, width: 60, height: 40, rotation: 0, siteNumber: "A3", siteType: "rv", color: "#3b82f6" },
    { id: "site-4", x: 100, y: 200, width: 50, height: 50, rotation: 0, siteNumber: "T1", siteType: "tent", color: "#22c55e" },
    { id: "site-5", x: 170, y: 200, width: 50, height: 50, rotation: 0, siteNumber: "T2", siteType: "tent", color: "#22c55e" },
    { id: "site-6", x: 240, y: 200, width: 50, height: 50, rotation: 0, siteNumber: "T3", siteType: "tent", color: "#22c55e" },
    { id: "site-7", x: 400, y: 150, width: 80, height: 60, rotation: 0, siteNumber: "C1", siteType: "cabin", color: "#f59e0b" },
    { id: "site-8", x: 500, y: 150, width: 80, height: 60, rotation: 0, siteNumber: "C2", siteType: "cabin", color: "#f59e0b" },
  ],
  elements: [],
  gridSize: 20,
  canvasWidth: 1200,
  canvasHeight: 800,
};

const SITE_CLASSES = [
  { id: "class-rv", name: "RV Sites", color: "#3b82f6" },
  { id: "class-tent", name: "Tent Sites", color: "#22c55e" },
  { id: "class-cabin", name: "Cabins", color: "#f59e0b" },
  { id: "class-glamping", name: "Glamping", color: "#a855f7" },
];

export default function SiteLayoutPage() {
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const handleSave = (data: LayoutData) => {
    setLayoutData(data);
    setHasUnsavedChanges(false);
    toast({
      title: "Layout saved",
      description: `Saved ${data.sites.length} sites successfully.`,
    });
    console.log("Saved layout:", data);
    // In production, this would call the API to save the layout
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as LayoutData;
        setLayoutData(data);
        toast({
          title: "Layout imported",
          description: `Imported ${data.sites.length} sites from file.`,
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Could not parse the layout file.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Map className="h-8 w-8 text-emerald-600" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Site Layout Editor</h1>
                <p className="text-muted-foreground">Design your campground layout visually</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                Unsaved changes
              </Badge>
            )}

            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Keyboard className="h-4 w-4 mr-1" />
                  Shortcuts
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  <DialogDescription>Quick actions for the layout editor</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Select tool</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">V</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Add site tool</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Delete selected</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Delete</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Duplicate selected</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Undo</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Redo</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd/Ctrl + Shift + Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Deselect</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Escape</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Multi-select</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + Click</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Zoom in/out</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Scroll wheel</kbd>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Help
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to use the Site Layout Editor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h4 className="font-medium text-foreground">Adding Sites</h4>
                    <p>Select the site tool (tent icon) from the toolbar, choose a site type, then click on the canvas to place sites.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Moving Sites</h4>
                    <p>Use the select tool (arrow icon), click on a site, and drag it to move. Sites snap to the grid for easy alignment.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Editing Properties</h4>
                    <p>Select a site to see its properties panel on the right. Change site number, type, size, and rotation.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Navigation</h4>
                    <p>Use the pan tool (hand icon) or scroll wheel to zoom. Click the grid icon to toggle grid visibility.</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Saving</h4>
                    <p>Click Save to store your layout. Use Export to download as JSON for backup.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Site class legend */}
        <div className="flex items-center gap-4 p-3 bg-card rounded-lg border">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Site Types:</span>
          <div className="flex items-center gap-3">
            {SITE_CLASSES.map((sc) => (
              <div key={sc.id} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: sc.color }}
                />
                <span className="text-sm text-muted-foreground">{sc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <SiteLayoutEditor
          initialData={layoutData || DEMO_LAYOUT}
          siteClasses={SITE_CLASSES}
          onSave={handleSave}
          height="calc(100vh - 320px)"
        />
      </div>
    </DashboardShell>
  );
}
