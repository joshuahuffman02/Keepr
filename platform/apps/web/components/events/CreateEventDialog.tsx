"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { EventTypeSchema } from "@keepr/shared";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  campgroundId: string;
}

type EventType = z.infer<typeof EventTypeSchema>;

type EventFormState = {
  title: string;
  description: string;
  eventType: EventType;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  priceCents: number;
  isGuestOnly: boolean;
  isPublished: boolean;
  isAllDay: boolean;
  imageUrl: string;
};

const isEventType = (value: string): value is EventType => EventTypeSchema.safeParse(value).success;

export function CreateEventDialog({
  open,
  onOpenChange,
  onSuccess,
  campgroundId,
}: CreateEventDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EventFormState>({
    title: "",
    description: "",
    eventType: "activity",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    location: "",
    isAllDay: false,
    isGuestOnly: true,
    isPublished: true,
    priceCents: 0,
    imageUrl: "",
  });
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.createEvent({
        campgroundId,
        title: formData.title,
        description: formData.description || undefined,
        eventType: formData.eventType,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        location: formData.location || undefined,
        priceCents: formData.priceCents || 0,
        isGuestOnly: formData.isGuestOnly,
        isPublished: formData.isPublished,
        isAllDay: formData.isAllDay,
        imageUrl: formData.imageUrl || undefined,
      });

      toast({
        title: "Event created",
        description: "The event has been successfully scheduled.",
      });
      onSuccess();
      onOpenChange(false);
      setFormData({
        title: "",
        description: "",
        eventType: "activity",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        location: "",
        isAllDay: false,
        isGuestOnly: true,
        isPublished: true,
        priceCents: 0,
        imageUrl: "",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Event</DialogTitle>
          <DialogDescription>Add a new event or activity to the calendar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              required
              value={formData.title || ""}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Morning Yoga"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.eventType}
                onValueChange={(value) => {
                  if (isEventType(value)) {
                    setFormData({ ...formData, eventType: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EventTypeSchema.options.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ""}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Pavilion"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={
                  formData.startDate ? new Date(formData.startDate).toISOString().split("T")[0] : ""
                }
                onChange={(e) =>
                  setFormData({ ...formData, startDate: new Date(e.target.value).toISOString() })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={
                  formData.endDate ? new Date(formData.endDate).toISOString().split("T")[0] : ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                  })
                }
              />
            </div>
          </div>

          {!formData.isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime || ""}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime || ""}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="isAllDay">All Day Event</Label>
            <Switch
              id="isAllDay"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details about the event..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              value={formData.imageUrl || ""}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://images.example.com/event.jpg"
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const signed = await apiClient.signUpload({
                      filename: file.name,
                      contentType: file.type,
                    });
                    await fetch(signed.uploadUrl, {
                      method: "PUT",
                      body: file,
                      headers: { "Content-Type": file.type },
                    });
                    setFormData((s) => ({ ...s, imageUrl: signed.publicUrl }));
                  } catch (err) {
                    toast({
                      title: "Upload failed",
                      description: err instanceof Error ? err.message : "Upload failed",
                      variant: "destructive",
                    });
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (Cents)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={formData.priceCents || 0}
                onChange={(e) =>
                  setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center justify-between pt-8">
              <Label htmlFor="isGuestOnly">Guest Only</Label>
              <Switch
                id="isGuestOnly"
                checked={formData.isGuestOnly}
                onCheckedChange={(checked) => setFormData({ ...formData, isGuestOnly: checked })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Event
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
