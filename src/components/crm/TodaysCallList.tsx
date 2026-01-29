import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, MessageSquarePlus, IndianRupee, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/formatters";
import { LogInteractionDialog } from "./LogInteractionDialog";
import { DateRangeFilter, DateRangeType, getDateRangeLabel } from "./DateRangeFilter";
import { format } from "date-fns";

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
}

interface LastInteraction {
  customer_id: string;
  notes: string;
  interaction_datetime: string;
  interaction_type: string;
  interaction_outcome: string;
}

interface TodaysCallListProps {
  onPhoneClick?: () => void;
}

export function TodaysCallList({ onPhoneClick }: TodaysCallListProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerAnalytics[]>([]);
  const [dayInteractions, setDayInteractions] = useState<Map<string, LastInteraction[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  
  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateRangeType>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  // Calculate the selected date based on filter
  const selectedDate = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") {
      return now;
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    } else if (dateFilter === "custom" && customDate) {
      return customDate;
    }
    return now;
  }, [dateFilter, customDate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch customer analytics sorted by priority
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("customer_analytics")
        .select("*")
        .eq("dnd", false) // Exclude DND customers
        .order("priority_score", { ascending: false })
        .order("total_lifetime_sales", { ascending: false })
        .order("days_since_last_contact", { ascending: false, nullsFirst: false });

      if (analyticsError) throw analyticsError;

      // Fetch interactions for the selected date
      const customerIds = (analyticsData || []).map((c) => c.customer_id);
      
      if (customerIds.length > 0) {
        // Build date range for the selected day
        const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
        const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999);

        // Get interactions for the selected day
        const { data: interactionsData, error: interactionsError } = await supabase
          .from("interactions")
          .select("customer_id, notes, interaction_datetime, interaction_type, interaction_outcome")
          .in("customer_id", customerIds)
          .gte("interaction_datetime", dayStart.toISOString())
          .lte("interaction_datetime", dayEnd.toISOString())
          .order("interaction_datetime", { ascending: false });

        if (!interactionsError && interactionsData) {
          // Group all interactions by customer_id
          const interactionsMap = new Map<string, LastInteraction[]>();
          interactionsData.forEach((interaction) => {
            const existing = interactionsMap.get(interaction.customer_id) || [];
            existing.push(interaction);
            interactionsMap.set(interaction.customer_id, existing);
          });
          setDayInteractions(interactionsMap);
        }
      }

      setCustomers(analyticsData || []);
    } catch (error: any) {
      console.error("Failed to fetch call list:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedDate]);

  const handleInteractionLogged = () => {
    setSelectedCustomer(null);
    fetchData(); // Refresh the list
  };

  const handlePhoneClick = (phone: string) => {
    onPhoneClick?.();
    window.location.href = `tel:${phone}`;
  };

  const truncateNotes = (notes: string, maxLength: number = 50) => {
    if (notes.length <= maxLength) return notes;
    return notes.substring(0, maxLength) + "...";
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 10000) {
      return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
    } else if (score >= 1000) {
      return <Badge className="text-xs bg-warning text-warning-foreground">Medium</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">Normal</Badge>;
    }
  };

  // Get customers who had interactions on selected date
  const customersWithInteractions = useMemo(() => {
    return customers.filter(c => dayInteractions.has(c.customer_id));
  }, [customers, dayInteractions]);

  // Total interactions count for the day
  const totalInteractions = useMemo(() => {
    let count = 0;
    dayInteractions.forEach(interactions => {
      count += interactions.length;
    });
    return count;
  }, [dayInteractions]);

  const dateLabel = useMemo(() => {
    if (dateFilter === "today") return "Today";
    if (dateFilter === "yesterday") return "Yesterday";
    return format(selectedDate, "dd MMM yyyy");
  }, [dateFilter, selectedDate]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Activity
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
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Call Activity - {dateLabel}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {customersWithInteractions.length} customers contacted • {totalInteractions} interactions
              </p>
            </div>
            <DateRangeFilter
              value={dateFilter}
              onChange={setDateFilter}
              customDate={customDate}
              onCustomDateChange={setCustomDate}
              showDayFilters={true}
            />
          </div>
        </CardHeader>
        <CardContent>
          {customersWithInteractions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No call activity recorded for {dateLabel.toLowerCase()}
            </div>
          ) : (
            <div className="space-y-3">
              {customersWithInteractions.map((customer, index) => {
                const customerInteractions = dayInteractions.get(customer.customer_id) || [];
                
                return (
                  <div
                    key={customer.customer_id}
                    className="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    {/* Customer Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{customer.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {customerInteractions.length} call{customerInteractions.length !== 1 ? 's' : ''}
                            </Badge>
                            {getPriorityBadge(customer.priority_score)}
                          </div>
                          
                          {/* Stats Row */}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <IndianRupee className="h-3 w-3" />
                              {formatINR(customer.total_lifetime_sales)}
                            </span>
                            {customer.assigned_salesperson_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {customer.assigned_salesperson_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handlePhoneClick(customer.phone)}
                        >
                          <Phone className="h-4 w-4" />
                          <span className="hidden sm:inline">Call</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() => setSelectedCustomer({ 
                            id: customer.customer_id, 
                            name: customer.name 
                          })}
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                          <span className="hidden sm:inline">Log</span>
                        </Button>
                      </div>
                    </div>

                    {/* Day's Interactions */}
                    <div className="ml-11 space-y-2">
                      {customerInteractions.map((interaction, i) => (
                        <div key={i} className="text-sm bg-muted/50 px-3 py-2 rounded">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(interaction.interaction_datetime), "hh:mm a")}
                            <Badge variant="outline" className="text-xs capitalize">
                              {interaction.interaction_type.replace('_', ' ')}
                            </Badge>
                            <Badge 
                              variant={interaction.interaction_outcome === 'order_placed' ? 'default' : 'secondary'} 
                              className="text-xs capitalize"
                            >
                              {interaction.interaction_outcome.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground italic">"{truncateNotes(interaction.notes, 100)}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
