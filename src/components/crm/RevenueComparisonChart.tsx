import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/formatters";
import { getFinancialYear, getFYMonthIndex, formatFYLabel, FY_MONTHS } from "@/lib/financialYear";
import { Purchase } from "@/types/crm";

interface SalesTeamMember {
  id: string;
  name: string;
}

interface RevenueComparisonChartProps {
  purchases: Purchase[];
  filteredCustomerIds: Set<string>;
  selectedSalesman: string;
  salesmanName?: string;
  salesTeamMembers: SalesTeamMember[];
  customerAssignments: Map<string, string>; // customerId -> assignedTo (userId)
}

type ChartType = "yearly-comparison" | "salesmen-comparison";

// Financial year utilities are now imported from @/lib/financialYear

export const RevenueComparisonChart = ({
  purchases,
  filteredCustomerIds,
  selectedSalesman,
  salesmanName,
  salesTeamMembers,
  customerAssignments,
}: RevenueComparisonChartProps) => {
  const [chartType, setChartType] = useState<ChartType>("yearly-comparison");

  // Get current and previous financial year
  const { currentFY, previousFY } = useMemo(() => {
    const now = new Date();
    const currentFY = getFinancialYear(now);
    return { currentFY, previousFY: currentFY - 1 };
  }, []);

  // Yearly comparison chart data (current FY vs previous FY)
  const yearlyChartData = useMemo(() => {
    // Filter purchases by salesman if selected
    const relevantPurchases = selectedSalesman === "all" 
      ? purchases 
      : purchases.filter((p) => filteredCustomerIds.has(p.customerId));

    // Initialize monthly data for FY months
    const monthlyData = FY_MONTHS.map((month, index) => ({
      month,
      monthIndex: index,
      currentYear: 0,
      previousYear: 0,
    }));

    // Aggregate revenue by FY month and year
    relevantPurchases.forEach((purchase) => {
      const purchaseDate = new Date(purchase.date);
      const fy = getFinancialYear(purchaseDate);
      const fyMonthIndex = getFYMonthIndex(purchaseDate);

      if (fy === currentFY) {
        monthlyData[fyMonthIndex].currentYear += purchase.amount;
      } else if (fy === previousFY) {
        monthlyData[fyMonthIndex].previousYear += purchase.amount;
      }
    });

    return monthlyData;
  }, [purchases, filteredCustomerIds, selectedSalesman, currentFY, previousFY]);

  // Salesmen comparison chart data
  const salesmenChartData = useMemo(() => {
    // Get revenue per salesman for current FY
    const salesmenRevenue: Record<string, { currentYear: number; previousYear: number }> = {};

    // Initialize for all salesmen
    salesTeamMembers.forEach((member) => {
      salesmenRevenue[member.id] = { currentYear: 0, previousYear: 0 };
    });

    // Aggregate revenue by salesman
    purchases.forEach((purchase) => {
      const assignedTo = customerAssignments.get(purchase.customerId);
      if (!assignedTo || !salesmenRevenue[assignedTo]) return;

      const purchaseDate = new Date(purchase.date);
      const fy = getFinancialYear(purchaseDate);

      if (fy === currentFY) {
        salesmenRevenue[assignedTo].currentYear += purchase.amount;
      } else if (fy === previousFY) {
        salesmenRevenue[assignedTo].previousYear += purchase.amount;
      }
    });

    // Convert to chart data
    return salesTeamMembers.map((member) => ({
      name: member.name.split("@")[0], // Show name before @ if email
      fullName: member.name,
      currentYear: salesmenRevenue[member.id]?.currentYear || 0,
      previousYear: salesmenRevenue[member.id]?.previousYear || 0,
    }));
  }, [purchases, salesTeamMembers, customerAssignments, currentFY, previousFY]);

  // Calculate totals based on chart type
  const totals = useMemo(() => {
    const data = chartType === "yearly-comparison" ? yearlyChartData : salesmenChartData;
    const currentYearTotal = data.reduce((sum, d) => sum + d.currentYear, 0);
    const previousYearTotal = data.reduce((sum, d) => sum + d.previousYear, 0);
    const growth = previousYearTotal > 0 
      ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100 
      : 0;
    
    return { currentYearTotal, previousYearTotal, growth };
  }, [chartType, yearlyChartData, salesmenChartData]);

  const filterLabel = selectedSalesman === "all" 
    ? "All Salesmen" 
    : salesmanName || "Selected Salesman";

  const chartData = chartType === "yearly-comparison" ? yearlyChartData : salesmenChartData;
  const xAxisKey = chartType === "yearly-comparison" ? "month" : "name";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Revenue Comparison</CardTitle>
            <CardDescription className="flex flex-col gap-1 mt-1">
              <span>
                {chartType === "yearly-comparison" 
                  ? `Monthly revenue: ${formatFYLabel(currentFY)} vs ${formatFYLabel(previousFY)}`
                  : `Salesmen performance: ${formatFYLabel(currentFY)} vs ${formatFYLabel(previousFY)}`
                }
                {chartType === "yearly-comparison" && selectedSalesman !== "all" && (
                  <span className="ml-1">• {filterLabel}</span>
                )}
              </span>
              <span className="text-xs">
                Total {formatFYLabel(currentFY)}: {formatINR(totals.currentYearTotal)} | 
                Total {formatFYLabel(previousFY)}: {formatINR(totals.previousYearTotal)}
                {totals.previousYearTotal > 0 && (
                  <span className={totals.growth >= 0 ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                    ({totals.growth >= 0 ? "+" : ""}{totals.growth.toFixed(1)}% YoY)
                  </span>
                )}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="chart-type" className="text-sm whitespace-nowrap">Chart Type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger id="chart-type" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="yearly-comparison">Yearly Performance Comparison</SelectItem>
                <SelectItem value="salesmen-comparison">Salesmen Wise Comparison</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={xAxisKey}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={chartType === "salesmen-comparison" ? -20 : 0}
                textAnchor={chartType === "salesmen-comparison" ? "end" : "middle"}
                height={chartType === "salesmen-comparison" ? 60 : 30}
              />
              <YAxis 
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 100000) return `${(value / 100000).toFixed(0)}L`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const displayLabel = chartType === "salesmen-comparison" 
                    ? (payload[0]?.payload?.fullName || label)
                    : label;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium mb-2">{displayLabel}</p>
                      {payload.map((entry, index) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                          {entry.name}: {formatINR(entry.value as number)}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar 
                dataKey="currentYear" 
                name={formatFYLabel(currentFY)}
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="previousYear" 
                name={formatFYLabel(previousFY)}
                fill="hsl(var(--muted-foreground))" 
                radius={[4, 4, 0, 0]}
                opacity={0.6}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
