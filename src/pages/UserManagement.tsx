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
import { Shield, Users, ArrowLeft, Lock, Unlock, Clock } from "lucide-react";
import { addDays, format, formatDistanceToNow } from "date-fns";

type AppRole = "super_admin" | "accounts" | "sales_team";

interface UserWithRole {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  createdAt: string;
  isRestricted: boolean;
  restrictedUntil: string | null;
  restrictionReason: string | null;
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

  // Only super_admin can access this page
  const canManageRoles = userRole === "super_admin";

  useEffect(() => {
    if (userRole && userRole !== "super_admin") {
      toast.error("Access denied. Only Super Admins can manage users.");
      navigate("/");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

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
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("Failed to fetch users: " + error.message);
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
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
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
    } catch (error: any) {
      toast.error("Failed to restrict access: " + error.message);
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
    } catch (error: any) {
      toast.error("Failed to remove restriction: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

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
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                {canManageRoles && <TableHead>Change Role</TableHead>}
                {canManageRoles && <TableHead>Access Control</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  const isExpired = user.restrictedUntil && new Date(user.restrictedUntil) < new Date();
                  const effectivelyRestricted = user.isRestricted && !isExpired;
                  
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
                                Reason: {user.restrictionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
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
                          {user.role === "sales_team" && !isSelf && (
                            effectivelyRestricted ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveRestriction(user.id)}
                                disabled={isUpdating}
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                <Unlock className="h-4 w-4 mr-1" />
                                Restore Access
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRestrictDialog(user)}
                                disabled={isUpdating}
                                className="text-destructive border-destructive hover:bg-destructive/10"
                              >
                                <Lock className="h-4 w-4 mr-1" />
                                Restrict
                              </Button>
                            )
                          )}
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
    </div>
  );
}
