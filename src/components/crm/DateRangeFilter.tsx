import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DateRangeType = "7d" | "30d" | "quarter" | "1y" | "month";

interface DateRangeFilterProps {
  value: DateRangeType;
  onChange: (value: DateRangeType) => void;
}

export function getDateRangeLabel(range: DateRangeType): string {
  switch (range) {
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

// Get the current Indian fiscal quarter (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar)
export function getCurrentQuarterRange(): { start: Date; end: Date } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  let quarterStart: Date;
  let quarterEnd: Date;

  if (month >= 3 && month <= 5) {
    // Q1: April - June
    quarterStart = new Date(year, 3, 1);
    quarterEnd = new Date(year, 5, 30, 23, 59, 59, 999);
  } else if (month >= 6 && month <= 8) {
    // Q2: July - September
    quarterStart = new Date(year, 6, 1);
    quarterEnd = new Date(year, 8, 30, 23, 59, 59, 999);
  } else if (month >= 9 && month <= 11) {
    // Q3: October - December
    quarterStart = new Date(year, 9, 1);
    quarterEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    // Q4: January - March
    quarterStart = new Date(year, 0, 1);
    quarterEnd = new Date(year, 2, 31, 23, 59, 59, 999);
  }

  return { start: quarterStart, end: quarterEnd };
}

export function getDateRange(rangeType: DateRangeType): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (rangeType) {
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
      return getCurrentQuarterRange();
    }
    case "1y": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end: monthEnd };
    }
  }
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const options: { value: DateRangeType; label: string }[] = [
    { value: "month", label: "This Month" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "quarter", label: "Quarter" },
    { value: "1y", label: "1Y" },
  ];

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
    </div>
  );
}
