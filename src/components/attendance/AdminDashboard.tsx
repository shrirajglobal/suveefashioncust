import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  UserX, 
  Wallet, 
  Clock,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatINR } from "@/lib/formatters";

interface AdminStats {
  totalStaff: number;
  presentToday: number;
  absentToday: number;
  totalPayrollThisMonth: number;
  pendingPayments: number;
  pendingPayrollAmount: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const monthYear = format(new Date(), "yyyy-MM");

      try {
        // Get total active staff
        const { data: employees, error: empError } = await supabase
          .from("employee_master")
          .select("employee_id")
          .eq("status", "active");

        if (empError) throw empError;

        const totalStaff = employees?.length || 0;

        // Get today's attendance (unique employees who punched in)
        const { data: todayAttendance } = await supabase
          .from("attendance_logs")
          .select("employee_id")
          .eq("date", today);

        const uniquePresentToday = new Set(todayAttendance?.map(a => a.employee_id) || []);
        const presentToday = uniquePresentToday.size;
        const absentToday = totalStaff - presentToday;

        // Get payroll stats for this month
        const { data: payrolls } = await supabase
          .from("monthly_payroll")
          .select("net_salary, payment_status")
          .eq("month_year", monthYear);

        const totalPayrollThisMonth = payrolls?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0;
        const pendingPayrolls = payrolls?.filter(p => p.payment_status === "pending") || [];
        const pendingPayments = pendingPayrolls.length;
        const pendingPayrollAmount = pendingPayrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);

        setStats({
          totalStaff,
          presentToday,
          absentToday,
          totalPayrollThisMonth,
          pendingPayments,
          pendingPayrollAmount,
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Unable to load dashboard data
        </CardContent>
      </Card>
    );
  }

  const attendancePercentage = stats.totalStaff > 0 
    ? Math.round((stats.presentToday / stats.totalStaff) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Today's Overview */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Today's Overview
        </h3>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Present Today */}
          <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Present Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                {stats.presentToday}
                <span className="text-sm font-normal text-emerald-600 dark:text-emerald-500">
                  /{stats.totalStaff}
                </span>
              </p>
              <Progress 
                value={attendancePercentage} 
                className="mt-2 h-2 bg-emerald-100 dark:bg-emerald-900"
              />
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                {attendancePercentage}% attendance
              </p>
            </CardContent>
          </Card>

          {/* Absent Today */}
          <Card className={stats.absentToday > 0 
            ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" 
            : ""
          }>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
                stats.absentToday > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"
              }`}>
                <UserX className="h-4 w-4" />
                Absent Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${
                stats.absentToday > 0 ? "text-red-700 dark:text-red-400" : ""
              }`}>
                {stats.absentToday}
              </p>
              {stats.absentToday > 0 && (
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  {Math.round((stats.absentToday / stats.totalStaff) * 100)}% of team
                </p>
              )}
            </CardContent>
          </Card>

          {/* Total Staff */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalStaff}</p>
              <p className="text-xs text-muted-foreground mt-1">Active employees</p>
            </CardContent>
          </Card>

          {/* Today's Date */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-primary">
                {format(new Date(), "EEEE")}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "dd MMMM yyyy")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payroll Overview */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Payroll - {format(new Date(), "MMMM yyyy")}
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {/* Total Payroll */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Payroll
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatINR(stats.totalPayrollThisMonth)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This month's liability
              </p>
            </CardContent>
          </Card>

          {/* Pending Payments */}
          <Card className={stats.pendingPayments > 0 
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" 
            : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
          }>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
                stats.pendingPayments > 0 
                  ? "text-amber-700 dark:text-amber-400" 
                  : "text-emerald-700 dark:text-emerald-400"
              }`}>
                <AlertCircle className="h-4 w-4" />
                Pending Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className={`text-2xl font-bold ${
                  stats.pendingPayments > 0 
                    ? "text-amber-700 dark:text-amber-400" 
                    : "text-emerald-700 dark:text-emerald-400"
                }`}>
                  {stats.pendingPayments}
                </p>
                <Badge variant={stats.pendingPayments > 0 ? "destructive" : "secondary"}>
                  {stats.pendingPayments > 0 ? "Action Required" : "All Clear"}
                </Badge>
              </div>
              {stats.pendingPayments > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  {formatINR(stats.pendingPayrollAmount)} pending
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payment Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalStaff > 0 ? (
                <>
                  <p className="text-2xl font-bold">
                    {stats.totalStaff - stats.pendingPayments}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{stats.totalStaff} paid
                    </span>
                  </p>
                  <Progress 
                    value={((stats.totalStaff - stats.pendingPayments) / stats.totalStaff) * 100} 
                    className="mt-2 h-2"
                  />
                </>
              ) : (
                <p className="text-muted-foreground">No payroll data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
