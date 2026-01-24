export interface Customer {
  id: string;
  name: string;
  address: string;
  city: string;
  mobileNo: string;
  createdAt: Date;
  assignedTo?: string | null;
  assignedToName?: string | null;
}

export interface Purchase {
  id: string;
  customerId: string;
  amount: number;
  date: Date;
  description?: string;
}

export interface CustomerWithPurchases extends Customer {
  purchases: Purchase[];
  totalPurchaseAmount: number;
  lastPurchaseDate: Date | null;
  daysSinceLastPurchase: number | null;
}

export type SegmentPeriod = 
  | "7d"
  | "15d"
  | "30d"
  | "3m"
  | "6m"
  | "12m"
  | "over";

export interface Segment {
  id: SegmentPeriod;
  label: string;
  description: string;
  minDays: number;
  maxDays: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export const SEGMENTS: Segment[] = [
  {
    id: "7d",
    label: "Last 7 Days",
    description: "Active customers",
    minDays: 0,
    maxDays: 7,
    colorClass: "text-segment-7d",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/30",
  },
  {
    id: "15d",
    label: "8-15 Days",
    description: "Recently inactive",
    minDays: 8,
    maxDays: 15,
    colorClass: "text-segment-15d",
    bgClass: "bg-urgent/10",
    borderClass: "border-urgent/30",
  },
  {
    id: "30d",
    label: "16-30 Days",
    description: "Need follow-up",
    minDays: 16,
    maxDays: 30,
    colorClass: "text-segment-30d",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/30",
  },
  {
    id: "3m",
    label: "1-3 Months",
    description: "At risk",
    minDays: 31,
    maxDays: 90,
    colorClass: "text-segment-3m",
    bgClass: "bg-yellow-100",
    borderClass: "border-yellow-300",
  },
  {
    id: "6m",
    label: "3-6 Months",
    description: "Dormant",
    minDays: 91,
    maxDays: 180,
    colorClass: "text-segment-6m",
    bgClass: "bg-accent/10",
    borderClass: "border-accent/30",
  },
  {
    id: "12m",
    label: "6-12 Months",
    description: "Long inactive",
    minDays: 181,
    maxDays: 365,
    colorClass: "text-segment-12m",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
  },
  {
    id: "over",
    label: "Over 1 Year",
    description: "Lost customers",
    minDays: 366,
    maxDays: Infinity,
    colorClass: "text-segment-over",
    bgClass: "bg-muted",
    borderClass: "border-muted-foreground/30",
  },
];
