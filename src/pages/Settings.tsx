import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Lock, Users, ArrowRightLeft, UserCog, BarChart3, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UsageAnalytics } from "@/components/crm/UsageAnalytics";
import { WhatsAppTemplateEditor } from "@/components/crm/WhatsAppTemplateEditor";

interface SalesUser {
  user_id: string;
  full_name: string;
  role: string;
}

type SettingsSection = "password" | "reassign" | "users" | "usage" | "whatsapp";

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("password");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [fromUser, setFromUser] = useState<string>("");
  const [toUser, setToUser] = useState<string>("");
  const [customerCount, setCustomerCount] = useState<number>(0);
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  // Fetch sales team users for super admin
  useEffect(() => {
    if (userRole === "super_admin") {
      fetchSalesUsers();
    }
  }, [userRole]);

  // Fetch customer count when "from" user changes
  useEffect(() => {
    if (fromUser) {
      fetchCustomerCount(fromUser);
    } else {
      setCustomerCount(0);
    }
  }, [fromUser]);

  const fetchSalesUsers = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];

      const usersWithRoles = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          role: userRole?.role || "unknown",
        };
      });

      setSalesUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchCustomerCount = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", userId);

      if (error) throw error;
      setCustomerCount(count || 0);
    } catch (error: any) {
      console.error("Failed to fetch customer count:", error);
      setCustomerCount(0);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: oldPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect");
        setIsLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(updateError.message);
      } else {
        toast.success("Password updated successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      toast.error("Failed to update password: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkReassign = async () => {
    if (!fromUser || !toUser) {
      toast.error("Please select both source and target users");
      return;
    }

    if (fromUser === toUser) {
      toast.error("Source and target users must be different");
      return;
    }

    setIsReassigning(true);

    try {
      const { error } = await supabase
        .from("customers")
        .update({ assigned_to: toUser })
        .eq("assigned_to", fromUser);

      if (error) throw error;

      const fromUserName = salesUsers.find((u) => u.user_id === fromUser)?.full_name;
      const toUserName = salesUsers.find((u) => u.user_id === toUser)?.full_name;

      toast.success(`Successfully reassigned ${customerCount} customers from ${fromUserName} to ${toUserName}`);
      setFromUser("");
      setToUser("");
      setCustomerCount(0);
    } catch (error: any) {
      toast.error("Failed to reassign customers: " + error.message);
    } finally {
      setIsReassigning(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      accounts: "Accounts",
      sales_team: "Sales Team",
    };
    return labels[role] || role;
  };

  const menuItems = [
    { id: "password" as SettingsSection, label: "Reset Password", icon: Lock, show: true, isLink: false },
    { id: "reassign" as SettingsSection, label: "Reassign Customers", icon: ArrowRightLeft, show: userRole === "super_admin", isLink: false },
    { id: "whatsapp" as SettingsSection, label: "WhatsApp Templates", icon: MessageCircle, show: userRole === "super_admin", isLink: false },
    { id: "usage" as SettingsSection, label: "Usage Analytics", icon: BarChart3, show: userRole === "super_admin", isLink: false },
    { id: "users" as SettingsSection, label: "Manage Users", icon: UserCog, show: userRole === "super_admin", isLink: true, href: "/users" },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar Menu */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="space-y-1">
              {menuItems.map((item) => (
                item.isLink ? (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.href!)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      "hover:bg-muted text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              ))}
            </nav>
          </aside>

          {/* Right Content Area */}
          <div className="flex-1 max-w-xl">
            {activeSection === "password" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="oldPassword">Current Password</Label>
                      <Input
                        id="oldPassword"
                        type="password"
                        placeholder="Enter current password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeSection === "reassign" && userRole === "super_admin" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5" />
                    Bulk Customer Reassignment
                  </CardTitle>
                  <CardDescription>
                    Reassign all customers from one user to another
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromUser">From User</Label>
                    <Select value={fromUser} onValueChange={setFromUser}>
                      <SelectTrigger id="fromUser" className="bg-background">
                        <SelectValue placeholder="Select source user" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {salesUsers.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.full_name} ({getRoleLabel(u.role)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fromUser && (
                      <p className="text-sm text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {customerCount} customer{customerCount !== 1 ? "s" : ""} assigned
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="toUser">To User</Label>
                    <Select value={toUser} onValueChange={setToUser}>
                      <SelectTrigger id="toUser" className="bg-background">
                        <SelectValue placeholder="Select target user" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {salesUsers
                          .filter((u) => u.user_id !== fromUser)
                          .map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                              {u.full_name} ({getRoleLabel(u.role)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="w-full"
                        disabled={!fromUser || !toUser || fromUser === toUser || customerCount === 0 || isReassigning}
                      >
                        {isReassigning ? "Reassigning..." : `Reassign ${customerCount} Customer${customerCount !== 1 ? "s" : ""}`}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-background">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Reassignment</AlertDialogTitle>
                        <AlertDialogDescription>
                          You are about to reassign <strong>{customerCount} customer{customerCount !== 1 ? "s" : ""}</strong> from{" "}
                          <strong>{salesUsers.find((u) => u.user_id === fromUser)?.full_name}</strong> to{" "}
                          <strong>{salesUsers.find((u) => u.user_id === toUser)?.full_name}</strong>.
                          <br /><br />
                          This action cannot be undone. Are you sure you want to proceed?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkReassign}>
                          Yes, Reassign All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}

            {activeSection === "usage" && userRole === "super_admin" && (
              <div className="max-w-3xl">
                <UsageAnalytics />
              </div>
            )}

            {activeSection === "whatsapp" && userRole === "super_admin" && (
              <div className="max-w-2xl">
                <WhatsAppTemplateEditor />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
