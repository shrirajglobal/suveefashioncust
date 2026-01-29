import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

export type DateRangeType = "today" | "yesterday" | "custom" | "7d" | "30d" | "quarter" | "1y" | "month";

interface DateRangeFilterProps {
  value: DateRangeType;
  onChange: (value: DateRangeType) => void;
  customDate?: Date;
  onCustomDateChange?: (date: Date | undefined) => void;
  showDayFilters?: boolean; // Show Today/Yesterday/Custom options
}

export function getDateRangeLabel(range: DateRangeType, customDate?: Date): string {
  switch (range) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "custom":
      return customDate ? format(customDate, "dd MMM yyyy") : "Custom Date";
    case "7d":
      return "Last 7 Days";
    case "30d":
      return "Last 30 Days";
    case "quarter":
      return "This Quarter";
    case "1y":
      return "Last 1 Year";
    case "month":
      return "This Month";
  }
}

import { getCurrentFiscalQuarterRange, getCurrentFinancialYearRange } from "@/lib/financialYear";

// Re-export for backward compatibility
export const getCurrentQuarterRange = getCurrentFiscalQuarterRange;

export function getDateRange(rangeType: DateRangeType, customDate?: Date): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (rangeType) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end };
    }
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start, end: yesterdayEnd };
    }
    case "custom": {
      if (customDate) {
        const start = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 0, 0, 0, 0);
        const customEnd = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999);
        return { start, end: customEnd };
      }
      // Fallback to today if no custom date
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "quarter": {
      // Indian fiscal quarter (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar)
      return getCurrentFiscalQuarterRange();
    }
    case "1y": {
      // Use Indian Financial Year (April to March)
      return getCurrentFinancialYearRange();
    }
    case "month":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end: monthEnd };
    }
  }
}

export function DateRangeFilter({ value, onChange, customDate, onCustomDateChange, showDayFilters = false }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dayOptions: { value: DateRangeType; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
  ];

  const periodOptions: { value: DateRangeType; label: string }[] = [
    { value: "month", label: "This Month" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "quarter", label: "Quarter" },
    { value: "1y", label: "1Y" },
  ];

  const options = showDayFilters ? dayOptions : periodOptions;

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-8 px-3 text-sm font-medium transition-all",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background"
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
      
      {/* Date Picker for custom date - only show when showDayFilters is true */}
      {showDayFilters && onCustomDateChange && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={value === "custom" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-3 text-sm font-medium transition-all gap-1",
                value === "custom"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              )}
            >
              <CalendarIcon className="h-4 w-4" />
              {value === "custom" && customDate ? format(customDate, "dd MMM") : "Pick"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background border shadow-md z-50" align="end">
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={(date) => {
                if (date) {
                  onCustomDateChange(date);
                  onChange("custom");
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
