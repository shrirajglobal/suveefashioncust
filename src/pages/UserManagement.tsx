import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/crm/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Shield, Users, ArrowLeft, Lock, Unlock, Clock, Phone, IndianRupee, Target, Edit2, Check, X, UserPlus } from "lucide-react";
import { addDays, format, formatDistanceToNow, startOfMonth, endOfMonth } from "date-fns";
import { formatINR } from "@/lib/formatters";
import { getCurrentFinancialYearRange, getCurrentFiscalQuarterRange } from "@/lib/financialYear";
import { getSafeErrorMessage, logError } from "@/lib/errorHandler";

type AppRole = "super_admin" | "accounts" | "sales_team";
type TimePeriod = "monthly" | "quarterly" | "annual";

interface UserWithRole {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  createdAt: string;
  isRestricted: boolean;
  restrictedUntil: string | null;
  restrictionReason: string | null;
  mobileNo: string | null;
  salary: number | null;
  salesTarget: number | null;
  targetAchieved: number;
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  accounts: "Accounts",
  sales_team: "Sales Team",
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full access to all data, users, customers, transactions, and assignments",
  accounts: "Same access as Super Admin - can view and manage all data",
  sales_team: "Can only view customers assigned to them and their related transactions",
};

const RESTRICTION_DURATIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "1 week" },
  { value: "14", label: "2 weeks" },
  { value: "30", label: "1 month" },
  { value: "indefinite", label: "Indefinitely" },
];

const TIME_PERIODS: { value: TimePeriod; label: string; salaryMultiplier: number; targetMultiplier: number }[] = [
  { value: "monthly", label: "This Month", salaryMultiplier: 1, targetMultiplier: 1 },
  { value: "quarterly", label: "This Quarter (FY)", salaryMultiplier: 3, targetMultiplier: 3 },
  { value: "annual", label: "This Financial Year", salaryMultiplier: 12, targetMultiplier: 12 },
];

