import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, startOfMonth, subDays } from "date-fns";

interface WelcomeMetrics {
  userName: string;
  callsMadeToday: number;
  customersContactedToday: number;
  overdueCount: number;
  highValueOverdueCount: number;
  avgDailyCalls: number;
  salesTarget: number;
  salesAchieved: number;
}

export function useWelcomeMetrics() {
  const { user, isAdminOrAccounts } = useAuth();
  const [metrics, setMetrics] = useState<WelcomeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!user || isAdminOrAccounts) {
        setIsLoading(false);
        return;
      }

      try {
        const todayStart = startOfDay(new Date()).toISOString();

        // Fetch user profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, sales_target")
          .eq("user_id", user.id)
          .single();

        // Fetch today's interactions
        const { data: todayInteractions } = await supabase
          .from("interactions")
          .select("id, customer_id")
          .gte("interaction_datetime", todayStart)
          .eq("salesperson_id", user.id);

        const callsMadeToday = todayInteractions?.length || 0;
        const uniqueCustomersToday = new Set(todayInteractions?.map(i => i.customer_id) || []);
        const customersContactedToday = uniqueCustomersToday.size;

        // Fetch last 30 days of interactions for average
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
        const { data: recentInteractions } = await supabase
          .from("interactions")
          .select("id")
          .gte("interaction_datetime", thirtyDaysAgo)
          .eq("salesperson_id", user.id);

        const avgDailyCalls = (recentInteractions?.length || 0) / 30;

        // Fetch this month's sales
        const monthStart = startOfMonth(new Date()).toISOString().split("T")[0];
        const { data: customerIds } = await supabase
          .from("customers")
          .select("id")
          .eq("assigned_to", user.id);

        let salesAchieved = 0;
        if (customerIds && customerIds.length > 0) {
          const { data: monthlyTransactions } = await supabase
            .from("transactions")
            .select("amount")
            .in("customer_id", customerIds.map(c => c.id))
            .gte("transaction_date", monthStart);

          salesAchieved = (monthlyTransactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
        }

        // Fetch customer analytics for overdue counts
        const { data: analyticsData } = await supabase
          .from("customer_analytics")
          .select("customer_id, total_lifetime_sales, days_since_last_contact")
          .eq("dnd", false);

        const overdueCount = (analyticsData || []).filter(
          c => c.days_since_last_contact === null || c.days_since_last_contact > 15
        ).length;

        const highValueOverdueCount = (analyticsData || []).filter(
          c => (c.total_lifetime_sales || 0) > 50000 && 
               (c.days_since_last_contact === null || c.days_since_last_contact > 10)
        ).length;

        setMetrics({
          userName: profileData?.full_name || "Salesperson",
          callsMadeToday,
          customersContactedToday,
          overdueCount,
          highValueOverdueCount,
          avgDailyCalls: Math.round(avgDailyCalls * 10) / 10,
          salesTarget: Number(profileData?.sales_target) || 0,
          salesAchieved,
        });
      } catch (error) {
        console.error("Failed to fetch welcome metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [user, isAdminOrAccounts]);

  return { metrics, isLoading, showWelcome: !isAdminOrAccounts && !!metrics };
}
