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
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Play,
  Loader2,
  Download,
  IndianRupee,
  Lock,
  FileText,
  Users,
  AlertTriangle,
} from "lucide-react";
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
  is_locked: boolean;
}

const PayrollTab = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isGeneratingPayslips, setIsGeneratingPayslips] = useState(false);
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
      .select(
        `
        *,
        employee_master!inner(full_name)
      `
      )
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
      is_locked: p.is_locked,
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
      const { data, error } = await supabase.functions.invoke(
        "generate-monthly-payroll",
        {
          body: { month_year: selectedMonth },
        }
      );

      if (error) throw error;

      toast.success(
        `Payroll generated: ${data.processed} employees processed, ${data.skipped} skipped`
      );
      await fetchPayrolls();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payroll");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLockPayroll = async () => {
    setIsLocking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payrollIds = payrolls.map((p) => p.payroll_id);

      const { error } = await supabase
        .from("monthly_payroll")
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: user.id,
        })
        .in("payroll_id", payrollIds);

      if (error) throw error;

      toast.success("Payroll locked successfully");
      await fetchPayrolls();
    } catch (error: any) {
      toast.error(error.message || "Failed to lock payroll");
    } finally {
      setIsLocking(false);
    }
  };

  const handleGeneratePayslips = async () => {
    setIsGeneratingPayslips(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-payslip",
        {
          body: { month_year: selectedMonth },
        }
      );

      if (error) throw error;

      toast.success(
        `Payslips generated: ${data.generated || 0} payslips created`
      );
      await fetchPayrolls();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payslips");
    } finally {
      setIsGeneratingPayslips(false);
    }
  };

  const isLocked = payrolls.length > 0 && payrolls.every((p) => p.is_locked);
  const totalPending = payrolls.filter(
    (p) => p.payment_status === "pending"
  ).length;
  const totalNetSalary = payrolls.reduce(
    (sum, p) => sum + (p.net_salary || 0),
    0
  );
  const totalGrossSalary = payrolls.reduce(
    (sum, p) => sum + (p.gross_salary || 0),
    0
  );
  const totalDeductions = payrolls.reduce(
    (sum, p) => sum + (p.total_deductions || 0),
    0
  );

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

        <div className="flex flex-wrap gap-2">
          {/* Generate Payroll */}
          <Button
            onClick={handleGeneratePayroll}
            disabled={isGenerating || isLocked}
            variant="outline"
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Generate Payroll
          </Button>

          {/* Lock Payroll */}
          {payrolls.length > 0 && !isLocked && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={isLocking}>
                  {isLocking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Lock Payroll
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Lock Payroll?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Once locked, payroll records for{" "}
                    <strong>{format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</strong>{" "}
                    cannot be edited or regenerated. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLockPayroll}>
                    Lock Payroll
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Generate Payslips */}
          {payrolls.length > 0 && (
            <Button
              onClick={handleGeneratePayslips}
              disabled={isGeneratingPayslips}
              className="gap-2"
            >
              {isGeneratingPayslips ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Payslips
            </Button>
          )}
        </div>
      </div>

      {/* Locked Banner */}
      {isLocked && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Lock className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700">
            Payroll for this month is locked and cannot be edited.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xl font-bold">{payrolls.length}</p>
                <p className="text-xs text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold">{formatINR(totalGrossSalary)}</p>
                <p className="text-xs text-muted-foreground">Gross Salary</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-4">
            <div>
              <p className="text-lg font-bold text-destructive">
                {formatINR(totalDeductions)}
              </p>
              <p className="text-xs text-muted-foreground">Total Deductions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold text-primary">
                  {formatINR(totalNetSalary)}
                </p>
                <p className="text-xs text-muted-foreground">Net Salary</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      {payrolls.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No payroll records for this month. Click "Generate Payroll" to create
            them.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Payroll Records</CardTitle>
            <Badge variant="secondary">{totalPending} pending</Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Days Present</TableHead>
                  <TableHead className="text-center">OT Hours</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Payslip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((payroll) => (
                  <TableRow key={payroll.payroll_id}>
                    <TableCell className="font-medium">
                      {payroll.employee_name}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          payroll.days_present < payroll.total_working_days
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }
                      >
                        {payroll.days_present}
                      </span>
                      <span className="text-muted-foreground">
                        /{payroll.total_working_days}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {payroll.overtime_hours > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {payroll.overtime_hours}h
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatINR(payroll.gross_salary || 0)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-destructive">
                      {payroll.total_deductions && payroll.total_deductions > 0
                        ? `-${formatINR(payroll.total_deductions)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(payroll.net_salary || 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          payroll.payment_status === "paid"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {payroll.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {payroll.payslip_url ? (
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={payroll.payslip_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
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
