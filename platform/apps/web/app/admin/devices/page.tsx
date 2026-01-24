"use client";

import { useEffect, useState } from "react";
import { apiClient as ApiClient } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Zap, Lock } from "lucide-react";

type UtilityMeter = Awaited<ReturnType<typeof ApiClient.getUtilityMeters>>[number];
type SmartLock = Awaited<ReturnType<typeof ApiClient.getSmartLocks>>[number];

export default function DeviceRegistryPage() {
  const [meters, setMeters] = useState<UtilityMeter[]>([]);
  const [locks, setLocks] = useState<SmartLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metersData, locksData] = await Promise.all([
        ApiClient.getUtilityMeters(),
        ApiClient.getSmartLocks(),
      ]);
      setMeters(metersData);
      setLocks(locksData);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching devices",
        description: "Failed to load device list.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await ApiClient.triggerIotSimulation();
      toast({
        title: "Simulation Triggered",
        description: "Meter readings and lock statuses are being updated...",
      });
      // Wait a small delay to allow async jobs to process before refreshing
      setTimeout(fetchData, 1000);
    } catch (error) {
      toast({
        title: "Simulation Failed",
        description: "Could not trigger simulation.",
        variant: "destructive",
      });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Device Registry</h1>
          <p className="text-muted-foreground">Manage and monitor IoT infrastructure.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleSimulate} disabled={simulating}>
            <Zap className="mr-2 h-4 w-4" />
            {simulating ? "Simulating..." : "Trigger Simulation"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="meters" className="w-full">
        <TabsList>
          <TabsTrigger value="meters">Utility Meters ({meters.length})</TabsTrigger>
          <TabsTrigger value="locks">Smart Locks ({locks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="meters">
          <Card>
            <CardHeader>
              <CardTitle>Utility Meters</CardTitle>
              <CardDescription>Power, water, and gas meters deployed at sites.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Site ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latest Read</TableHead>
                    <TableHead>Last Read At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meters.map((meter) => {
                    const lastRead = meter.reads?.[0];
                    return (
                      <TableRow key={meter.id}>
                        <TableCell className="font-mono">{meter.serialNumber}</TableCell>
                        <TableCell className="capitalize">{meter.type}</TableCell>
                        <TableCell>{meter.siteId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={meter.status === "inactive" ? "secondary" : "default"}>
                            {meter.status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>{lastRead ? lastRead.readingValue.toFixed(2) : "-"}</TableCell>
                        <TableCell>
                          {lastRead ? new Date(lastRead.readAt).toLocaleString() : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {meters.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                        No meters found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locks">
          <Card>
            <CardHeader>
              <CardTitle>Smart Locks</CardTitle>
              <CardDescription>Access control devices for cabins and gates.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Site ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Battery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locks.map((lock) => {
                    const batteryLevel =
                      typeof lock.batteryLevel === "number" ? lock.batteryLevel : 0;
                    return (
                      <TableRow key={lock.id}>
                        <TableCell>{lock.name || "Unknown Lock"}</TableCell>
                        <TableCell className="capitalize">{lock.vendor}</TableCell>
                        <TableCell>{lock.siteId || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={lock.status === "locked" ? "default" : "destructive"}>
                            {lock.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-full max-w-[50px] bg-secondary rounded-full overflow-hidden">
                              <div
                                className={`h-full ${batteryLevel < 20 ? "bg-red-500" : "bg-green-500"}`}
                                style={{ width: `${batteryLevel}%` }}
                              />
                            </div>
                            <span className="text-sm">{batteryLevel}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {locks.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No locks found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
