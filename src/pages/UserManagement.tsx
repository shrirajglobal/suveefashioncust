import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/crm/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Shield, Users, ArrowLeft } from "lucide-react";

type AppRole = "super_admin" | "accounts" | "sales_team";

interface UserWithRole {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  createdAt: string;
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

export default function UserManagement() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{
    userId: string;
    newRole: AppRole;
    userName: string;
  } | null>(null);

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6" />
                User Management
              </h1>
              <p className="text-muted-foreground">
                Manage user roles and permissions
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Joined</TableHead>
                {canManageRoles && <TableHead>Change Role</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.fullName || "—"}
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
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canManageRoles && (
                      <TableCell>
                        <Select
                          value={user.role || ""}
                          onValueChange={(value) =>
                            handleRoleChange(user.id, value as AppRole)
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Confirmation Dialog */}
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
    </div>
  );
}
