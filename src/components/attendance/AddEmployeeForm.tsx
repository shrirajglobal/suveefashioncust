import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeeSchema, type EmployeeFormData } from "@/lib/employeeValidation";

interface Manager {
  employee_id: string;
  full_name: string;
}

interface AddEmployeeFormProps {
  onSuccess?: () => void;
}

const AddEmployeeForm = ({ onSuccess }: AddEmployeeFormProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      department: "",
      role: "",
      salaryType: "monthly",
      baseSalary: 0,
      perDayRate: 0,
      overtimeRate: 0,
      joiningDate: new Date().toISOString().split("T")[0],
      reportingManagerId: null,
      mobileNo: "",
      isSalesPerson: false,
    },
  });

  useEffect(() => {
    const fetchManagers = async () => {
      const { data } = await supabase
        .from("employee_master")
        .select("employee_id, full_name")
        .eq("status", "active")
        .order("full_name");

      if (data) {
        setManagers(data);
      }
    };

    if (open) {
      fetchManagers();
    }
  }, [open]);

  const onSubmit = async (data: EmployeeFormData) => {
    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("create-employee", {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          department: data.department,
          role: data.role,
          salaryType: data.salaryType,
          baseSalary: data.baseSalary,
          perDayRate: data.perDayRate,
          overtimeRate: data.overtimeRate,
          joiningDate: data.joiningDate,
          reportingManagerId: data.reportingManagerId || null,
          mobileNo: data.mobileNo || null,
          isSalesPerson: data.isSalesPerson,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create employee");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Employee created successfully!", {
        description: data.isSalesPerson
          ? "They can now access both HR & CRM modules"
          : "They can now access the HR module",
      });

      form.reset();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating employee:", error);
      toast.error("Failed to create employee", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate per day rate when base salary changes
  const baseSalary = form.watch("baseSalary");
  const salaryType = form.watch("salaryType");

  useEffect(() => {
    if (salaryType === "monthly" && baseSalary > 0) {
      const perDay = Math.round(baseSalary / 26);
      form.setValue("perDayRate", perDay);
    }
  }, [baseSalary, salaryType, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a new employee account. Enable "Also a Salesperson" to give
            CRM access.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                Account Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="employee@company.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min 6 characters"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                Personal Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 9876543210" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Work Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                Work Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales, Operations, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role/Designation *</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales Executive, Manager, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reportingManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reporting Manager</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No Manager</SelectItem>
                          {managers.map((m) => (
                            <SelectItem key={m.employee_id} value={m.employee_id}>
                              {m.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Salary Details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                Salary Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salaryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salary Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Salary (₹) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="25000"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="perDayRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Per Day Rate (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Auto-calculated"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Auto-calculated: Base Salary / 26 days
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="overtimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate (₹/hr)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* CRM Access */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <FormField
                control={form.control}
                name="isSalesPerson"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Also a Salesperson (CRM Access)
                      </FormLabel>
                      <FormDescription>
                        Enable to give this employee access to the Sales CRM
                        module with the same login credentials
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Employee
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeForm;
