import { useEffect, useState } from "react";
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
import { Plus, Loader2, IndianRupee, CreditCard, Banknote, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import { formatINR } from "@/lib/formatters";

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
  const [pendingPayrolls, setPendingPayrolls] = useState<PendingPayroll[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [selectedPayroll, setSelectedPayroll] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Bank" | "Cash">("UPI");
  const [transactionRef, setTransactionRef] = useState("");

  const fetchData = async () => {
    setIsLoading(true);

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

  const handleRecordPayment = async () => {
    if (!selectedPayroll || !user) {
      toast.error("Select a payroll record");
      return;
    }

    const payroll = pendingPayrolls.find((p) => p.payroll_id === selectedPayroll);
    if (!payroll) return;

    setIsRecording(true);
    try {
      // Insert payment record
      const { error: paymentError } = await supabase.from("staff_payments").insert({
        payroll_id: payroll.payroll_id,
        employee_id: payroll.employee_id,
        amount_paid: payroll.net_salary,
        payment_mode: paymentMode,
        transaction_reference: transactionRef || null,
        recorded_by: user.id,
      });

      if (paymentError) throw paymentError;

      // Update payroll status
      const { error: updateError } = await supabase
        .from("monthly_payroll")
        .update({ payment_status: "paid" })
        .eq("payroll_id", payroll.payroll_id);

      if (updateError) throw updateError;

      toast.success(`Payment recorded for ${payroll.employee_name}`);
      setDialogOpen(false);
      setSelectedPayroll("");
      setTransactionRef("");
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Select Employee</Label>
                    <Select value={selectedPayroll} onValueChange={setSelectedPayroll}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pending payroll" />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingPayrolls.map((p) => (
                          <SelectItem key={p.payroll_id} value={p.payroll_id}>
                            {p.employee_name} - {formatINR(p.net_salary)} ({p.month_year})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select
                      value={paymentMode}
                      onValueChange={(v) => setPaymentMode(v as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank">Bank Transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Transaction Reference (Optional)</Label>
                    <Input
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="UTR, Cheque No., etc."
                    />
                  </div>

                  <Button
                    onClick={handleRecordPayment}
                    disabled={isRecording || !selectedPayroll}
                    className="w-full"
                  >
                    {isRecording ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirm Payment"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.map((payment) => (
                  <TableRow key={payment.payment_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{payment.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{payment.month_year}</p>
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
                    <TableCell className="text-sm">
                      {format(new Date(payment.payment_date), "dd MMM")}
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
