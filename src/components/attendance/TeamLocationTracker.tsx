import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Clock, RefreshCw, User, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface EmployeeLocation {
  employee_id: string;
  employee_name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
}

const TeamLocationTracker = () => {
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLatestLocations = async () => {
    try {
      // Get distinct latest location per employee
      const { data, error } = await supabase
        .from("employee_locations")
        .select(`
          employee_id,
          latitude,
          longitude,
          accuracy,
          recorded_at
        `)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // Get unique latest location per employee
      const latestByEmployee = new Map<string, EmployeeLocation>();
      
      for (const loc of data || []) {
        if (!latestByEmployee.has(loc.employee_id)) {
          latestByEmployee.set(loc.employee_id, {
            ...loc,
            employee_name: "", // Will be filled below
          });
        }
      }

      // Fetch employee names
      if (latestByEmployee.size > 0) {
        const employeeIds = Array.from(latestByEmployee.keys());
        const { data: employees } = await supabase
          .from("employee_master")
          .select("employee_id, full_name")
          .in("employee_id", employeeIds);

        if (employees) {
          for (const emp of employees) {
            const loc = latestByEmployee.get(emp.employee_id);
            if (loc) {
              loc.employee_name = emp.full_name;
            }
          }
        }
      }

      setLocations(Array.from(latestByEmployee.values()));
    } catch (error) {
      console.error("Failed to fetch locations:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLatestLocations();

    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchLatestLocations, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLatestLocations();
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 5) return { text: "Just now", color: "bg-green-500" };
    if (diffMinutes < 30) return { text: formatDistanceToNow(date, { addSuffix: true }), color: "bg-yellow-500" };
    return { text: formatDistanceToNow(date, { addSuffix: true }), color: "bg-gray-400" };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Team Location Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Team Location Tracker
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Showing latest known location of each team member
        </p>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No location data available yet</p>
            <p className="text-sm mt-1">
              Team members' locations will appear here during work hours
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {locations.map((loc) => {
                const timeInfo = getTimeAgo(loc.recorded_at);
                return (
                  <div
                    key={loc.employee_id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{loc.employee_name || "Unknown"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(loc.recorded_at), "hh:mm a")}</span>
                          <span className={`w-2 h-2 rounded-full ${timeInfo.color}`} />
                          <span className="text-xs">{timeInfo.text}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {loc.accuracy && (
                        <Badge variant="outline" className="text-xs">
                          ±{Math.round(loc.accuracy)}m
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openInMaps(loc.latitude, loc.longitude)}
                        className="gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="hidden sm:inline">View Map</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamLocationTracker;
