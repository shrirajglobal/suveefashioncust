import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  UserX,
  Clock,
  Camera,
  MapPin,
  CheckCircle2,
  Loader2,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface AttendanceFlag {
  flag_id: string;
  employee_id: string;
  date: string;
  flag_type: string;
  description: string | null;
  is_resolved: boolean;
  resolution_notes: string | null;
  created_at: string;
  employee_master?: {
    full_name: string;
    department: string;
  };
}

const FLAG_ICONS: Record<string, React.ReactNode> = {
  absent: <UserX className="h-4 w-4" />,
  incomplete_punch: <Clock className="h-4 w-4" />,
  missing_selfie: <Camera className="h-4 w-4" />,
  missing_gps: <MapPin className="h-4 w-4" />,
};

const FLAG_COLORS: Record<string, string> = {
  absent: "bg-red-100 text-red-800 border-red-200",
  incomplete_punch: "bg-amber-100 text-amber-800 border-amber-200",
  missing_selfie: "bg-orange-100 text-orange-800 border-orange-200",
  missing_gps: "bg-blue-100 text-blue-800 border-blue-200",
};

const FLAG_LABELS: Record<string, string> = {
  absent: "Absent",
  incomplete_punch: "Incomplete Punch",
  missing_selfie: "Missing Selfie",
  missing_gps: "Missing GPS",
};

const FlaggedEntriesReview = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<AttendanceFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved");
  const [resolveDialog, setResolveDialog] = useState<{
    open: boolean;
    flag: AttendanceFlag | null;
  }>({ open: false, flag: null });
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("attendance_flags")
        .select(`
          *,
          employee_master!attendance_flags_employee_id_fkey (
            full_name,
            department
          )
        `)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter === "unresolved") {
        query = query.eq("is_resolved", false);
      }

      // Get flags from last 30 days
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      query = query.gte("date", thirtyDaysAgo);

      const { data, error } = await query;

      if (error) throw error;
      setFlags((data as AttendanceFlag[]) || []);
    } catch (error: any) {
      console.error("Error fetching flags:", error);
      toast.error("Failed to load flagged entries");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [filter]);

  const handleResolve = async () => {
    if (!resolveDialog.flag || !user) return;

    setIsResolving(true);
    try {
      // Get current user's employee_id
      const { data: employeeId } = await supabase.rpc("get_employee_id", {
        _user_id: user.id,
      });

      const { error } = await supabase
        .from("attendance_flags")
        .update({
          is_resolved: true,
          resolved_by: employeeId,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes || null,
        })
        .eq("flag_id", resolveDialog.flag.flag_id);

      if (error) throw error;

      toast.success("Flag resolved successfully");
      setResolveDialog({ open: false, flag: null });
      setResolutionNotes("");
      fetchFlags();
    } catch (error: any) {
      console.error("Error resolving flag:", error);
      toast.error(error.message || "Failed to resolve flag");
    } finally {
      setIsResolving(false);
    }
  };

  const groupedFlags = flags.reduce((acc, flag) => {
    const date = flag.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(flag);
    return acc;
  }, {} as Record<string, AttendanceFlag[]>);

  const unresolvedCount = flags.filter((f) => !f.is_resolved).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-lg">Flagged Entries</h3>
          {unresolvedCount > 0 && (
            <Badge variant="destructive">{unresolvedCount} pending</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "unresolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unresolved")}
          >
            <Filter className="h-4 w-4 mr-1" />
            Unresolved
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {flags.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
            <p className="text-muted-foreground">
              {filter === "unresolved"
                ? "No unresolved flags. Great work!"
                : "No flagged entries in the last 30 days."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Flags by Date */}
      {Object.entries(groupedFlags).map(([date, dateFlags]) => (
        <Card key={date}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {format(new Date(date), "EEEE, dd MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dateFlags.map((flag) => (
              <div
                key={flag.flag_id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  flag.is_resolved ? "bg-muted/50 opacity-60" : "bg-background"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      FLAG_COLORS[flag.flag_type] || "bg-gray-100"
                    }`}
                  >
                    {FLAG_ICONS[flag.flag_type] || (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {flag.employee_master?.full_name || "Unknown Employee"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={FLAG_COLORS[flag.flag_type]}
                      >
                        {FLAG_LABELS[flag.flag_type] || flag.flag_type}
                      </Badge>
                      <span>{flag.employee_master?.department}</span>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {flag.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {flag.is_resolved ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResolveDialog({ open: true, flag });
                        setResolutionNotes("");
                      }}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Resolve Dialog */}
      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) => {
          if (!open) setResolveDialog({ open: false, flag: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>
              {resolveDialog.flag?.employee_master?.full_name} -{" "}
              {FLAG_LABELS[resolveDialog.flag?.flag_type || ""] ||
                resolveDialog.flag?.flag_type}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {resolveDialog.flag?.description}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                Resolution Notes (optional)
              </label>
              <Textarea
                placeholder="Add notes about how this was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialog({ open: false, flag: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={isResolving}>
              {isResolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlaggedEntriesReview;
