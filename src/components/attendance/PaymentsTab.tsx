import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, IndianRupee, CreditCard, Banknote, Wallet, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { formatINR } from "@/lib/formatters";
import { z } from "zod";

// Validation schema
const paymentSchema = z.object({
  payrollId: z.string().min(1, "Please select a payroll record"),
  amount: z.number().positive("Amount must be greater than 0").max(10000000, "Amount exceeds maximum limit"),
  paymentMode: z.enum(["UPI", "Bank", "Cash"], { required_error: "Please select payment mode" }),
  transactionRef: z.string().max(100, "Reference must be less than 100 characters").optional(),
});

interface Employee {
  employee_id: string;
  full_name: string;
}

interface PendingPayroll {
  payroll_id: string;
  employee_id: string;
  employee_name: string;
  net_salary: number;
  month_year: string;
}

interface Payment {
  payment_id: string;
  employee_name: string;
  amount_paid: number;
  payment_mode: "UPI" | "Bank" | "Cash";
  payment_date: string;
  transaction_reference: string | null;
  month_year: string;
}

const PaymentsTab = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingPayrolls, setPendingPayrolls] = useState<PendingPayroll[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Bank" | "Cash">("UPI");
  const [transactionRef, setTransactionRef] = useState("");

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return {
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy"),
      };
    }), []
  );

  // Filter payrolls by selected employee and month
  const filteredPayrolls = useMemo(() => {
    return pendingPayrolls.filter(p => {
      if (selectedEmployee && p.employee_id !== selectedEmployee) return false;
      if (selectedMonth && p.month_year !== selectedMonth) return false;
      return true;
    });
  }, [pendingPayrolls, selectedEmployee, selectedMonth]);

  // Get the selected payroll record
  const selectedPayroll = useMemo(() => {
    if (selectedEmployee && selectedMonth) {
      return filteredPayrolls.find(
        p => p.employee_id === selectedEmployee && p.month_year === selectedMonth
      );
    }
    return null;
  }, [filteredPayrolls, selectedEmployee, selectedMonth]);

  // Auto-fill amount when payroll is selected
  useEffect(() => {
    if (selectedPayroll) {
      setAmountPaid(selectedPayroll.net_salary.toString());
    } else {
      setAmountPaid("");
    }
  }, [selectedPayroll]);

  const fetchData = async () => {
    setIsLoading(true);

    // Fetch employees
    const { data: empData } = await supabase
      .from("employee_master")
      .select("employee_id, full_name")
      .eq("status", "active")
      .order("full_name");

    setEmployees(empData || []);

    // Fetch pending payrolls
    const { data: payrolls } = await supabase
      .from("monthly_payroll")
      .select(`
        payroll_id,
        employee_id,
        net_salary,
        month_year,
        employee_master!inner(full_name)
      `)
      .eq("payment_status", "pending")
      .not("net_salary", "is", null);

    const pending: PendingPayroll[] = (payrolls || []).map((p: any) => ({
      payroll_id: p.payroll_id,
      employee_id: p.employee_id,
      employee_name: p.employee_master.full_name,
      net_salary: p.net_salary,
      month_year: p.month_year,
    }));
    setPendingPayrolls(pending);

    // Fetch recent payments
    const { data: payments } = await supabase
      .from("staff_payments")
      .select(`
        payment_id,
        amount_paid,
        payment_mode,
        payment_date,
        transaction_reference,
        employee_master!inner(full_name),
        monthly_payroll!inner(month_year)
      `)
      .order("payment_date", { ascending: false })
      .limit(20);

    const recent: Payment[] = (payments || []).map((p: any) => ({
      payment_id: p.payment_id,
      employee_name: p.employee_master.full_name,
      amount_paid: p.amount_paid,
      payment_mode: p.payment_mode,
      payment_date: p.payment_date,
      transaction_reference: p.transaction_reference,
      month_year: p.monthly_payroll.month_year,
    }));
    setRecentPayments(recent);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedMonth("");
    setAmountPaid("");
    setPaymentMode("UPI");
    setTransactionRef("");
    setErrors({});
  };

  const handleRecordPayment = async () => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    if (!selectedPayroll) {
      setErrors({ payrollId: "Please select an employee and month with pending payroll" });
      return;
    }

    // Validate input
    const result = paymentSchema.safeParse({
      payrollId: selectedPayroll.payroll_id,
      amount: parseFloat(amountPaid) || 0,
      paymentMode,
      transactionRef: transactionRef.trim() || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsRecording(true);

    try {
      // Insert payment record
      const { error: paymentError } = await supabase.from("staff_payments").insert({
        payroll_id: selectedPayroll.payroll_id,
        employee_id: selectedPayroll.employee_id,
        amount_paid: result.data.amount,
        payment_mode: result.data.paymentMode,
        transaction_reference: result.data.transactionRef || null,
        recorded_by: user.id,
      });

      if (paymentError) throw paymentError;

      // Update payroll status to paid
      const { error: updateError } = await supabase
        .from("monthly_payroll")
        .update({ payment_status: "paid" })
        .eq("payroll_id", selectedPayroll.payroll_id);

      if (updateError) throw updateError;

      toast.success(`Payment of ${formatINR(result.data.amount)} recorded for ${selectedPayroll.employee_name}`);
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
    } finally {
      setIsRecording(false);
    }
  };

  const getModeIcon = (mode: "UPI" | "Bank" | "Cash") => {
    switch (mode) {
      case "UPI":
        return <CreditCard className="h-4 w-4" />;
      case "Bank":
        return <Banknote className="h-4 w-4" />;
      case "Cash":
        return <Wallet className="h-4 w-4" />;
    }
  };

  // Get available months for selected employee
  const availableMonths = useMemo(() => {
    if (!selectedEmployee) return monthOptions;
    const employeePayrolls = pendingPayrolls.filter(p => p.employee_id === selectedEmployee);
    const employeeMonths = new Set(employeePayrolls.map(p => p.month_year));
    return monthOptions.filter(m => employeeMonths.has(m.value));
  }, [selectedEmployee, pendingPayrolls, monthOptions]);

  // Get employees with pending payrolls
  const employeesWithPending = useMemo(() => {
    const empIds = new Set(pendingPayrolls.map(p => p.employee_id));
    return employees.filter(e => empIds.has(e.employee_id));
  }, [employees, pendingPayrolls]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalPending = pendingPayrolls.reduce((sum, p) => sum + p.net_salary, 0);

  return (
    <div className="space-y-4">
      {/* Summary & Action */}
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                  {formatINR(totalPending)}
                </p>
                <p className="text-xs text-amber-600">
                  {pendingPayrolls.length} pending payments
                </p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" disabled={pendingPayrolls.length === 0}>
                  <Plus className="h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Record Salary Payment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Employee Selection */}
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={selectedEmployee} onValueChange={(v) => {
                      setSelectedEmployee(v);
                      setSelectedMonth("");
                      setErrors({});
                    }}>
                      <SelectTrigger className={errors.payrollId ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesWithPending.map((emp) => (
                          <SelectItem key={emp.employee_id} value={emp.employee_id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Month Selection */}
                  <div className="space-y-2">
                    <Label>Payroll Month</Label>
                    <Select 
                      value={selectedMonth} 
                      onValueChange={setSelectedMonth}
                      disabled={!selectedEmployee}
                    >
                      <SelectTrigger className={errors.payrollId ? "border-destructive" : ""}>
                        <SelectValue placeholder={selectedEmployee ? "Select month" : "Select employee first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMonths.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.payrollId && (
                      <p className="text-sm text-destructive">{errors.payrollId}</p>
                    )}
                  </div>

                  {/* Salary Info */}
                  {selectedPayroll && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Net Salary Due</span>
                        <span className="font-semibold text-primary">
                          {formatINR(selectedPayroll.net_salary)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label>Amount Paid (₹)</Label>
                    <Input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder="Enter amount"
                      className={errors.amount ? "border-destructive" : ""}
                      disabled={!selectedPayroll}
                    />
                    {errors.amount && (
                      <p className="text-sm text-destructive">{errors.amount}</p>
                    )}
                  </div>

                  {/* Payment Mode */}
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["UPI", "Bank", "Cash"] as const).map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={paymentMode === mode ? "default" : "outline"}
                          className="gap-2"
                          onClick={() => setPaymentMode(mode)}
                        >
                          {getModeIcon(mode)}
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Transaction Reference */}
                  <div className="space-y-2">
                    <Label>Transaction Reference</Label>
                    <Input
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="UTR, Cheque No., Receipt No."
                      maxLength={100}
                      className={errors.transactionRef ? "border-destructive" : ""}
                    />
                    {errors.transactionRef && (
                      <p className="text-sm text-destructive">{errors.transactionRef}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Optional for UPI/Bank transfers</p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleRecordPayment}
                    disabled={isRecording || !selectedPayroll}
                    className="w-full gap-2"
                  >
                    {isRecording ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Mark as Paid
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Pending Payments List */}
      {pendingPayrolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Amount Due</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayrolls.slice(0, 10).map((payroll) => (
                  <TableRow key={payroll.payroll_id}>
                    <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(payroll.month_year + "-01"), "MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(payroll.net_salary)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEmployee(payroll.employee_id);
                          setSelectedMonth(payroll.month_year);
                          setDialogOpen(true);
                        }}
                      >
                        Pay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pendingPayrolls.length > 10 && (
              <p className="text-center text-sm text-muted-foreground py-2 border-t">
                +{pendingPayrolls.length - 10} more pending
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {recentPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((payment) => (
                  <TableRow key={payment.payment_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{payment.employee_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.month_year + "-01"), "MMM yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(payment.amount_paid)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        {getModeIcon(payment.payment_mode)}
                        {payment.payment_mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.transaction_reference || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(payment.payment_date), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsTab;
