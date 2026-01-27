import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/formatters";
import { Purchase } from "@/types/crm";

interface RevenueComparisonChartProps {
  purchases: Purchase[];
  filteredCustomerIds: Set<string>;
  selectedSalesman: string;
  salesmanName?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const RevenueComparisonChart = ({
  purchases,
  filteredCustomerIds,
  selectedSalesman,
  salesmanName,
}: RevenueComparisonChartProps) => {
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Filter purchases by salesman if selected
    const relevantPurchases = selectedSalesman === "all" 
      ? purchases 
      : purchases.filter((p) => filteredCustomerIds.has(p.customerId));

    // Initialize monthly data
    const monthlyData = MONTHS.map((month, index) => ({
      month,
      monthIndex: index,
      currentYear: 0,
      previousYear: 0,
    }));

    // Aggregate revenue by month and year
    relevantPurchases.forEach((purchase) => {
      const purchaseDate = new Date(purchase.date);
      const year = purchaseDate.getFullYear();
      const monthIndex = purchaseDate.getMonth();

      if (year === currentYear) {
        monthlyData[monthIndex].currentYear += purchase.amount;
      } else if (year === previousYear) {
        monthlyData[monthIndex].previousYear += purchase.amount;
      }
    });

    return monthlyData;
  }, [purchases, filteredCustomerIds, selectedSalesman]);

  // Calculate totals for the description
  const totals = useMemo(() => {
    const currentYearTotal = chartData.reduce((sum, d) => sum + d.currentYear, 0);
    const previousYearTotal = chartData.reduce((sum, d) => sum + d.previousYear, 0);
    const growth = previousYearTotal > 0 
      ? ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100 
      : 0;
    
    return { currentYearTotal, previousYearTotal, growth };
  }, [chartData]);

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const filterLabel = selectedSalesman === "all" 
    ? "All Salesmen" 
    : salesmanName || "Selected Salesman";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Revenue Comparison</span>
          <span className="text-sm font-normal text-muted-foreground">
            {filterLabel}
          </span>
        </CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span>Monthly revenue: {currentYear} vs {previousYear}</span>
          <span className="text-xs">
            Total {currentYear}: {formatINR(totals.currentYearTotal)} | 
            Total {previousYear}: {formatINR(totals.previousYearTotal)}
            {totals.previousYearTotal > 0 && (
              <span className={totals.growth >= 0 ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                ({totals.growth >= 0 ? "+" : ""}{totals.growth.toFixed(1)}% YoY)
              </span>
            )}
          </span>
        </CardDescription>
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
                dataKey="month" 
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
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
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium mb-2">{label}</p>
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
                name={`${currentYear}`}
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="previousYear" 
                name={`${previousYear}`}
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
