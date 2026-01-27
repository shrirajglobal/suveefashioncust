import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, LogIn, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsageEvent {
  id: string;
  user_id: string;
  event_type: string;
  created_at: string;
}

interface UserStats {
  userId: string;
  userName: string;
  phoneClicks: number;
  appOpens: number;
}

interface SalesUser {
  userId: string;
  userName: string;
}

export function UsageAnalytics() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch events for the selected date
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;

      const [profilesRes, rolesRes, eventsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("user_roles").select("user_id").eq("role", "sales_team"),
        supabase
          .from("usage_events")
          .select("*")
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay)
          .order("created_at", { ascending: false }),
      ]);

      if (profilesRes.error) {
        console.error("Failed to fetch profiles:", profilesRes.error);
      }
      if (rolesRes.error) {
        console.error("Failed to fetch user roles:", rolesRes.error);
      }
      if (eventsRes.error) {
        console.error("Failed to fetch usage events:", eventsRes.error);
      }

      const profilesMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p) => {
        profilesMap.set(p.user_id, p.full_name);
      });

      const salesUserIds = Array.from(
        new Set((rolesRes.data || []).map((r) => r.user_id))
      );

      setSalesUsers(
        salesUserIds.map((id) => ({
          userId: id,
          userName: profilesMap.get(id) || "Unknown User",
        }))
      );

      setEvents(eventsRes.data || []);

      setIsLoading(false);
    };

    fetchData();
  }, [selectedDate]);

  // Aggregate stats by salesperson (show sales team even if they have 0 activity)
  const userStats = useMemo(() => {
    const statsMap = new Map<string, UserStats>();

    // Seed with all sales users so they appear with zeros
    salesUsers.forEach((u) => {
      statsMap.set(u.userId, {
        userId: u.userId,
        userName: u.userName,
        phoneClicks: 0,
        appOpens: 0,
      });
    });

    events.forEach((event) => {
      // Only count events for sales team users
      const existing = statsMap.get(event.user_id);
      if (!existing) return;

      if (event.event_type === "phone_click") {
        existing.phoneClicks++;
      } else if (event.event_type === "app_open") {
        existing.appOpens++;
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => 
      (b.phoneClicks + b.appOpens) - (a.phoneClicks + a.appOpens)
    );
  }, [events, salesUsers]);

  const activeSalesmenCount = useMemo(
    () => userStats.filter((u) => u.phoneClicks + u.appOpens > 0).length,
    [userStats]
  );

  // Total stats
  const totals = useMemo(() => {
    return userStats.reduce(
      (acc, user) => ({
        phoneClicks: acc.phoneClicks + user.phoneClicks,
        appOpens: acc.appOpens + user.appOpens,
      }),
      { phoneClicks: 0, appOpens: 0 }
    );
  }, [userStats]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Picker */}
      <div className="flex items-center gap-3">
        <Label htmlFor="date" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Select Date
        </Label>
        <Input
          id="date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phone Clicks</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.phoneClicks}</div>
            <p className="text-xs text-muted-foreground">
              Numbers clicked on {new Date(selectedDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App Opens</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.appOpens}</div>
            <p className="text-xs text-muted-foreground">
              App opened on {new Date(selectedDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Salesmen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSalesmenCount}</div>
            <p className="text-xs text-muted-foreground">
              Salesmen with activity on this date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {salesUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No salesmen found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-center">Phone Clicks</TableHead>
                    <TableHead className="text-center">App Opens</TableHead>
                    <TableHead className="text-center">Total Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">{user.userName}</TableCell>
                      <TableCell className="text-center">{user.phoneClicks}</TableCell>
                      <TableCell className="text-center">{user.appOpens}</TableCell>
                      <TableCell className="text-center font-semibold">
                        {user.phoneClicks + user.appOpens}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
