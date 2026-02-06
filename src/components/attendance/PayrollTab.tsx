import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Play, Loader2, Download, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { formatINR } from "@/lib/formatters";

interface PayrollRecord {
  payroll_id: string;
  employee_id: string;
  employee_name: string;
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
}

const PayrollTab = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const lastMonth = subMonths(new Date(), 1);
    return format(lastMonth, "yyyy-MM");
  });

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  const fetchPayrolls = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("monthly_payroll")
      .select(`
        *,
        employee_master!inner(full_name)
      `)
      .eq("month_year", selectedMonth)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payrolls:", error);
      setIsLoading(false);
      return;
    }

    const mapped: PayrollRecord[] = (data || []).map((p: any) => ({
      payroll_id: p.payroll_id,
      employee_id: p.employee_id,
      employee_name: p.employee_master.full_name,
      month_year: p.month_year,
      days_present: p.days_present,
      total_working_days: p.total_working_days,
      absent_days: p.absent_days,
      overtime_hours: p.overtime_hours,
      gross_salary: p.gross_salary,
      total_deductions: p.total_deductions,
      net_salary: p.net_salary,
      payment_status: p.payment_status,
      payslip_url: p.payslip_url,
    }));

    setPayrolls(mapped);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPayrolls();
  }, [selectedMonth]);

  const handleGeneratePayroll = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-payroll", {
        body: { month_year: selectedMonth },
      });

      if (error) throw error;

      toast.success(`Payroll generated: ${data.processed} employees processed, ${data.skipped} skipped`);
      await fetchPayrolls();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payroll");
    } finally {
      setIsGenerating(false);
    }
  };

  const totalPending = payrolls.filter((p) => p.payment_status === "pending").length;
  const totalNetSalary = payrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleGeneratePayroll} disabled={isGenerating} className="gap-2">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Generate Payroll
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xl font-bold">{formatINR(totalNetSalary)}</p>
                <p className="text-xs text-muted-foreground">Total Net Salary</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-xl font-bold">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending Payments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      {payrolls.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No payroll records for this month. Click "Generate Payroll" to create them.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payroll Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((payroll) => (
                  <TableRow key={payroll.payroll_id}>
                    <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                    <TableCell className="text-center">
                      {payroll.days_present}/{payroll.total_working_days}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(payroll.net_salary || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={payroll.payment_status === "paid" ? "default" : "secondary"}
                      >
                        {payroll.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payroll.payslip_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={payroll.payslip_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayrollTab;
