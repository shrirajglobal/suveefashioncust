import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { getSafeErrorMessage, logError } from "@/lib/errorHandler";
import { Badge } from "@/components/ui/badge";

interface WorkShift {
  id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  is_default: boolean;
}

export function ShiftsSettings() {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Form state
  const [shiftName, setShiftName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("work_shifts")
        .select("*")
        .order("is_default", { ascending: false })
        .order("shift_name", { ascending: true });

      if (error) throw error;
      setShifts(data || []);
    } catch (error) {
      logError("fetchShifts", error);
      toast.error("Failed to load shifts");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setShiftName("");
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakMinutes(60);
    setEditingShift(null);
  };

  const handleAddShift = async () => {
    if (!shiftName.trim()) {
      toast.error("Please enter shift name");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("work_shifts").insert({
        shift_name: shiftName.trim(),
        start_time: startTime,
        end_time: endTime,
        break_duration_minutes: breakMinutes,
        is_default: shifts.length === 0, // First shift is default
      });

      if (error) throw error;

      toast.success("Shift added successfully");
      resetForm();
      fetchShifts();
    } catch (error) {
      logError("handleAddShift", error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (shift: WorkShift) => {
    setEditingShift(shift);
    setShiftName(shift.shift_name);
    setStartTime(shift.start_time.slice(0, 5)); // HH:mm format
    setEndTime(shift.end_time.slice(0, 5));
    setBreakMinutes(shift.break_duration_minutes);
    setIsEditDialogOpen(true);
  };

  const handleUpdateShift = async () => {
    if (!editingShift || !shiftName.trim()) {
      toast.error("Please enter shift name");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("work_shifts")
        .update({
          shift_name: shiftName.trim(),
          start_time: startTime,
          end_time: endTime,
          break_duration_minutes: breakMinutes,
        })
        .eq("id", editingShift.id);

      if (error) throw error;

      toast.success("Shift updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      fetchShifts();
    } catch (error) {
      logError("handleUpdateShift", error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (shiftId: string) => {
    try {
      // First, unset all defaults
      await supabase.from("work_shifts").update({ is_default: false }).neq("id", "");
      
      // Then set the new default
      const { error } = await supabase
        .from("work_shifts")
        .update({ is_default: true })
        .eq("id", shiftId);

      if (error) throw error;
      toast.success("Default shift updated");
      fetchShifts();
    } catch (error) {
      logError("handleSetDefault", error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleDeleteShift = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("Cannot delete the default shift. Set another shift as default first.");
      return;
    }

    try {
      const { error } = await supabase.from("work_shifts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Shift deleted");
      fetchShifts();
    } catch (error) {
      logError("handleDeleteShift", error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const calculateWorkHours = (start: string, end: string, breakMins: number) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMins;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Add Shift Form */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
        <h4 className="font-medium">Add New Shift</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <Label>Shift Name</Label>
            <Input
              placeholder="e.g., Morning Shift"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>End Time</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Break (mins)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={handleAddShift} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Shifts List */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift Name</TableHead>
              <TableHead>Timing</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Work Hours</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : shifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No shifts configured. Add your first shift above.
                </TableCell>
              </TableRow>
            ) : (
              shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {shift.shift_name}
                      {shift.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                  </TableCell>
                  <TableCell>{shift.break_duration_minutes} mins</TableCell>
                  <TableCell>
                    {calculateWorkHours(shift.start_time, shift.end_time, shift.break_duration_minutes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!shift.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetDefault(shift.id)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(shift)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={shift.is_default}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{shift.shift_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteShift(shift.id, shift.is_default)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Break Duration (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateShift} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
