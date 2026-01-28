import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, Users, AlertTriangle, Crown, Clock, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatters";
import { startOfDay } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardMetrics {
  callsMadeToday: number;
  customersContactedToday: number;
  customersNotContacted15Days: CustomerAlert[];
  highValueOverdue: CustomerAlert[];
}

interface CustomerAlert {
  customer_id: string;
  name: string;
  phone: string;
  total_lifetime_sales: number;
  days_since_last_contact: number | null;
  last_contacted_date: string | null;
  assigned_salesperson_name?: string | null;
}

interface SalespersonPerformance {
  id: string;
  name: string;
  callsToday: number;
  customersContactedToday: number;
  overdueCount: number;
  highValueOverdueCount: number;
}

interface AdminMetrics {
  totalCallsToday: number;
  totalCustomersContactedToday: number;
  totalOverdue15Days: number;
  totalHighValueOverdue: number;
  salespersonPerformance: SalespersonPerformance[];
}

export function SalespersonDashboard() {
  const { user, isAdminOrAccounts } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    callsMadeToday: 0,
    customersContactedToday: 0,
    customersNotContacted15Days: [],
    highValueOverdue: [],
  });
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const todayStart = startOfDay(new Date()).toISOString();

        if (isAdminOrAccounts) {
          // Admin view: fetch all data across organization
          await fetchAdminMetrics(todayStart);
        } else {
          // Salesperson view: fetch only their data
          await fetchSalespersonMetrics(todayStart);
        }
      } catch (error: any) {
        console.error("Failed to fetch dashboard metrics:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchSalespersonMetrics = async (todayStart: string) => {
      // Fetch calls made today by this user
      const { data: todayInteractions, error: interactionsError } = await supabase
        .from("interactions")
        .select("id, customer_id")
        .gte("interaction_datetime", todayStart)
        .eq("salesperson_id", user!.id);

      if (interactionsError) throw interactionsError;

      const callsMadeToday = todayInteractions?.length || 0;
      const uniqueCustomersToday = new Set(todayInteractions?.map(i => i.customer_id) || []);
      const customersContactedToday = uniqueCustomersToday.size;

      // Fetch customer analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("customer_analytics")
        .select("customer_id, name, phone, total_lifetime_sales, days_since_last_contact, last_contacted_date")
        .eq("dnd", false);

      if (analyticsError) throw analyticsError;

      const customersNotContacted15Days = (analyticsData || [])
        .filter(c => c.days_since_last_contact === null || c.days_since_last_contact > 15)
        .map(c => ({
          customer_id: c.customer_id!,
          name: c.name!,
          phone: c.phone!,
          total_lifetime_sales: c.total_lifetime_sales || 0,
          days_since_last_contact: c.days_since_last_contact,
          last_contacted_date: c.last_contacted_date,
        }))
        .sort((a, b) => (b.days_since_last_contact || 999) - (a.days_since_last_contact || 999));

      const highValueOverdue = (analyticsData || [])
        .filter(c => 
          (c.total_lifetime_sales || 0) > 50000 && 
          (c.days_since_last_contact === null || c.days_since_last_contact > 10)
        )
        .map(c => ({
          customer_id: c.customer_id!,
          name: c.name!,
          phone: c.phone!,
          total_lifetime_sales: c.total_lifetime_sales || 0,
          days_since_last_contact: c.days_since_last_contact,
          last_contacted_date: c.last_contacted_date,
        }))
        .sort((a, b) => b.total_lifetime_sales - a.total_lifetime_sales);

      setMetrics({
        callsMadeToday,
        customersContactedToday,
        customersNotContacted15Days,
        highValueOverdue,
      });
    };

    const fetchAdminMetrics = async (todayStart: string) => {
      // Fetch all interactions today
      const { data: allTodayInteractions, error: interactionsError } = await supabase
        .from("interactions")
        .select("id, customer_id, salesperson_id")
        .gte("interaction_datetime", todayStart);

      if (interactionsError) throw interactionsError;

      // Fetch all salespersons with sales_team role
      const { data: salesRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_team");

      if (rolesError) throw rolesError;

      const salesUserIds = (salesRoles || []).map(r => r.user_id);

      // Fetch profiles for salespeople
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", salesUserIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Fetch all customer analytics
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("customer_analytics")
        .select("customer_id, name, phone, total_lifetime_sales, days_since_last_contact, last_contacted_date, assigned_salesperson_id, assigned_salesperson_name")
        .eq("dnd", false);

      if (analyticsError) throw analyticsError;

      // Calculate organization-wide metrics
      const totalCallsToday = allTodayInteractions?.length || 0;
      const uniqueCustomersToday = new Set(allTodayInteractions?.map(i => i.customer_id) || []);
      const totalCustomersContactedToday = uniqueCustomersToday.size;

      const allOverdue15Days = (analyticsData || [])
        .filter(c => c.days_since_last_contact === null || c.days_since_last_contact > 15);

      const allHighValueOverdue = (analyticsData || [])
        .filter(c => 
          (c.total_lifetime_sales || 0) > 50000 && 
          (c.days_since_last_contact === null || c.days_since_last_contact > 10)
        );

      // Calculate per-salesperson performance
      const salespersonPerformance: SalespersonPerformance[] = salesUserIds.map(userId => {
        const name = profileMap.get(userId) || "Unknown";
        const userInteractions = (allTodayInteractions || []).filter(i => i.salesperson_id === userId);
        const userCustomersToday = new Set(userInteractions.map(i => i.customer_id));
        
        // Count assigned customers that are overdue
        const assignedCustomers = (analyticsData || []).filter(c => c.assigned_salesperson_id === userId);
        const overdueCount = assignedCustomers.filter(
          c => c.days_since_last_contact === null || c.days_since_last_contact > 15
        ).length;
        const highValueOverdueCount = assignedCustomers.filter(
          c => (c.total_lifetime_sales || 0) > 50000 && 
               (c.days_since_last_contact === null || c.days_since_last_contact > 10)
        ).length;

        return {
          id: userId,
          name,
          callsToday: userInteractions.length,
          customersContactedToday: userCustomersToday.size,
          overdueCount,
          highValueOverdueCount,
        };
      }).sort((a, b) => b.callsToday - a.callsToday);

      setAdminMetrics({
        totalCallsToday,
        totalCustomersContactedToday,
        totalOverdue15Days: allOverdue15Days.length,
        totalHighValueOverdue: allHighValueOverdue.length,
        salespersonPerformance,
      });

      // Also set the detailed customer lists for the admin
      setMetrics({
        callsMadeToday: totalCallsToday,
        customersContactedToday: totalCustomersContactedToday,
        customersNotContacted15Days: allOverdue15Days.map(c => ({
          customer_id: c.customer_id!,
          name: c.name!,
          phone: c.phone!,
          total_lifetime_sales: c.total_lifetime_sales || 0,
          days_since_last_contact: c.days_since_last_contact,
          last_contacted_date: c.last_contacted_date,
          assigned_salesperson_name: c.assigned_salesperson_name,
        })).sort((a, b) => (b.days_since_last_contact || 999) - (a.days_since_last_contact || 999)),
        highValueOverdue: allHighValueOverdue.map(c => ({
          customer_id: c.customer_id!,
          name: c.name!,
          phone: c.phone!,
          total_lifetime_sales: c.total_lifetime_sales || 0,
          days_since_last_contact: c.days_since_last_contact,
          last_contacted_date: c.last_contacted_date,
          assigned_salesperson_name: c.assigned_salesperson_name,
        })).sort((a, b) => b.total_lifetime_sales - a.total_lifetime_sales),
      });
    };

    fetchDashboardData();
  }, [user, isAdminOrAccounts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      {isAdminOrAccounts && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Organization Overview • Super Admin View</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.callsMadeToday}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdminOrAccounts ? "Total Calls Today" : "Calls Today"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.customersContactedToday}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdminOrAccounts ? "Total Contacted" : "Contacted Today"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={metrics.customersNotContacted15Days.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${metrics.customersNotContacted15Days.length > 0 ? "bg-destructive/10" : "bg-warning/10"}`}>
                <Clock className={`h-5 w-5 ${metrics.customersNotContacted15Days.length > 0 ? "text-destructive" : "text-warning-foreground"}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${metrics.customersNotContacted15Days.length > 0 ? "text-destructive" : ""}`}>
                  {metrics.customersNotContacted15Days.length}
                </p>
                <p className="text-xs text-muted-foreground">Overdue (15+ days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={metrics.highValueOverdue.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${metrics.highValueOverdue.length > 0 ? "bg-destructive/10" : "bg-warning/10"}`}>
                <Crown className={`h-5 w-5 ${metrics.highValueOverdue.length > 0 ? "text-destructive" : "text-warning-foreground"}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${metrics.highValueOverdue.length > 0 ? "text-destructive" : ""}`}>
                  {metrics.highValueOverdue.length}
                </p>
                <p className="text-xs text-muted-foreground">High-Value Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salesperson Performance Table (Admin Only) */}
      {isAdminOrAccounts && adminMetrics && adminMetrics.salespersonPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Salesperson Performance Today
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Individual performance metrics for each sales team member
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-center">Calls Today</TableHead>
                  <TableHead className="text-center">Customers Contacted</TableHead>
                  <TableHead className="text-center">Overdue (15+ days)</TableHead>
                  <TableHead className="text-center">High-Value Overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminMetrics.salespersonPerformance.map((sp) => (
                  <TableRow key={sp.id}>
                    <TableCell className="font-medium">{sp.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sp.callsToday > 0 ? "default" : "secondary"}>
                        {sp.callsToday}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sp.customersContactedToday > 0 ? "default" : "secondary"}>
                        {sp.customersContactedToday}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sp.overdueCount > 0 ? "destructive" : "secondary"}>
                        {sp.overdueCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={sp.highValueOverdueCount > 0 ? "destructive" : "secondary"}>
                        {sp.highValueOverdueCount}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* High-Value Overdue Customers Alert */}
      {metrics.highValueOverdue.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              High-Value Customers Need Attention
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Customers with ₹50,000+ sales not contacted in 10+ days
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.highValueOverdue.slice(0, 5).map((customer) => (
                <div
                  key={customer.customer_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div>
                    <p className="font-medium text-destructive">{customer.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatINR(customer.total_lifetime_sales)}</span>
                      <span className="text-destructive font-medium">
                        {customer.days_since_last_contact !== null
                          ? `${customer.days_since_last_contact} days overdue`
                          : "Never contacted"}
                      </span>
                      {isAdminOrAccounts && customer.assigned_salesperson_name && (
                        <span className="text-xs">• {customer.assigned_salesperson_name}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="destructive">Urgent</Badge>
                </div>
              ))}
              {metrics.highValueOverdue.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{metrics.highValueOverdue.length - 5} more high-value customers need attention
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Customers (15+ days) */}
      {metrics.customersNotContacted15Days.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning-foreground" />
              Customers Not Contacted (15+ Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {metrics.customersNotContacted15Days.slice(0, 10).map((customer) => {
                const isHighlyOverdue = (customer.days_since_last_contact || 999) > 30;
                
                return (
                  <div
                    key={customer.customer_id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isHighlyOverdue 
                        ? "bg-destructive/5 border-destructive/30" 
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${isHighlyOverdue ? "text-destructive" : ""}`}>
                        {customer.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatINR(customer.total_lifetime_sales)}</span>
                        {isAdminOrAccounts && customer.assigned_salesperson_name && (
                          <span className="text-xs">• {customer.assigned_salesperson_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={isHighlyOverdue ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {customer.days_since_last_contact !== null
                          ? `${customer.days_since_last_contact} days`
                          : "Never"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {metrics.customersNotContacted15Days.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{metrics.customersNotContacted15Days.length - 10} more customers overdue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All clear message */}
      {metrics.highValueOverdue.length === 0 && metrics.customersNotContacted15Days.length === 0 && (
        <Card className="border-accent bg-accent/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-accent/10 mb-3">
                <Users className="h-6 w-6 text-accent-foreground" />
              </div>
              <p className="font-medium text-accent-foreground">All customers are up to date!</p>
              <p className="text-sm text-muted-foreground">No overdue follow-ups at this time.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
