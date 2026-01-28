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
}

interface TodaysCallListProps {
  onPhoneClick?: () => void;
}

export function TodaysCallList({ onPhoneClick }: TodaysCallListProps) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerAnalytics[]>([]);
  const [lastInteractions, setLastInteractions] = useState<Map<string, LastInteraction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);

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

      // Fetch last interaction for each customer
      const customerIds = (analyticsData || []).map((c) => c.customer_id);
      
      if (customerIds.length > 0) {
        // Get the most recent interaction per customer
        const { data: interactionsData, error: interactionsError } = await supabase
          .from("interactions")
          .select("customer_id, notes, interaction_datetime")
          .in("customer_id", customerIds)
          .order("interaction_datetime", { ascending: false });

        if (!interactionsError && interactionsData) {
          // Group by customer_id, keep only first (most recent)
          const interactionsMap = new Map<string, LastInteraction>();
          interactionsData.forEach((interaction) => {
            if (!interactionsMap.has(interaction.customer_id)) {
              interactionsMap.set(interaction.customer_id, interaction);
            }
          });
          setLastInteractions(interactionsMap);
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
  }, [user]);

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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Today's Call List
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              {customers.length} customers
            </span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sorted by priority score • Non-DND customers only
          </p>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customers to call today
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer, index) => {
                const lastInteraction = lastInteractions.get(customer.customer_id);
                
                return (
                  <div
                    key={customer.customer_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    {/* Rank & Customer Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{customer.name}</span>
                          {getPriorityBadge(customer.priority_score)}
                        </div>
                        
                        {/* Stats Row */}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IndianRupee className="h-3 w-3" />
                            {formatINR(customer.total_lifetime_sales)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {customer.days_since_last_contact !== null
                              ? `${customer.days_since_last_contact}d ago`
                              : "Never contacted"}
                          </span>
                          {customer.assigned_salesperson_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {customer.assigned_salesperson_name}
                            </span>
                          )}
                        </div>

                        {/* Last Note Preview */}
                        {lastInteraction && (
                          <p className="mt-2 text-xs text-muted-foreground italic bg-muted/50 px-2 py-1 rounded">
                            "{truncateNotes(lastInteraction.notes)}"
                          </p>
                        )}
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
