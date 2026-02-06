import { useEffect, useState, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const AttendanceHistory = lazy(() => import("./AttendanceHistory"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const ManagerDashboard = lazy(() => import("./ManagerDashboard"));
const StaffDashboard = lazy(() => import("./StaffDashboard"));

const AttendanceDashboard = () => {
  const { user, userRole, isAdminOrAccounts } = useAuth();
  const [isManager, setIsManager] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "history">("overview");
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is a manager
  useEffect(() => {
    const checkManagerStatus = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if this user has employees reporting to them
      const { data: employeeId } = await supabase.rpc("get_employee_id", { 
        _user_id: user.id 
      });

      if (employeeId) {
        const { data: reports } = await supabase
          .from("employee_master")
          .select("employee_id")
          .eq("reporting_manager_id", employeeId)
          .eq("status", "active")
          .limit(1);

        setIsManager((reports?.length || 0) > 0);
      }

      setIsLoading(false);
    };

    checkManagerStatus();
  }, [user]);

  const renderDashboard = () => {
    if (isLoading) {
      return <Skeleton className="h-96" />;
    }

    // Admin/Accounts see admin dashboard
    if (isAdminOrAccounts) {
      return <AdminDashboard />;
    }

    // Managers see manager dashboard
    if (isManager) {
      return <ManagerDashboard />;
    }

    // Staff see personal dashboard
    return <StaffDashboard />;
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            {renderDashboard()}
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <AttendanceHistory />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceDashboard;
