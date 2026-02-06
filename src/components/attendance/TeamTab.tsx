import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const presentCount = team.filter((m) => m.status === "present").length;
  const absentCount = team.filter((m) => m.status === "absent" || m.status === "not_punched").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{presentCount}</p>
                <p className="text-xs text-green-600">Present</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{absentCount}</p>
                <p className="text-xs text-red-600">Absent / Not Punched</p>
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
                    className={
                      member.status === "present"
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : ""
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
  );
};

export default TeamTab;
