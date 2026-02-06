import { lazy, Suspense, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  Wallet, 
  CreditCard, 
  FileText,
  Settings,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HRSettingsDialog } from "@/components/attendance/HRSettingsDialog";
import { Button } from "@/components/ui/button";
import LocationTrackingProvider from "@/components/attendance/LocationTrackingProvider";

// Lazy load tab content for performance
const AttendanceDashboard = lazy(() => import("@/components/attendance/AttendanceDashboard"));
const AttendanceTab = lazy(() => import("@/components/attendance/AttendanceTab"));
const TeamTab = lazy(() => import("@/components/attendance/TeamTab"));
const PayrollTab = lazy(() => import("@/components/attendance/PayrollTab"));
const PaymentsTab = lazy(() => import("@/components/attendance/PaymentsTab"));
const PayslipsTab = lazy(() => import("@/components/attendance/PayslipsTab"));
const TeamLocationTracker = lazy(() => import("@/components/attendance/TeamLocationTracker"));

const TabSkeleton = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

type TabId = "dashboard" | "attendance" | "team" | "location" | "payroll" | "payments" | "payslips";

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
  roles: ("super_admin" | "accounts" | "sales_team" | "staff" | "manager")[];
}

const TABS: TabConfig[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "accounts", "sales_team", "staff", "manager"] },
  { id: "attendance", label: "Attendance", icon: Clock, roles: ["super_admin", "accounts", "sales_team", "staff", "manager"] },
  { id: "team", label: "Team", icon: Users, roles: ["super_admin", "accounts", "manager"] },
  { id: "location", label: "Location", icon: MapPin, roles: ["super_admin", "accounts"] },
  { id: "payroll", label: "Payroll", icon: Wallet, roles: ["super_admin", "accounts"] },
  { id: "payments", label: "Payments", icon: CreditCard, roles: ["super_admin", "accounts"] },
  { id: "payslips", label: "Payslips", icon: FileText, roles: ["staff", "sales_team"] },
];

const AttendancePayroll = () => {
  const { userRole, isAdminOrAccounts } = useAuth();
  const navigate = useNavigate();
  
  // Users with CRM access can switch to CRM
  const hasCRMAccess = userRole === "super_admin" || userRole === "accounts" || userRole === "sales_team";
  
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    try {
      return (localStorage.getItem("attendance:activeTab") as TabId) ?? "dashboard";
    } catch {
      return "dashboard";
    }
  });

  // Filter tabs based on user role
  const visibleTabs = TABS.filter((tab) => {
    if (!userRole) return false;
    
    // Admin/Accounts see everything except payslips (they see payroll instead)
    if (isAdminOrAccounts) {
      return tab.id !== "payslips";
    }
    
    // Staff/Sales team see: dashboard, attendance, payslips
    if (userRole === "sales_team") {
      return ["dashboard", "attendance", "payslips"].includes(tab.id);
    }
    
    return tab.roles.includes(userRole as any);
  });

  // Persist active tab
  useEffect(() => {
    try {
      localStorage.setItem("attendance:activeTab", activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Ensure active tab is valid for current user
  useEffect(() => {
    const validTabIds = visibleTabs.map((t) => t.id);
    if (!validTabIds.includes(activeTab)) {
      setActiveTab(validTabIds[0] || "dashboard");
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      {/* Silent location tracking for staff/manager */}
      <LocationTrackingProvider />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">Attendance & Payroll</h1>
          <div className="flex items-center gap-2">
            {/* Module Navigation for CRM access */}
            {hasCRMAccess && (
              <div className="hidden sm:flex items-center border rounded-lg p-1 mr-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="gap-1"
                >
                  <Users className="h-4 w-4" />
                  CRM
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1 bg-muted"
                >
                  <Clock className="h-4 w-4" />
                  HR
                </Button>
              </div>
            )}
            
            {/* Mobile: Icon-only CRM button */}
            {hasCRMAccess && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/")}
                className="sm:hidden"
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            
            {isAdminOrAccounts && (
              <HRSettingsDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">HR Settings</span>
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 sm:px-4 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="space-y-4">
          {/* Mobile-optimized tab navigation */}
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "flex-1 min-w-[70px] flex flex-col sm:flex-row items-center gap-1 py-2 px-2 text-xs sm:text-sm",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <Suspense fallback={<TabSkeleton />}>
            <TabsContent value="dashboard" className="mt-4">
              <AttendanceDashboard />
            </TabsContent>

            <TabsContent value="attendance" className="mt-4">
              <AttendanceTab />
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              <TeamTab />
            </TabsContent>

            <TabsContent value="location" className="mt-4">
              <TeamLocationTracker />
            </TabsContent>

            <TabsContent value="payroll" className="mt-4">
              <PayrollTab />
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <PaymentsTab />
            </TabsContent>

            <TabsContent value="payslips" className="mt-4">
              <PayslipsTab />
            </TabsContent>
          </Suspense>
        </Tabs>
      </main>
    </div>
  );
};

export default AttendancePayroll;
