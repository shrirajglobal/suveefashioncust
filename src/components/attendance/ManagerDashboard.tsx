import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  AlertTriangle, 
  Edit3,
  Clock,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface ManagerStats {
  teamSize: number;
  presentToday: number;
  attendancePercentage: number;
  missingEntries: number;
  editedPunches: number;
  monthlyAttendanceRate: number;
}

interface TeamMember {
  employee_id: string;
  full_name: string;
  hasPunchedToday: boolean;
}

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      const today = format(new Date(), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

      try {
        // First get manager's employee_id
        const { data: managerData } = await supabase.rpc("get_employee_id", { 
          _user_id: user.id 
        });

        if (!managerData) {
          setIsLoading(false);
          return;
        }

        // Get team members (employees reporting to this manager)
        const { data: team, error: teamError } = await supabase
          .from("employee_master")
          .select("employee_id, full_name")
          .eq("reporting_manager_id", managerData)
          .eq("status", "active");

        if (teamError) throw teamError;

        const teamSize = team?.length || 0;
        const teamEmployeeIds = team?.map(t => t.employee_id) || [];

        if (teamSize === 0) {
          setStats({
            teamSize: 0,
            presentToday: 0,
            attendancePercentage: 0,
            missingEntries: 0,
            editedPunches: 0,
            monthlyAttendanceRate: 0,
          });
          setIsLoading(false);
          return;
        }

        // Get today's attendance for team
        const { data: todayAttendance } = await supabase
          .from("attendance_logs")
          .select("employee_id")
          .eq("date", today)
          .in("employee_id", teamEmployeeIds);

        const presentEmployees = new Set(todayAttendance?.map(a => a.employee_id) || []);
        const presentToday = presentEmployees.size;

        // Map team members with attendance status
        const teamWithStatus = team?.map(member => ({
          ...member,
          hasPunchedToday: presentEmployees.has(member.employee_id),
        })) || [];

        setTeamMembers(teamWithStatus);

        // Get monthly attendance for team
        const { data: monthlyAttendance } = await supabase
          .from("attendance_logs")
          .select("employee_id, date")
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .in("employee_id", teamEmployeeIds);

        // Calculate unique attendance days per employee
        const attendanceDays = new Set(
          monthlyAttendance?.map(a => `${a.employee_id}-${a.date}`) || []
        );

        // Count edited punches this month
        const { data: editedLogs } = await supabase
          .from("attendance_logs")
          .select("log_id")
          .eq("entry_status", "edited")
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .in("employee_id", teamEmployeeIds);

        const editedPunches = editedLogs?.length || 0;

        // Calculate working days so far in month
        const daysInMonth = new Date().getDate();
        const expectedAttendance = teamSize * daysInMonth;
        const actualAttendance = attendanceDays.size;
        const monthlyAttendanceRate = expectedAttendance > 0 
          ? Math.round((actualAttendance / expectedAttendance) * 100) 
          : 0;

        // Missing entries = employees who haven't punched today
        const missingEntries = teamSize - presentToday;

        setStats({
          teamSize,
          presentToday,
          attendancePercentage: teamSize > 0 ? Math.round((presentToday / teamSize) * 100) : 0,
          missingEntries,
          editedPunches,
          monthlyAttendanceRate,
        });
      } catch (error) {
        console.error("Error fetching manager stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
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

  if (stats.teamSize === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="font-medium">No Team Members</p>
          <p className="text-sm">You don't have any employees reporting to you yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's Team Attendance */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Today's Team Attendance
        </h3>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Team Attendance */}
          <Card className={stats.attendancePercentage >= 80 
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : stats.attendancePercentage >= 50
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Team Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {stats.attendancePercentage}%
              </p>
              <Progress 
                value={stats.attendancePercentage} 
                className="mt-2 h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {stats.presentToday} of {stats.teamSize} present
              </p>
            </CardContent>
          </Card>

          {/* Missing Entries */}
          <Card className={stats.missingEntries > 0 
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" 
            : ""
          }>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
                stats.missingEntries > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
              }`}>
                <AlertTriangle className="h-4 w-4" />
                Missing Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className={`text-3xl font-bold ${
                  stats.missingEntries > 0 ? "text-amber-700 dark:text-amber-400" : ""
                }`}>
                  {stats.missingEntries}
                </p>
                {stats.missingEntries === 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    All Clear
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Haven't punched in today
              </p>
            </CardContent>
          </Card>

          {/* Edited Punches */}
          <Card className={stats.editedPunches > 0 
            ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" 
            : ""
          }>
            <CardHeader className="pb-2">
              <CardTitle className={`text-sm font-medium flex items-center gap-2 ${
                stats.editedPunches > 0 ? "text-blue-700 dark:text-blue-400" : "text-muted-foreground"
              }`}>
                <Edit3 className="h-4 w-4" />
                Edited Punches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${
                stats.editedPunches > 0 ? "text-blue-700 dark:text-blue-400" : ""
              }`}>
                {stats.editedPunches}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This month
              </p>
            </CardContent>
          </Card>

          {/* Team Size */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.teamSize}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Direct reports
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Monthly Overview */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Monthly Overview - {format(new Date(), "MMMM yyyy")}
        </h3>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Attendance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold">{stats.monthlyAttendanceRate}%</p>
              <Progress 
                value={stats.monthlyAttendanceRate} 
                className="flex-1 h-3"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on {new Date().getDate()} working days so far
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Status */}
      {teamMembers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members - Today's Status
          </h3>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div 
                    key={member.employee_id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="font-medium">{member.full_name}</span>
                    <Badge variant={member.hasPunchedToday ? "default" : "destructive"}>
                      {member.hasPunchedToday ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Present
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Not Punched
                        </>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
