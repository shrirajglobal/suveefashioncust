import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, IndianRupee, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { formatINR } from "@/lib/formatters";

interface Payslip {
  payroll_id: string;
  month_year: string;
  days_present: number;
  total_working_days: number;
  gross_salary: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  payment_status: "pending" | "paid";
  payslip_url: string | null;
}

const PayslipsTab = () => {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
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
      }
      setIsLoading(false);
    };

    fetchPayslips();
  }, [employeeId]);

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy");
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
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
    <div className="space-y-3">
      {payslips.map((payslip) => (
        <Card key={payslip.payroll_id} className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {formatMonthYear(payslip.month_year)}
              </CardTitle>
              <Badge
                variant={payslip.payment_status === "paid" ? "default" : "secondary"}
                className={payslip.payment_status === "paid" ? "bg-green-100 text-green-700" : ""}
              >
                {payslip.payment_status === "paid" ? "Paid" : "Pending"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Days Present</p>
                <p className="font-medium">
                  {payslip.days_present}/{payslip.total_working_days}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Salary</p>
                <p className="font-medium">{formatINR(payslip.gross_salary || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deductions</p>
                <p className="font-medium text-red-600">
                  -{formatINR(payslip.total_deductions || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Salary</p>
                <p className="font-bold text-lg flex items-center gap-1">
                  <IndianRupee className="h-4 w-4" />
                  {formatINR(payslip.net_salary || 0).replace("₹", "")}
                </p>
              </div>
            </div>

            {payslip.payslip_url ? (
              <Button variant="outline" className="w-full gap-2" asChild>
                <a href={payslip.payslip_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Download Payslip
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                <FileText className="h-4 w-4 mr-2" />
                Payslip Not Generated
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PayslipsTab;
