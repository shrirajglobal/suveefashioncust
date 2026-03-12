import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, MessageSquarePlus, MessageCircle, IndianRupee, Clock, User, Calendar, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatters";
import { LogInteractionDialog } from "./LogInteractionDialog";
import { format } from "date-fns";
import { DateRangeFilter, DateRangeType, getDateRange, getDateRangeLabel } from "./DateRangeFilter";

interface CustomerAnalytics {
  customer_id: string;
  name: string;
  phone: string;
  city: string | null;
  assigned_salesperson_id: string | null;
  assigned_salesperson_name: string | null;
  last_contacted_date: string | null;
  days_since_last_contact: number | null;
  total_lifetime_sales: number;
  last_order_date: string | null;
  priority_score: number;
  dnd: boolean;
  is_critical?: boolean;
}

interface TodaysCallListProps {
  onPhoneClick?: () => void;
}

type CustomerWithStatus = CustomerAnalytics & {
  contactedToday: boolean;
  hasFollowupToday: boolean;
  todayInteractionCount: number;
};

export function TodaysCallList({ onPhoneClick }: TodaysCallListProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeType>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  // Get the selected date for querying
  const selectedDate = useMemo(() => {
    const { start } = getDateRange(dateRange, customDate);
    return start;
  }, [dateRange, customDate]);

  const dateRangeLabel = useMemo(() => getDateRangeLabel(dateRange, customDate), [dateRange, customDate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Get the selected date range
      const { start, end } = getDateRange(dateRange, customDate);
      const dateStr = format(start, "yyyy-MM-dd");

      // Fetch customer analytics (all non-DND customers)
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("customer_analytics")
        .select("*")
        .eq("dnd", false);

      if (analyticsError) throw analyticsError;

      const customerIds = (analyticsData || []).map((c) => c.customer_id);
      
      if (customerIds.length === 0) {
        setCustomers([]);
        return;
      }

      // Fetch interactions for the selected date to know who was contacted
      const { data: dateInteractions, error: interactionsError } = await supabase
        .from("interactions")
        .select("customer_id")
        .in("customer_id", customerIds)
        .gte("interaction_datetime", start.toISOString())
        .lte("interaction_datetime", end.toISOString());

      if (interactionsError) throw interactionsError;

      // Count interactions per customer for selected date
      const dateContactMap = new Map<string, number>();
      (dateInteractions || []).forEach((interaction) => {
        const count = dateContactMap.get(interaction.customer_id) || 0;
        dateContactMap.set(interaction.customer_id, count + 1);
      });

      // Fetch customers with next_followup_date = selected date
      const { data: followupData, error: followupError } = await supabase
        .from("interactions")
        .select("customer_id")
        .eq("next_followup_date", dateStr)
        .in("customer_id", customerIds);

      if (followupError) throw followupError;

      const followupSet = new Set((followupData || []).map((f) => f.customer_id));

      // Combine data and apply filtering
      const enrichedCustomers: CustomerWithStatus[] = (analyticsData || [])
        .map((customer) => ({
          ...customer,
          contactedToday: dateContactMap.has(customer.customer_id),
          todayInteractionCount: dateContactMap.get(customer.customer_id) || 0,
          hasFollowupToday: followupSet.has(customer.customer_id),
        }))
        .filter((customer) => {
          // RULE 1: If customer has a follow-up date set for today, always show them
          if (customer.hasFollowupToday) {
            return true;
          }
          
          // RULE 2: Only show customers who haven't been contacted in the last 15 days
          // days_since_last_contact is null means never contacted - should show
          // days_since_last_contact >= 15 means 15+ days since last contact - should show
          const daysSinceContact = customer.days_since_last_contact;
          if (daysSinceContact === null || daysSinceContact >= 15) {
            return true;
          }
          
          // Otherwise, don't show (contacted within last 15 days without followup)
          return false;
        });

      // Sort customers:
      // 1. Critical customers always first
      // 2. Customers with followup today (not yet contacted) 
      // 3. Uncontacted customers by priority_score
      // 4. Contacted customers at the bottom
      enrichedCustomers.sort((a, b) => {
        // Critical customers first
        const aCritical = a.is_critical ? 1 : 0;
        const bCritical = b.is_critical ? 1 : 0;
        if (aCritical !== bCritical) return bCritical - aCritical;

        // Then by contact status
        // Priority: followup today (not contacted) > not contacted > contacted
        const aScore = getContactPriorityScore(a);
        const bScore = getContactPriorityScore(b);
        
        if (aScore !== bScore) return bScore - aScore;

        // Within same priority tier, sort by priority_score (higher first)
        return (b.priority_score || 0) - (a.priority_score || 0);
      });

      setCustomers(enrichedCustomers);
    } catch (error: any) {
      console.error("Failed to fetch call list:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Priority score for sorting: higher = should appear first
  const getContactPriorityScore = (customer: CustomerWithStatus): number => {
    if (customer.hasFollowupToday && !customer.contactedToday) {
      return 3; // Followup due today, not yet contacted - highest priority
    }
    if (!customer.contactedToday) {
      return 2; // Not contacted today - second priority
    }
    return 1; // Already contacted - lowest priority
  };

  useEffect(() => {
    fetchData();
  }, [user, dateRange, customDate]);

  const handleInteractionLogged = () => {
    setSelectedCustomer(null);
    fetchData(); // Refresh the list
  };

  const handlePhoneClick = (phone: string) => {
    onPhoneClick?.();
    window.location.href = `tel:${phone}`;
  };

  const getPriorityBadge = (customer: CustomerWithStatus) => {
    if (customer.hasFollowupToday && !customer.contactedToday) {
      return <Badge className="text-xs bg-accent text-accent-foreground">Follow-up Due</Badge>;
    }
    if (customer.is_critical) {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    }
    if ((customer.priority_score || 0) >= 10000) {
      return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
    }
    if ((customer.priority_score || 0) >= 1000) {
      return <Badge className="text-xs bg-warning text-warning-foreground">Medium</Badge>;
    }
    return null;
  };

  // Separate pending and completed calls
  const pendingCalls = useMemo(() => 
    customers.filter(c => !c.contactedToday), 
    [customers]
  );
  
  const completedCalls = useMemo(() => 
    customers.filter(c => c.contactedToday),
    [customers]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Today's Call List
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call List
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {dateRangeLabel}: {pendingCalls.length} pending • {completedCalls.length} completed
              </p>
            </div>
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              customDate={customDate}
              onCustomDateChange={setCustomDate}
              showDayFilters
            />
          </div>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customers available for calling today
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Calls Section */}
              {pendingCalls.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Pending Calls ({pendingCalls.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingCalls.map((customer, index) => (
                      <CustomerCallCard
                        key={customer.customer_id}
                        customer={customer}
                        index={index}
                        onPhoneClick={handlePhoneClick}
                        onLogClick={() => setSelectedCustomer({ 
                          id: customer.customer_id, 
                          name: customer.name 
                        })}
                        getPriorityBadge={getPriorityBadge}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Calls Section */}
              {completedCalls.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Completed Today ({completedCalls.length})
                  </h3>
                  <div className="space-y-2 opacity-75">
                    {completedCalls.map((customer, index) => (
                      <CustomerCallCard
                        key={customer.customer_id}
                        customer={customer}
                        index={pendingCalls.length + index}
                        onPhoneClick={handlePhoneClick}
                        onLogClick={() => setSelectedCustomer({ 
                          id: customer.customer_id, 
                          name: customer.name 
                        })}
                        getPriorityBadge={getPriorityBadge}
                        isCompleted
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Interaction Dialog */}
      {selectedCustomer && (
        <LogInteractionDialog
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          open={!!selectedCustomer}
          onOpenChange={(open) => !open && setSelectedCustomer(null)}
          onSuccess={handleInteractionLogged}
        />
      )}
    </>
  );
}

// Extracted component for individual customer card
interface CustomerCallCardProps {
  customer: CustomerWithStatus;
  index: number;
  onPhoneClick: (phone: string) => void;
  onLogClick: () => void;
  getPriorityBadge: (customer: CustomerWithStatus) => React.ReactNode;
  isCompleted?: boolean;
}

function CustomerCallCard({ 
  customer, 
  index, 
  onPhoneClick, 
  onLogClick, 
  getPriorityBadge,
  isCompleted 
}: CustomerCallCardProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors ${
        customer.hasFollowupToday && !customer.contactedToday ? 'border-accent ring-1 ring-accent/20' : ''
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          isCompleted 
            ? 'bg-muted text-muted-foreground' 
            : 'bg-primary/10 text-primary'
        }`}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{customer.name}</span>
            {getPriorityBadge(customer)}
            {isCompleted && customer.todayInteractionCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {customer.todayInteractionCount} call{customer.todayInteractionCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <IndianRupee className="h-3 w-3" />
              {formatINR(customer.total_lifetime_sales || 0)}
            </span>
            {customer.days_since_last_contact !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {customer.days_since_last_contact === 0 
                  ? 'Today' 
                  : `${customer.days_since_last_contact}d ago`}
              </span>
            )}
            {customer.city && (
              <span className="truncate max-w-24">{customer.city}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-10 sm:ml-0">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 h-8"
          onClick={() => onPhoneClick(customer.phone)}
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Call</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 h-8 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
          asChild
        >
          <a
            href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </Button>
        <Button
          size="sm"
          variant="default"
          className="gap-1 h-8"
          onClick={onLogClick}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Log</span>
        </Button>
      </div>
    </div>
  );
}
