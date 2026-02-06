import { useState, useEffect, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MapPin, Clock, Image as ImageIcon, CheckCircle2, AlertCircle, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend } from "date-fns";
import { cn } from "@/lib/utils";

interface AttendanceLog {
  log_id: string;
  punch_type: "IN" | "OUT";
  punch_time: string;
  selfie_image_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  entry_status: "auto" | "edited";
  date: string;
}

interface DayStatus {
  date: Date;
  status: "present" | "absent" | "edited" | "weekend" | "future";
  logs: AttendanceLog[];
}

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [monthData, setMonthData] = useState<Map<string, DayStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get employee ID
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

  // Fetch month's attendance data
  const fetchMonthData = useCallback(async () => {
    if (!employeeId) return;
    
    setIsLoading(true);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd"))
      .order("punch_time", { ascending: true });

    if (error) {
      console.error("Failed to fetch attendance:", error);
      setIsLoading(false);
      return;
    }

    // Group logs by date
    const logsByDate = new Map<string, AttendanceLog[]>();
    data?.forEach((log) => {
      const dateKey = log.date;
      if (!logsByDate.has(dateKey)) {
        logsByDate.set(dateKey, []);
      }
      logsByDate.get(dateKey)!.push(log);
    });

    // Build status map for all days in month
    const statusMap = new Map<string, DayStatus>();
    const today = new Date();
    
    eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const logs = logsByDate.get(dateKey) || [];
      const isFuture = date > today;
      const isWeekendDay = isWeekend(date);
      
      let status: DayStatus["status"];
      
      if (isFuture) {
        status = "future";
      } else if (isWeekendDay && logs.length === 0) {
        status = "weekend";
      } else if (logs.some(l => l.entry_status === "edited")) {
        status = "edited";
      } else if (logs.length > 0) {
        status = "present";
      } else if (!isWeekendDay) {
        status = "absent";
      } else {
        status = "weekend";
      }

      statusMap.set(dateKey, { date, status, logs });
    });

    setMonthData(statusMap);
    setIsLoading(false);
  }, [employeeId, selectedMonth]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  const handleDayClick = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayData = monthData.get(dateKey);
    if (dayData && dayData.status !== "future") {
      setSelectedDay(dayData);
      setDialogOpen(true);
    }
  };

  const getStatusColor = (status: DayStatus["status"]) => {
    switch (status) {
      case "present": return "bg-emerald-500";
      case "absent": return "bg-destructive";
      case "edited": return "bg-yellow-500";
      case "weekend": return "bg-muted";
      case "future": return "bg-transparent";
      default: return "bg-muted";
    }
  };

  const modifiers = {
    present: Array.from(monthData.values()).filter(d => d.status === "present").map(d => d.date),
    absent: Array.from(monthData.values()).filter(d => d.status === "absent").map(d => d.date),
    edited: Array.from(monthData.values()).filter(d => d.status === "edited").map(d => d.date),
    weekend: Array.from(monthData.values()).filter(d => d.status === "weekend").map(d => d.date),
  };

  const modifiersStyles = {
    present: { backgroundColor: "hsl(var(--chart-2))", color: "white" },
    absent: { backgroundColor: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))" },
    edited: { backgroundColor: "hsl(45 93% 47%)", color: "black" },
    weekend: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  };

  // Calculate summary stats
  const stats = {
    present: Array.from(monthData.values()).filter(d => d.status === "present").length,
    absent: Array.from(monthData.values()).filter(d => d.status === "absent").length,
    edited: Array.from(monthData.values()).filter(d => d.status === "edited").length,
  };

  if (isLoading && !monthData.size) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend & Stats */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Badge variant="outline" className="gap-2 py-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
          Present: {stats.present}
        </Badge>
        <Badge variant="outline" className="gap-2 py-1.5">
          <span className="w-3 h-3 rounded-full bg-destructive" />
          Absent: {stats.absent}
        </Badge>
        <Badge variant="outline" className="gap-2 py-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(45 93% 47%)" }} />
          Edited: {stats.edited}
        </Badge>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <Calendar
            mode="single"
            month={selectedMonth}
            onMonthChange={setSelectedMonth}
            onDayClick={handleDayClick}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="pointer-events-auto mx-auto"
            classNames={{
              day: cn(
                "h-9 w-9 sm:h-10 sm:w-10 text-center text-sm p-0 relative",
                "focus-within:relative focus-within:z-20 cursor-pointer",
                "hover:opacity-80 transition-opacity rounded-md"
              ),
            }}
          />
        </CardContent>
      </Card>

      {/* Day Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {selectedDay && format(selectedDay.date, "EEEE, dd MMMM yyyy")}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={selectedDay.status === "present" ? "default" : "destructive"}
                  className={cn(
                    selectedDay.status === "edited" && "bg-amber-500 text-amber-50 hover:bg-amber-600"
                  )}
                >
                  {selectedDay.status === "present" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {selectedDay.status === "absent" && <AlertCircle className="h-3 w-3 mr-1" />}
                  {selectedDay.status === "edited" && <Edit className="h-3 w-3 mr-1" />}
                  {selectedDay.status.charAt(0).toUpperCase() + selectedDay.status.slice(1)}
                </Badge>
              </div>

              {/* Punch Times */}
              {selectedDay.logs.length > 0 ? (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {selectedDay.logs.map((log) => (
                      <Card key={log.log_id} className="bg-muted/50">
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            {/* Selfie */}
                            {log.selfie_image_url ? (
                              <img
                                src={log.selfie_image_url}
                                alt="Punch selfie"
                                className="w-16 h-16 rounded-lg object-cover border"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}

                            <div className="flex-1 space-y-1">
                              {/* Punch Type & Time */}
                              <div className="flex items-center justify-between">
                                <Badge variant={log.punch_type === "IN" ? "default" : "secondary"}>
                                  Punch {log.punch_type}
                                </Badge>
                                <span className="font-semibold">
                                  {format(new Date(log.punch_time), "hh:mm a")}
                                </span>
                              </div>

                              {/* GPS Location */}
                              {log.gps_latitude && log.gps_longitude ? (
                                <a
                                  href={`https://www.google.com/maps?q=${log.gps_latitude},${log.gps_longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <MapPin className="h-3 w-3" />
                                  View on Map
                                </a>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  No location
                                </span>
                              )}

                              {/* Entry Status */}
                              {log.entry_status === "edited" && (
                                <span className="flex items-center gap-1 text-xs text-amber-600">
                                  <Edit className="h-3 w-3" />
                                  Edited by manager
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No attendance recorded for this day</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceHistory;
