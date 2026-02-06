import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, IndianRupee, Calendar, Clock, Briefcase, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { formatINR } from "@/lib/formatters";

interface Payslip {
  payroll_id: string;
  month_year: string;
  days_present: number;
  total_working_days: number;
  absent_days: number;
  overtime_hours: number;
  gross_salary: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  payment_status: "pending" | "paid";
  payslip_url: string | null;
  per_day_rate: number;
  overtime_rate: number;
}

const PayslipsTab = () => {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Get employee ID for current user
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

  // Fetch payslips
  useEffect(() => {
    const fetchPayslips = async () => {
      if (!employeeId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("monthly_payroll")
        .select("*")
        .eq("employee_id", employeeId)
        .order("month_year", { ascending: false });

      if (!error && data) {
        setPayslips(data);
        // Auto-select most recent month if available
        if (data.length > 0) {
          setSelectedMonth(data[0].month_year);
        }
      }
      setIsLoading(false);
    };

    fetchPayslips();
  }, [employeeId]);

  // Generate month options from available payslips
  const monthOptions = useMemo(() => {
    return payslips.map((p) => ({
      value: p.month_year,
      label: formatMonthYear(p.month_year),
    }));
  }, [payslips]);

  // Get selected payslip
  const selectedPayslip = useMemo(() => {
    if (selectedMonth === "all") return null;
    return payslips.find((p) => p.month_year === selectedMonth) || null;
  }, [payslips, selectedMonth]);

  function formatMonthYear(monthYear: string) {
    const [year, month] = monthYear.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy");
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!employeeId) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Your account is not linked to an employee record. Contact admin.
        </CardContent>
      </Card>
    );
  }

  if (payslips.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No payslips available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payslips</SelectItem>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Payslip Detail View */}
      {selectedPayslip ? (
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary/5 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {formatMonthYear(selectedPayslip.month_year)}
                </CardTitle>
                <CardDescription>Salary Statement</CardDescription>
              </div>
              <Badge
                variant={selectedPayslip.payment_status === "paid" ? "default" : "secondary"}
                className={selectedPayslip.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
              >
                {selectedPayslip.payment_status === "paid" ? "✓ Paid" : "Pending"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Attendance Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Briefcase className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold text-primary">
                  {selectedPayslip.days_present}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {selectedPayslip.total_working_days} days
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold text-destructive">
                  {selectedPayslip.absent_days}
                </p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">
                  {selectedPayslip.overtime_hours}h
                </p>
                <p className="text-xs text-muted-foreground">Overtime</p>
              </div>
            </div>

            {/* Salary Breakdown */}
            <div className="space-y-3 border rounded-lg p-4">
              <h4 className="font-medium text-sm text-muted-foreground mb-3">Salary Breakdown</h4>

              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm">Gross Salary</span>
                <span className="font-medium">{formatINR(selectedPayslip.gross_salary || 0)}</span>
              </div>

              {selectedPayslip.overtime_hours > 0 && (
                <div className="flex justify-between items-center py-2 border-b text-emerald-600">
                  <span className="text-sm">
                    Overtime ({selectedPayslip.overtime_hours}h × {formatINR(selectedPayslip.overtime_rate)})
                  </span>
                  <span className="font-medium">
                    +{formatINR(selectedPayslip.overtime_hours * selectedPayslip.overtime_rate)}
                  </span>
                </div>
              )}

              {(selectedPayslip.total_deductions || 0) > 0 && (
                <div className="flex justify-between items-center py-2 border-b text-destructive">
                  <span className="text-sm">Deductions</span>
                  <span className="font-medium">
                    -{formatINR(selectedPayslip.total_deductions || 0)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3">
                <span className="font-semibold">Net Salary</span>
                <span className="text-xl font-bold text-primary flex items-center gap-1">
                  <IndianRupee className="h-5 w-5" />
                  {formatINR(selectedPayslip.net_salary || 0).replace("₹", "")}
                </span>
              </div>
            </div>

            {/* Download Button */}
            <div className="mt-6">
              {selectedPayslip.payslip_url ? (
                <Button className="w-full gap-2" asChild>
                  <a href={selectedPayslip.payslip_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Download Payslip (PDF)
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  <FileText className="h-4 w-4 mr-2" />
                  Payslip Not Generated Yet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        // All Payslips List View
        <div className="space-y-3">
          {payslips.map((payslip) => (
            <Card
              key={payslip.payroll_id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedMonth(payslip.month_year)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{formatMonthYear(payslip.month_year)}</p>
                      <p className="text-sm text-muted-foreground">
                        {payslip.days_present}/{payslip.total_working_days} days
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatINR(payslip.net_salary || 0)}</p>
                    <Badge
                      variant={payslip.payment_status === "paid" ? "default" : "outline"}
                      className={payslip.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
                    >
                      {payslip.payment_status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayslipsTab;
