import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Site } from "@keepr/shared";

interface BlackoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  onSave: (data: BlackoutFormData) => Promise<void>;
}

export type BlackoutFormData = {
  siteId: string | null;
  startDate: string;
  endDate: string;
  reason: string;
};

export function BlackoutModal({ open, onOpenChange, sites, onSave }: BlackoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BlackoutFormData>({
    siteId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        siteId: "",
        startDate: "",
        endDate: "",
        reason: "",
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...formData,
        siteId: formData.siteId || null,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Blackout Date</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site">Site (Optional)</Label>
            <select
              id="site"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.siteId ?? ""}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
            >
              <option value="">Entire Campground</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.siteNumber})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Leave blank to block off the entire campground.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Maintenance, Holiday, etc."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Blackout"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
