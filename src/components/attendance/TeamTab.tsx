import { useEffect, useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, XCircle, Users, AlertTriangle, BarChart3, Flag, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import AddEmployeeForm from "./AddEmployeeForm";

const ManagerReviewTab = lazy(() => import("./ManagerReviewTab"));
const TeamAttendanceDashboard = lazy(() => import("./TeamAttendanceDashboard"));
const FlaggedEntriesReview = lazy(() => import("./FlaggedEntriesReview"));
interface TeamMember {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  status: "present" | "absent" | "not_punched";
  lastPunchTime: string | null;
  lastPunchType: "IN" | "OUT" | null;
}

const TeamTab = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"status" | "dashboard" | "flags" | "review">("status");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEmployeeAdded = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    const fetchTeam = async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch all active employees
      const { data: employees, error: empError } = await supabase
        .from("employee_master")
        .select("*")
        .eq("status", "active")
        .order("full_name");

      if (empError) {
        console.error("Error fetching employees:", empError);
        setIsLoading(false);
        return;
      }

      // Fetch today's attendance for all employees
      const { data: attendance } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("date", today)
        .order("punch_time", { ascending: false });

      // Map employees with their attendance status
      const teamData: TeamMember[] = (employees || []).map((emp) => {
        const empAttendance = attendance?.filter((a) => a.employee_id === emp.employee_id) || [];
        const lastPunch = empAttendance[0];

        let status: TeamMember["status"] = "not_punched";
        if (empAttendance.length > 0) {
          status = lastPunch?.punch_type === "IN" ? "present" : "absent";
        }

        return {
          employee_id: emp.employee_id,
          full_name: emp.full_name,
          department: emp.department,
          role: emp.role,
          status,
          lastPunchTime: lastPunch?.punch_time || null,
          lastPunchType: lastPunch?.punch_type || null,
        };
      });

      setTeam(teamData);
      setIsLoading(false);
    };

    fetchTeam();
  }, [refreshKey]);

  const presentCount = team.filter((m) => m.status === "present").length;
  const absentCount = team.filter((m) => m.status === "absent" || m.status === "not_punched").length;

  return (
    <div className="space-y-4">
      {/* Header with Add Employee button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Team Management</h2>
        <AddEmployeeForm onSuccess={handleEmployeeAdded} />
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Today</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="flags" className="gap-2">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Flags</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Review</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold text-primary">{presentCount}</p>
                        <p className="text-xs text-muted-foreground">Present</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="text-2xl font-bold text-destructive">{absentCount}</p>
                        <p className="text-xs text-muted-foreground">Absent / Not Punched</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Team List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Team Status</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {team.map((member) => (
                      <div
                        key={member.employee_id}
                        className="flex items-center justify-between p-4 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {member.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.role} • {member.department}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              member.status === "present"
                                ? "default"
                                : member.status === "absent"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {member.status === "present"
                              ? "Present"
                              : member.status === "absent"
                              ? "Left"
                              : "Not Punched"}
                          </Badge>
                          {member.lastPunchTime && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(member.lastPunchTime), "hh:mm a")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <TeamAttendanceDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <FlaggedEntriesReview />
          </Suspense>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <ManagerReviewTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamTab;