export default function UserManagement() {
  const { userRole, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{
    userId: string;
    newRole: AppRole;
    userName: string;
  } | null>(null);
  
  // Restriction dialog state
  const [restrictDialogOpen, setRestrictDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [restrictionDuration, setRestrictionDuration] = useState("7");
  const [restrictionReason, setRestrictionReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit profile dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    mobileNo: "",
    salary: "",
  });

  // Add salesperson dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    password: "",
    fullName: "",
    mobileNo: "",
    salary: "",
  });

  // Time period filter
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");

  // Only super_admin can access this page
  const canManageRoles = userRole === "super_admin";
  const isUnauthorized = userRole && userRole !== "super_admin";

  useEffect(() => {
    // Only fetch if authorized
    if (!isUnauthorized) {
      fetchUsers();
    }
  }, [timePeriod, isUnauthorized]);

  const getDateRange = () => {
    const now = new Date();
    switch (timePeriod) {
      case "monthly":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarterly":
        // Use Indian fiscal quarter (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar)
        return getCurrentFiscalQuarterRange();
      case "annual":
        // Use Indian Financial Year (April to March)
        return getCurrentFinancialYearRange();
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch sales achieved by each salesperson for the selected period
      const { start, end } = getDateRange();
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("customer_id, amount, transaction_date")
        .gte("transaction_date", start.toISOString().split('T')[0])
        .lte("transaction_date", end.toISOString().split('T')[0]);

      if (transactionsError) throw transactionsError;

      // Get customer to salesperson mapping
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, assigned_to");

      if (customersError) throw customersError;

      const customerToSalesperson = new Map<string, string>();
      customersData?.forEach((c) => {
        if (c.assigned_to) {
          customerToSalesperson.set(c.id, c.assigned_to);
        }
      });

      // Aggregate sales by salesperson for the period
      const salesBySalesperson = new Map<string, number>();
      transactionsData?.forEach((txn) => {
        const salespersonId = customerToSalesperson.get(txn.customer_id);
        if (salespersonId) {
          const current = salesBySalesperson.get(salespersonId) || 0;
          salesBySalesperson.set(salespersonId, current + Number(txn.amount || 0));
        }
      });

      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => ({
        id: profile.user_id,
        email: profile.email || "",
        fullName: profile.full_name,
        role: roleMap.get(profile.user_id) as AppRole | null,
        createdAt: profile.created_at,
        isRestricted: profile.is_restricted || false,
        restrictedUntil: profile.restricted_until,
        restrictionReason: profile.restriction_reason,
        mobileNo: profile.mobile_no || null,
        salary: profile.salary ? Number(profile.salary) : null,
        salesTarget: profile.sales_target ? Number(profile.sales_target) : null,
        targetAchieved: salesBySalesperson.get(profile.user_id) || 0,
      }));

      setUsers(usersWithRoles);
    } catch (error: unknown) {
      logError('fetchUsers', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    setPendingChange({ userId, newRole, userName: user.fullName || user.email });
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;

    const { userId, newRole } = pendingChange;

    try {
      // Check if user already has a role
      const existingUser = users.find((u) => u.id === userId);

      if (existingUser?.role) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: newRole,
        });

        if (error) throw error;
      }

      toast.success(`Role updated to ${ROLE_LABELS[newRole]}`);
      fetchUsers();
    } catch (error: unknown) {
      logError('confirmRoleChange', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setPendingChange(null);
    }
  };

  const openRestrictDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setRestrictionDuration("7");
    setRestrictionReason("");
    setRestrictDialogOpen(true);
  };

  const handleRestrictAccess = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      const restrictedUntil = restrictionDuration === "indefinite" 
        ? null 
        : addDays(new Date(), parseInt(restrictionDuration)).toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({
          is_restricted: true,
          restricted_until: restrictedUntil,
          restriction_reason: restrictionReason || "Inactivity",
        })
        .eq("user_id", selectedUser.id);

      if (error) throw error;

      toast.success(`Access restricted for ${selectedUser.fullName || selectedUser.email}`);
      setRestrictDialogOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      logError('handleRestrictAccess', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveRestriction = async (userId: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_restricted: false,
          restricted_until: null,
          restriction_reason: null,
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Access restriction removed");
      fetchUsers();
    } catch (error: unknown) {
      logError('handleRemoveRestriction', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName || "",
      email: user.email || "",
      mobileNo: user.mobileNo || "",
      salary: user.salary?.toString() || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.fullName,
          email: editForm.email,
          mobile_no: editForm.mobileNo || null,
          salary: editForm.salary ? parseFloat(editForm.salary) : null,
        })
        .eq("user_id", editingUser.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      logError('handleSaveProfile', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateSalesperson = async () => {
    if (!addForm.email || !addForm.password || !addForm.fullName) {
      toast.error("Email, password, and full name are required");
      return;
    }

    if (addForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreating(true);
    try {
      const response = await supabase.functions.invoke("create-salesperson", {
        body: {
          email: addForm.email.trim(),
          password: addForm.password,
          fullName: addForm.fullName.trim(),
          mobileNo: addForm.mobileNo.trim() || undefined,
          salary: addForm.salary ? parseFloat(addForm.salary) : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`Salesperson "${addForm.fullName}" created successfully`);
      setAddDialogOpen(false);
      setAddForm({ email: "", password: "", fullName: "", mobileNo: "", salary: "" });
      fetchUsers();
    } catch (error: unknown) {
      logError('handleCreateSalesperson', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  // Access denied - show before loading to prevent flash of content
  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              Only Super Admins can access this page.
            </p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                User Management
              </h1>
              <p className="text-muted-foreground">
                Manage user roles and access permissions
              </p>
            </div>
          </div>
          {canManageRoles && (
            <Button onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Salesperson
            </Button>
          )}
        </div>

        {/* Time Period Filter */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <Label className="text-sm font-medium">View Period:</Label>
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {TIME_PERIODS.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Salary, target & achieved values adjust based on the selected period
          </p>
        </div>

        {/* Role Descriptions */}
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
            <div
              key={role}
              className="rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{ROLE_LABELS[role]}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile No.</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Sales Target</TableHead>
                <TableHead>Target Achieved</TableHead>
                <TableHead>Status</TableHead>
                {canManageRoles && <TableHead>Change Role</TableHead>}
                {canManageRoles && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const isExpired = user.restrictedUntil && new Date(user.restrictedUntil) < new Date();
                  const effectivelyRestricted = user.isRestricted && !isExpired;
                  
                  // Calculate period-adjusted values
                  const periodConfig = TIME_PERIODS.find(p => p.value === timePeriod)!;
                  const periodSalary = user.salary ? user.salary * periodConfig.salaryMultiplier : null;
                  const periodTarget = user.salary ? user.salary * 30 * periodConfig.targetMultiplier : null;
                  const periodAchieved = user.targetAchieved;
                  
                  return (
                    <TableRow 
                      key={user.id}
                      className={effectivelyRestricted ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {effectivelyRestricted && <Lock className="h-4 w-4 text-destructive" />}
                          {user.fullName || "—"}
                          {isSelf && <Badge variant="outline" className="text-xs">You</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{user.email || "—"}</TableCell>
                      <TableCell>
                        {user.mobileNo ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {user.mobileNo}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <Badge
                            variant={
                              user.role === "super_admin"
                                ? "default"
                                : user.role === "accounts"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {ROLE_LABELS[user.role]}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">No Role</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {periodSalary ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <IndianRupee className="h-3 w-3 text-muted-foreground" />
                              {formatINR(periodSalary).replace("₹", "")}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {timePeriod === "monthly" ? "/month" : timePeriod === "quarterly" ? "/quarter" : "/year"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {periodTarget ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3 text-muted-foreground" />
                              {formatINR(periodTarget)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {timePeriod === "monthly" ? "Monthly" : timePeriod === "quarterly" ? "Quarterly" : "Annual"} target
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role === "sales_team" ? (
                          <div className="space-y-1">
                            <div className="font-medium">{formatINR(periodAchieved)}</div>
                            {periodTarget && periodTarget > 0 && (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      (periodAchieved / periodTarget) >= 1 
                                        ? "bg-green-500" 
                                        : (periodAchieved / periodTarget) >= 0.5 
                                        ? "bg-yellow-500" 
                                        : "bg-destructive"
                                    }`}
                                    style={{ 
                                      width: `${Math.min((periodAchieved / periodTarget) * 100, 100)}%` 
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round((periodAchieved / periodTarget) * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {effectivelyRestricted ? (
                          <div className="space-y-1">
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <Lock className="h-3 w-3" />
                              Restricted
                            </Badge>
                            {user.restrictedUntil ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Until {format(new Date(user.restrictedUntil), "MMM d, yyyy")}
                              </p>
                            ) : (
                              <p className="text-xs text-destructive">Indefinitely</p>
                            )}
                            {user.restrictionReason && (
                              <p className="text-xs text-muted-foreground italic">
                                {user.restrictionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      {canManageRoles && (
                        <TableCell>
                          <Select
                            value={user.role || ""}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, value as AppRole)
                            }
                            disabled={isSelf}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Assign role" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="super_admin">
                                Super Admin
                              </SelectItem>
                              <SelectItem value="accounts">Accounts</SelectItem>
                              <SelectItem value="sales_team">
                                Sales Team
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {canManageRoles && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(user)}
                              disabled={isUpdating}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {user.role === "sales_team" && !isSelf && (
                              effectivelyRestricted ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemoveRestriction(user.id)}
                                  disabled={isUpdating}
                                  className="text-green-600 border-green-600 hover:bg-green-50"
                                >
                                  <Unlock className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRestrictDialog(user)}
                                  disabled={isUpdating}
                                  className="text-destructive border-destructive hover:bg-destructive/10"
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog
        open={!!pendingChange}
        onOpenChange={() => setPendingChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change{" "}
              <strong>{pendingChange?.userName}</strong>'s role to{" "}
              <strong>
                {pendingChange ? ROLE_LABELS[pendingChange.newRole] : ""}
              </strong>
              ?
              <br />
              <br />
              {pendingChange && (
                <span className="text-sm">
                  {ROLE_DESCRIPTIONS[pendingChange.newRole]}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restrict Access Dialog */}
      <Dialog open={restrictDialogOpen} onOpenChange={setRestrictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" />
              Restrict User Access
            </DialogTitle>
            <DialogDescription>
              Temporarily restrict access for{" "}
              <strong>{selectedUser?.fullName || selectedUser?.email}</strong>.
              They will not be able to log in or access the system until the restriction is lifted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Restriction Duration</Label>
              <Select value={restrictionDuration} onValueChange={setRestrictionDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {RESTRICTION_DURATIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Extended inactivity, Policy violation"
                value={restrictionReason}
                onChange={(e) => setRestrictionReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestrictDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestrictAccess}
              disabled={isUpdating}
            >
              {isUpdating ? "Restricting..." : "Restrict Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Sales Team Member
            </DialogTitle>
            <DialogDescription>
              Update profile information for {editingUser?.fullName || editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Name</Label>
              <Input
                id="fullName"
                placeholder="Full name"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email ID</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNo">Mobile No.</Label>
              <Input
                id="mobileNo"
                placeholder="10-digit mobile number"
                value={editForm.mobileNo}
                onChange={(e) => setEditForm({ ...editForm, mobileNo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">Salary (₹/month)</Label>
              <Input
                id="salary"
                type="number"
                placeholder="Monthly salary in rupees"
                value={editForm.salary}
                onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
              />
              {editForm.salary && (
                <p className="text-xs text-muted-foreground">
                  Sales Target: {formatINR(parseFloat(editForm.salary) * 30)} (Salary × 30)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isUpdating || !editForm.fullName}
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Salesperson Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New Salesperson
            </DialogTitle>
            <DialogDescription>
              Create a new sales team member. They will be assigned the Sales Team role automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-fullName">Full Name *</Label>
              <Input
                id="add-fullName"
                placeholder="Enter full name"
                value={addForm.fullName}
                onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-email">Email ID *</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="email@example.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-password">Password *</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-mobileNo">Mobile No.</Label>
              <Input
                id="add-mobileNo"
                placeholder="10-digit mobile number"
                value={addForm.mobileNo}
                onChange={(e) => setAddForm({ ...addForm, mobileNo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-salary">Salary (₹/month)</Label>
              <Input
                id="add-salary"
                type="number"
                placeholder="Monthly salary in rupees"
                value={addForm.salary}
                onChange={(e) => setAddForm({ ...addForm, salary: e.target.value })}
              />
              {addForm.salary && (
                <p className="text-xs text-muted-foreground">
                  Sales Target: {formatINR(parseFloat(addForm.salary) * 30)} (Salary × 30)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setAddForm({ email: "", password: "", fullName: "", mobileNo: "", salary: "" });
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSalesperson}
              disabled={isCreating || !addForm.email || !addForm.password || !addForm.fullName}
            >
              {isCreating ? "Creating..." : "Create Salesperson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
