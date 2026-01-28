import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, Users, AlertTriangle, Crown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatters";
import { format, isToday, differenceInDays, startOfDay } from "date-fns";

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
}

export function SalespersonDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    callsMadeToday: 0,
    customersContactedToday: 0,
    customersNotContacted15Days: [],
    highValueOverdue: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        const todayStart = startOfDay(new Date()).toISOString();

        // Fetch calls made today (interactions logged today by this user)
        const { data: todayInteractions, error: interactionsError } = await supabase
          .from("interactions")
          .select("id, customer_id")
          .gte("interaction_datetime", todayStart)
          .eq("salesperson_id", user.id);

        if (interactionsError) throw interactionsError;

        const callsMadeToday = todayInteractions?.length || 0;
        const uniqueCustomersToday = new Set(todayInteractions?.map(i => i.customer_id) || []);
        const customersContactedToday = uniqueCustomersToday.size;

        // Fetch customer analytics for overdue calculations
        const { data: analyticsData, error: analyticsError } = await supabase
          .from("customer_analytics")
          .select("customer_id, name, phone, total_lifetime_sales, days_since_last_contact, last_contacted_date")
          .eq("dnd", false);

        if (analyticsError) throw analyticsError;

        // Filter customers not contacted in more than 15 days
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

        // Filter high-value customers (>50,000) not contacted in last 10 days
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
      } catch (error: any) {
        console.error("Failed to fetch dashboard metrics:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

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
                <p className="text-xs text-muted-foreground">Calls Today</p>
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
                <p className="text-xs text-muted-foreground">Contacted Today</p>
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
                      <p className="text-sm text-muted-foreground">
                        {formatINR(customer.total_lifetime_sales)}
                      </p>
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
