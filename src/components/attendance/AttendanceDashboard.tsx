import { useEffect, useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, TrendingUp, CheckCircle2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

const AttendanceHistory = lazy(() => import("./AttendanceHistory"));

interface DashboardStats {
  daysPresent: number;
  totalWorkingDays: number;
  overtimeHours: number;
  pendingPayroll: number;
  lastPunchTime: string | null;
  lastPunchType: "IN" | "OUT" | null;
}

const AttendanceDashboard = () => {
  const { user, isAdminOrAccounts } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"overview" | "history">("overview");

  // Get employee ID for current user
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user) return;
      
      const { data, error } = await supabase.rpc("get_employee_id", { _user_id: user.id });
      if (!error && data) {
        setEmployeeId(data);
      }
    };
    fetchEmployeeId();
  }, [user]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!employeeId && !isAdminOrAccounts) {
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const today = format(now, "yyyy-MM-dd");
      const monthYear = format(now, "yyyy-MM");

      try {
        // For admin, show aggregate stats
        if (isAdminOrAccounts) {
          const { data: employees, error: empError } = await supabase
            .from("employee_master")
            .select("employee_id")
            .eq("status", "active");

          const { data: payrolls } = await supabase
            .from("monthly_payroll")
            .select("*")
            .eq("month_year", monthYear)
            .eq("payment_status", "pending");

          setStats({
            daysPresent: employees?.length || 0,
            totalWorkingDays: 26,
            overtimeHours: 0,
            pendingPayroll: payrolls?.length || 0,
            lastPunchTime: null,
            lastPunchType: null,
          });
          setIsLoading(false);
          return;
        }

        // For staff, show personal stats
        const { data: attendanceLogs } = await supabase
          .from("attendance_logs")
          .select("*")
          .eq("employee_id", employeeId)
          .gte("date", monthStart)
          .lte("date", monthEnd);

        // Count unique days present
        const uniqueDays = new Set(attendanceLogs?.map((log) => log.date) || []);
        const daysPresent = uniqueDays.size;

        // Get last punch
        const { data: lastPunch } = await supabase
          .from("attendance_logs")
          .select("*")
          .eq("employee_id", employeeId)
          .eq("date", today)
          .order("punch_time", { ascending: false })
          .limit(1)
          .single();

        // Get pending payroll count
        const { data: payrolls } = await supabase
          .from("monthly_payroll")
          .select("*")
          .eq("employee_id", employeeId)
          .eq("payment_status", "pending");

        setStats({
          daysPresent,
          totalWorkingDays: 26,
          overtimeHours: 0,
          pendingPayroll: payrolls?.length || 0,
          lastPunchTime: lastPunch?.punch_time || null,
          lastPunchType: lastPunch?.punch_type || null,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [employeeId, isAdminOrAccounts]);

  return (
    <div className="space-y-4">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !stats ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No data available
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Quick Status */}
              {stats.lastPunchTime && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          Last Punch: {stats.lastPunchType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(stats.lastPunchTime), "hh:mm a, dd MMM")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Grid */}
              <div className="grid gap-4 grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      This Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {stats.daysPresent}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{stats.totalWorkingDays} days
                      </span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Overtime
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {stats.overtimeHours.toFixed(1)}
                      <span className="text-sm font-normal text-muted-foreground"> hrs</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Pending Payroll
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold">{stats.pendingPayroll}</p>
                      <Badge variant={stats.pendingPayroll > 0 ? "destructive" : "secondary"}>
                        {stats.pendingPayroll > 0 ? "Pending" : "All Clear"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Today's Date */}
              <div className="text-center text-sm text-muted-foreground">
                Today: {format(new Date(), "EEEE, dd MMMM yyyy")}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <AttendanceHistory />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceDashboard;
