import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getFinancialYear, formatFYLabel } from "@/lib/financialYear";
import { getSafeErrorMessage, logError } from "@/lib/errorHandler";

interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  financial_year: string;
}

export function HolidaysSettings() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [holidayName, setHolidayName] = useState("");
  const [selectedFY, setSelectedFY] = useState<string>(() => {
    const currentFY = getFinancialYear(new Date());
    return `${currentFY}-${(currentFY + 1).toString().slice(-2)}`;
  });

  // Generate FY options (current FY + 2 previous + 2 future)
  const currentFYStart = getFinancialYear(new Date());
  const fyOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentFYStart - 2 + i;
    return `${year}-${(year + 1).toString().slice(-2)}`;
  });

  useEffect(() => {
    fetchHolidays();
  }, [selectedFY]);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("paid_holidays")
        .select("*")
        .eq("financial_year", selectedFY)
        .order("holiday_date", { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      logError("fetchHolidays", error);
      toast.error("Failed to load holidays");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!selectedDate || !holidayName.trim()) {
      toast.error("Please select a date and enter holiday name");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("paid_holidays").insert({
        holiday_date: format(selectedDate, "yyyy-MM-dd"),
        holiday_name: holidayName.trim(),
        financial_year: selectedFY,
      });

      if (error) throw error;

      toast.success("Holiday added successfully");
      setSelectedDate(undefined);
      setHolidayName("");
      fetchHolidays();
    } catch (error) {
      logError("handleAddHoliday", error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase.from("paid_holidays").delete().eq("id", id);
      if (error) throw error;
      toast.success("Holiday deleted");
      fetchHolidays();
    } catch (error) {
      logError("handleDeleteHoliday", error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      {/* FY Selector */}
      <div className="flex items-center gap-4">
        <Label>Financial Year:</Label>
        <Select value={selectedFY} onValueChange={setSelectedFY}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fyOptions.map((fy) => (
              <SelectItem key={fy} value={fy}>
                FY {fy}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add Holiday Form */}
      <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
        <h4 className="font-medium">Add New Holiday</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Holiday Name</Label>
            <Input
              placeholder="e.g., Diwali, Republic Day"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button onClick={handleAddHoliday} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Holiday
            </Button>
          </div>
        </div>
      </div>

      {/* Holidays List */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Holiday Name</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No holidays added for FY {selectedFY}
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>{format(new Date(holiday.holiday_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{holiday.holiday_name}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Holiday?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{holiday.holiday_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteHoliday(holiday.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} configured for FY {selectedFY}
      </p>
    </div>
  );
}
