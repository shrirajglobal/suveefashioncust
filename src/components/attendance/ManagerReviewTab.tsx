import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Edit, 
  MapPin, 
  XCircle,
  Loader2,
  Image as ImageIcon,
  Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { z } from "zod";

interface AttendanceIssue {
  log_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  date: string;
  punch_time: string;
  punch_type: "IN" | "OUT";
  selfie_image_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  entry_status: "auto" | "edited";
  issue_type: "missing_punch" | "edited" | "gps_mismatch" | "no_selfie";
}

interface ReviewAction {
  log_id: string;
  action: "approved" | "edited" | "rejected";
  edited_time?: string;
  reason?: string;
}

const reasonSchema = z.string().trim().min(10, "Reason must be at least 10 characters").max(500, "Reason must be less than 500 characters");

const ManagerReviewTab = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<AttendanceIssue[]>([]);
  const [reviewedLogs, setReviewedLogs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [managerId, setManagerId] = useState<string | null>(null);
  
  // Action dialog state
  const [selectedIssue, setSelectedIssue] = useState<AttendanceIssue | null>(null);
  const [actionType, setActionType] = useState<"approve" | "edit" | "reject" | null>(null);
  const [editedTime, setEditedTime] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get manager's employee ID
  useEffect(() => {
    const fetchManagerId = async () => {
      if (!user) return;
      const { data, error } = await supabase.rpc("get_employee_id", { _user_id: user.id });
      if (!error && data) {
        setManagerId(data);
      }
    };
    fetchManagerId();
  }, [user]);

  // Fetch attendance issues
  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    
    // Get last 30 days of logs
    const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const endDate = format(new Date(), "yyyy-MM-dd");

    // Fetch attendance logs with employee info
    const { data: logs, error: logsError } = await supabase
      .from("attendance_logs")
      .select(`
        log_id,
        employee_id,
        date,
        punch_time,
        punch_type,
        selfie_image_url,
        gps_latitude,
        gps_longitude,
        entry_status
      `)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .order("punch_time", { ascending: false });

    if (logsError) {
      console.error("Error fetching logs:", logsError);
      setIsLoading(false);
      return;
    }

    // Fetch employee details
    const { data: employees } = await supabase
      .from("employee_master")
      .select("employee_id, full_name, department")
      .eq("status", "active");

    const employeeMap = new Map(employees?.map(e => [e.employee_id, e]) || []);

    // Fetch already reviewed logs
    const { data: reviews } = await supabase
      .from("attendance_review")
      .select("log_id");

    const reviewedSet = new Set(reviews?.map(r => r.log_id) || []);
    setReviewedLogs(reviewedSet);

    // Identify issues
    const issuesList: AttendanceIssue[] = [];
    const logsByEmployee = new Map<string, typeof logs>();

    // Group logs by employee
    logs?.forEach(log => {
      if (!logsByEmployee.has(log.employee_id)) {
        logsByEmployee.set(log.employee_id, []);
      }
      logsByEmployee.get(log.employee_id)!.push(log);
    });

    // Analyze each log for issues
    logs?.forEach(log => {
      const employee = employeeMap.get(log.employee_id);
      if (!employee) return;

      let issueType: AttendanceIssue["issue_type"] | null = null;

      // Check for edited entries
      if (log.entry_status === "edited") {
        issueType = "edited";
      }
      // Check for missing selfie
      else if (!log.selfie_image_url) {
        issueType = "no_selfie";
      }
      // Check for missing GPS
      else if (!log.gps_latitude || !log.gps_longitude) {
        issueType = "gps_mismatch";
      }

      if (issueType) {
        issuesList.push({
          ...log,
          employee_name: employee.full_name,
          department: employee.department,
          issue_type: issueType,
        });
      }
    });

    // Also check for missing punch outs (IN without OUT on past days)
    logsByEmployee.forEach((empLogs, employeeId) => {
      const employee = employeeMap.get(employeeId);
      if (!employee) return;

      // Group by date
      const logsByDate = new Map<string, typeof empLogs>();
      empLogs.forEach(log => {
        if (!logsByDate.has(log.date)) {
          logsByDate.set(log.date, []);
        }
        logsByDate.get(log.date)!.push(log);
      });

      // Check each day for missing punch out
      logsByDate.forEach((dayLogs, date) => {
        // Skip today
        if (date === endDate) return;

        const hasIn = dayLogs.some(l => l.punch_type === "IN");
        const hasOut = dayLogs.some(l => l.punch_type === "OUT");

        if (hasIn && !hasOut) {
          const lastIn = dayLogs.find(l => l.punch_type === "IN");
          if (lastIn && !issuesList.some(i => i.log_id === lastIn.log_id)) {
            issuesList.push({
              ...lastIn,
              employee_name: employee.full_name,
              department: employee.department,
              issue_type: "missing_punch",
            });
          }
        }
      });
    });

    // Sort by date descending
    issuesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setIssues(issuesList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleAction = (issue: AttendanceIssue, action: "approve" | "edit" | "reject") => {
    setSelectedIssue(issue);
    setActionType(action);
    setEditedTime(format(new Date(issue.punch_time), "HH:mm"));
    setReason("");
  };

  const closeDialog = () => {
    setSelectedIssue(null);
    setActionType(null);
    setEditedTime("");
    setReason("");
  };

  const submitAction = async () => {
    if (!selectedIssue || !actionType || !managerId) return;

    // Validate reason for edit/reject
    if (actionType !== "approve") {
      const validation = reasonSchema.safeParse(reason);
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const reviewData: any = {
        log_id: selectedIssue.log_id,
        manager_id: managerId,
        action: actionType === "approve" ? "approved" : actionType === "edit" ? "edited" : "rejected",
        reason: actionType !== "approve" ? reason : null,
      };

      // If editing, add the new time
      if (actionType === "edit") {
        const [hours, minutes] = editedTime.split(":").map(Number);
        const originalDate = new Date(selectedIssue.punch_time);
        originalDate.setHours(hours, minutes, 0, 0);
        reviewData.edited_time = originalDate.toISOString();

        // Also update the original log's entry_status
        await supabase
          .from("attendance_logs")
          .update({ 
            entry_status: "edited",
            punch_time: originalDate.toISOString()
          })
          .eq("log_id", selectedIssue.log_id);
      }

      const { error } = await supabase
        .from("attendance_review")
        .insert(reviewData);

      if (error) throw error;

      toast.success(`Attendance ${actionType === "approve" ? "approved" : actionType === "edit" ? "edited" : "rejected"} successfully`);
      
      // Refresh data
      await fetchIssues();
      closeDialog();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit action");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIssueLabel = (type: AttendanceIssue["issue_type"]) => {
    switch (type) {
      case "missing_punch": return { label: "Missing Punch Out", variant: "destructive" as const };
      case "edited": return { label: "Previously Edited", variant: "secondary" as const };
      case "gps_mismatch": return { label: "Missing GPS", variant: "outline" as const };
      case "no_selfie": return { label: "No Selfie", variant: "outline" as const };
    }
  };

  const pendingIssues = issues.filter(i => !reviewedLogs.has(i.log_id));
  const reviewedIssues = issues.filter(i => reviewedLogs.has(i.log_id));

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{pendingIssues.length}</p>
                <p className="text-xs text-orange-600">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{reviewedIssues.length}</p>
                <p className="text-xs text-muted-foreground">Reviewed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Pending ({pendingIssues.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Reviewed ({reviewedIssues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingIssues.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">No pending issues to review</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3 pr-4">
                {pendingIssues.map((issue) => (
                  <IssueCard
                    key={issue.log_id}
                    issue={issue}
                    onAction={handleAction}
                    getIssueLabel={getIssueLabel}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="mt-4">
          {reviewedIssues.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No reviewed issues yet</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3 pr-4">
                {reviewedIssues.map((issue) => (
                  <Card key={issue.log_id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {issue.employee_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{issue.employee_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(issue.date), "dd MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Reviewed
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!selectedIssue && !!actionType} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "approve" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              {actionType === "edit" && <Edit className="h-5 w-5 text-amber-500" />}
              {actionType === "reject" && <XCircle className="h-5 w-5 text-destructive" />}
              {actionType === "approve" ? "Approve Attendance" : 
               actionType === "edit" ? "Edit Punch Time" : "Reject Attendance"}
            </DialogTitle>
            <DialogDescription>
              {selectedIssue && (
                <span>
                  {selectedIssue.employee_name} • {format(new Date(selectedIssue.date), "dd MMM yyyy")} • {selectedIssue.punch_type}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Show selfie if available */}
            {selectedIssue?.selfie_image_url && (
              <div className="flex justify-center">
                <img
                  src={selectedIssue.selfie_image_url}
                  alt="Punch selfie"
                  className="w-24 h-24 rounded-lg object-cover border"
                />
              </div>
            )}

            {/* Current time display */}
            <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
              <span className="text-sm text-muted-foreground">Current Time:</span>
              <span className="font-medium">
                {selectedIssue && format(new Date(selectedIssue.punch_time), "hh:mm a")}
              </span>
            </div>

            {/* Edit time input */}
            {actionType === "edit" && (
              <div className="space-y-2">
                <Label htmlFor="edited-time">New Time</Label>
                <Input
                  id="edited-time"
                  type="time"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                />
              </div>
            )}

            {/* Reason textarea (required for edit/reject) */}
            {actionType !== "approve" && (
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for this action (minimum 10 characters)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {reason.length}/500 characters
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant={actionType === "reject" ? "destructive" : "default"}
              onClick={submitAction}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Approve" : actionType === "edit" ? "Save Changes" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Issue Card Component
interface IssueCardProps {
  issue: AttendanceIssue;
  onAction: (issue: AttendanceIssue, action: "approve" | "edit" | "reject") => void;
  getIssueLabel: (type: AttendanceIssue["issue_type"]) => { label: string; variant: "destructive" | "secondary" | "outline" };
}

const IssueCard = ({ issue, onAction, getIssueLabel }: IssueCardProps) => {
  const issueInfo = getIssueLabel(issue.issue_type);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {issue.selfie_image_url ? (
                <img
                  src={issue.selfie_image_url}
                  alt="Selfie"
                  className="w-12 h-12 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{issue.employee_name}</p>
                <p className="text-xs text-muted-foreground">{issue.department}</p>
              </div>
            </div>
            <Badge variant={issueInfo.variant}>
              {issueInfo.label}
            </Badge>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(issue.date), "dd MMM yyyy")}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(issue.punch_time), "hh:mm a")}
            </span>
            <Badge variant="outline" className="text-xs">
              {issue.punch_type}
            </Badge>
            {issue.gps_latitude && issue.gps_longitude && (
              <a
                href={`https://www.google.com/maps?q=${issue.gps_latitude},${issue.gps_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" />
                View Map
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onAction(issue, "approve")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onAction(issue, "edit")}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onAction(issue, "reject")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagerReviewTab;
