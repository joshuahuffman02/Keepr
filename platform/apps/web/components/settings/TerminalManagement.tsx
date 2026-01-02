"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, MapPin, Wifi, WifiOff } from "lucide-react";

interface TerminalManagementProps {
  campgroundId: string;
}

export function TerminalManagement({ campgroundId }: TerminalManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddReader, setShowAddReader] = useState(false);
  const [newLocation, setNewLocation] = useState({
    displayName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [newReader, setNewReader] = useState({
    registrationCode: "",
    label: "",
    locationId: "",
  });

  // Fetch locations
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["terminal-locations", campgroundId],
    queryFn: () => apiClient.getTerminalLocations(campgroundId),
    enabled: !!campgroundId,
  });

  // Fetch readers
  const { data: readers, isLoading: readersLoading } = useQuery({
    queryKey: ["terminal-readers", campgroundId],
    queryFn: () => apiClient.getTerminalReaders(campgroundId),
    enabled: !!campgroundId,
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: () =>
      apiClient.createTerminalLocation(campgroundId, {
        displayName: newLocation.displayName,
        address: {
          line1: newLocation.line1,
          line2: newLocation.line2 || undefined,
          city: newLocation.city,
          state: newLocation.state,
          postal_code: newLocation.postal_code,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminal-locations", campgroundId] });
      toast({ title: "Location created", description: "Terminal location added successfully." });
      setShowAddLocation(false);
      setNewLocation({ displayName: "", line1: "", line2: "", city: "", state: "", postal_code: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) => apiClient.deleteTerminalLocation(campgroundId, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminal-locations", campgroundId] });
      toast({ title: "Location deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Register reader mutation
  const registerReaderMutation = useMutation({
    mutationFn: () =>
      apiClient.registerTerminalReader(campgroundId, {
        registrationCode: newReader.registrationCode,
        label: newReader.label,
        locationId: newReader.locationId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminal-readers", campgroundId] });
      toast({ title: "Reader registered", description: "Card reader added successfully." });
      setShowAddReader(false);
      setNewReader({ registrationCode: "", label: "", locationId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete reader mutation
  const deleteReaderMutation = useMutation({
    mutationFn: (readerId: string) => apiClient.deleteTerminalReader(campgroundId, readerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminal-readers", campgroundId] });
      toast({ title: "Reader deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = locationsLoading || readersLoading;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stripe Terminal</CardTitle>
              <CardDescription>Manage card readers for in-person payments at this campground.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddLocation(true)}>
                <MapPin className="w-4 h-4 mr-1" />
                Add Location
              </Button>
              <Button size="sm" onClick={() => setShowAddReader(true)} disabled={!locations?.length}>
                <Plus className="w-4 h-4 mr-1" />
                Add Reader
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Locations */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Locations</h4>
                {!locations?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No terminal locations. Add a location first to register readers.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {locations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{location.displayName}</p>
                            {location.address && (
                              <p className="text-xs text-muted-foreground">
                                {location.address.line1}, {location.address.city}, {location.address.state}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {location.readerCount || 0} readers
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteLocationMutation.mutate(location.id)}
                            disabled={deleteLocationMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Readers */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Card Readers</h4>
                {!readers?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No card readers registered. Add a reader to start accepting in-person payments.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {readers.map((reader) => (
                      <div
                        key={reader.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          {reader.status === "online" ? (
                            <Wifi className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{reader.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {reader.deviceType} · {reader.location?.displayName || "No location"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              reader.status === "online"
                                ? "bg-status-success-bg text-status-success-text"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {reader.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteReaderMutation.mutate(reader.id)}
                            disabled={deleteReaderMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Terminal readers process card-present payments. Each campground uses its own connected Stripe account.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Terminal Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location name</Label>
              <Input
                value={newLocation.displayName}
                onChange={(e) => setNewLocation({ ...newLocation, displayName: e.target.value })}
                placeholder="Front Office"
              />
            </div>
            <div className="space-y-2">
              <Label>Street address</Label>
              <Input
                value={newLocation.line1}
                onChange={(e) => setNewLocation({ ...newLocation, line1: e.target.value })}
                placeholder="123 Camp Road"
              />
            </div>
            <div className="space-y-2">
              <Label>Address line 2 (optional)</Label>
              <Input
                value={newLocation.line2}
                onChange={(e) => setNewLocation({ ...newLocation, line2: e.target.value })}
                placeholder="Suite 100"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={newLocation.city}
                  onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                  placeholder="Austin"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={newLocation.state}
                  onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                  placeholder="TX"
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input
                  value={newLocation.postal_code}
                  onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
                  placeholder="78701"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLocation(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createLocationMutation.mutate()}
              disabled={
                createLocationMutation.isPending ||
                !newLocation.displayName ||
                !newLocation.line1 ||
                !newLocation.city ||
                !newLocation.state ||
                !newLocation.postal_code
              }
            >
              {createLocationMutation.isPending ? "Creating..." : "Create Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Reader Dialog */}
      <Dialog open={showAddReader} onOpenChange={setShowAddReader}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Card Reader</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Registration code</Label>
              <Input
                value={newReader.registrationCode}
                onChange={(e) => setNewReader({ ...newReader, registrationCode: e.target.value })}
                placeholder="Enter code from reader display"
              />
              <p className="text-xs text-muted-foreground">
                Find this on your Stripe Terminal device screen or in the device settings.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reader label</Label>
              <Input
                value={newReader.label}
                onChange={(e) => setNewReader({ ...newReader, label: e.target.value })}
                placeholder="Front Desk Reader 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={newReader.locationId}
                onValueChange={(v) => setNewReader({ ...newReader, locationId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReader(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => registerReaderMutation.mutate()}
              disabled={
                registerReaderMutation.isPending ||
                !newReader.registrationCode ||
                !newReader.label
              }
            >
              {registerReaderMutation.isPending ? "Registering..." : "Register Reader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
