import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CalendarIcon,
  Users,
  TrendingUp,
  Clock,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, differenceInMinutes, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Employee {
  employee_id: string;
  full_name: string;
  department: string;
}

interface AttendanceRecord {
  employee_id: string;
  date: string;
  status: "present" | "absent" | "incomplete" | "edited";
  punchIn: string | null;
  punchOut: string | null;
  totalHours: number;
  isLate: boolean;
}

interface TeamStats {
  presentPercentage: number;
  absentDays: number;
  lateIncomplete: number;
  totalWorkingDays: number;
}

const TeamAttendanceDashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<TeamStats>({
    presentPercentage: 0,
    absentDays: 0,
    lateIncomplete: 0,
    totalWorkingDays: 0,
  });

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from("employee_master")
        .select("employee_id, full_name, department")
        .eq("status", "active")
        .order("full_name");

      if (!error && data) {
        setEmployees(data);
      }
    };
    fetchEmployees();
  }, []);

  // Fetch attendance data based on filters
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!dateRange?.from || !dateRange?.to) return;

      setIsLoading(true);

      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Get all attendance logs in date range
      let query = supabase
        .from("attendance_logs")
        .select("*")
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: false })
        .order("punch_time", { ascending: true });

      if (selectedEmployee !== "all") {
        query = query.eq("employee_id", selectedEmployee);
      }

      const { data: logs, error } = await query;

      if (error) {
        console.error("Error fetching attendance:", error);
        setIsLoading(false);
        return;
      }

      // Get list of employees to process
      const employeesToProcess = selectedEmployee !== "all" 
        ? employees.filter(e => e.employee_id === selectedEmployee)
        : employees;

      // Calculate working days in range
      const allDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const workingDays = allDays.filter(day => !isWeekend(day));

      // Process attendance data
      const records: AttendanceRecord[] = [];
      
      employeesToProcess.forEach(emp => {
        workingDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayLogs = (logs || []).filter(
            l => l.employee_id === emp.employee_id && l.date === dateStr
          );

          const punchIn = dayLogs.find(l => l.punch_type === "IN");
          const punchOut = dayLogs.find(l => l.punch_type === "OUT");
          const isEdited = dayLogs.some(l => l.entry_status === "edited");

          let status: AttendanceRecord["status"] = "absent";
          let totalHours = 0;
          let isLate = false;

          if (punchIn && punchOut) {
            status = isEdited ? "edited" : "present";
            totalHours = differenceInMinutes(
              new Date(punchOut.punch_time),
              new Date(punchIn.punch_time)
            ) / 60;
            
            // Check if late (after 9:30 AM)
            const punchInTime = new Date(punchIn.punch_time);
            const hours = punchInTime.getHours();
            const minutes = punchInTime.getMinutes();
            isLate = hours > 9 || (hours === 9 && minutes > 30);
          } else if (punchIn && !punchOut) {
            status = "incomplete";
          } else if (isEdited) {
            status = "edited";
          }

          records.push({
            employee_id: emp.employee_id,
            date: dateStr,
            status,
            punchIn: punchIn?.punch_time || null,
            punchOut: punchOut?.punch_time || null,
            totalHours,
            isLate,
          });
        });
      });

      // Apply status filter
      let filteredRecords = records;
      if (statusFilter !== "all") {
        if (statusFilter === "late_incomplete") {
          filteredRecords = records.filter(r => r.isLate || r.status === "incomplete");
        } else {
          filteredRecords = records.filter(r => r.status === statusFilter);
        }
      }

      setAttendanceData(filteredRecords);

      // Calculate stats
      const presentCount = records.filter(r => r.status === "present" || r.status === "edited").length;
      const absentCount = records.filter(r => r.status === "absent").length;
      const lateIncompleteCount = records.filter(r => r.isLate || r.status === "incomplete").length;
      const totalDays = records.length;

      setStats({
        presentPercentage: totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0,
        absentDays: absentCount,
        lateIncomplete: lateIncompleteCount,
        totalWorkingDays: totalDays,
      });

      setIsLoading(false);
    };

    if (employees.length > 0) {
      fetchAttendance();
    }
  }, [dateRange, selectedEmployee, statusFilter, employees]);

  const getEmployeeName = (employeeId: string) => {
    return employees.find(e => e.employee_id === employeeId)?.full_name || "Unknown";
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.status === "present") {
      return <Badge className="bg-emerald-500">Present</Badge>;
    }
    if (record.status === "absent") {
      return <Badge variant="destructive">Absent</Badge>;
    }
    if (record.status === "incomplete") {
      return <Badge className="bg-amber-500">Incomplete</Badge>;
    }
    if (record.status === "edited") {
      return <Badge className="bg-yellow-500">Edited</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "PPP")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="edited">Edited</SelectItem>
                  <SelectItem value="late_incomplete">Late / Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.presentPercentage}%</p>
                  <p className="text-xs text-muted-foreground">Present Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.absentDays}</p>
                  <p className="text-xs text-muted-foreground">Absent Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.lateIncomplete}</p>
                  <p className="text-xs text-muted-foreground">Late / Incomplete</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalWorkingDays}</p>
                  <p className="text-xs text-muted-foreground">Total Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Attendance Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No attendance records found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Punch In</TableHead>
                    <TableHead>Punch Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.slice(0, 50).map((record, idx) => (
                    <TableRow key={`${record.employee_id}-${record.date}-${idx}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getEmployeeName(record.employee_id)
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">
                            {getEmployeeName(record.employee_id)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(record.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.punchIn ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(record.punchIn), "hh:mm a")}
                            {record.isLate && (
                              <Badge variant="outline" className="text-xs ml-1 text-amber-600 border-amber-300">
                                Late
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.punchOut ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(record.punchOut), "hh:mm a")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {record.totalHours > 0 ? (
                          <span className={record.totalHours < 8 ? "text-amber-600" : "text-emerald-600"}>
                            {record.totalHours.toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(record)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {attendanceData.length > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing 50 of {attendanceData.length} records
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamAttendanceDashboard;
