import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Customer, Purchase, CustomerWithPurchases, SEGMENTS, SegmentPeriod } from "@/types/crm";
import { getDaysBetween } from "@/lib/formatters";
import { toast } from "sonner";
import { getSafeErrorMessage, logError } from "@/lib/errorHandler";
import { toDbDateString } from "@/lib/dateImport";

const PAGE_SIZE = 1000;

// PostgREST enforces a server-side max-rows (commonly 1000). To fetch beyond that,
// we must paginate using .range().
type CRMTableName = "customers" | "transactions";

async function fetchAllRows<T>(
  table: CRMTableName,
  select: string,
  orderColumns: string[] = ["created_at", "id"],
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;

  // Safety guard to avoid runaway loops in case of unexpected API behavior
  const maxPages = 500;
  for (let page = 0; page < maxPages; page++) {
    let q: any = supabase.from(table).select(select);
    orderColumns.forEach((col) => {
      q = q.order(col, { ascending: true });
    });

    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;

    const rows = (data ?? []) as T[];
    out.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

interface DBCustomer {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  mobile_no: string;
  created_at: string;
  assigned_to: string | null;
  created_by: string | null;
  dnd: boolean;
  is_critical: boolean;
}

interface DBTransaction {
  id: string;
  customer_id: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

function mapDBCustomer(db: DBCustomer, profilesMap?: Map<string, string>): Customer {
  return {
    id: db.id,
    name: db.name,
    address: db.address ?? "",
    city: db.city ?? "",
    mobileNo: db.mobile_no,
    createdAt: new Date(db.created_at),
    assignedTo: db.assigned_to,
    assignedToName: db.assigned_to && profilesMap ? profilesMap.get(db.assigned_to) : null,
    dnd: db.dnd,
    isCritical: db.is_critical,
  };
}

function mapDBPurchase(db: DBTransaction): Purchase {
  return {
    id: db.id,
    customerId: db.customer_id,
    amount: Number(db.amount),
    date: new Date(db.transaction_date),
    description: db.description ?? undefined,
  };
}

export function useSupabaseCRM() {
  const { user, isAdminOrAccounts } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [salesTeamMembers, setSalesTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const fetchData = useCallback(async (isInitialLoad = false) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const [customersData, transactionsData, profilesRes, rolesRes] = await Promise.all([
        fetchAllRows<DBCustomer>("customers", "*"),
        fetchAllRows<DBTransaction>("transactions", "*"),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      // Create a map of user_id to full_name
      const profilesMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p) => {
        profilesMap.set(p.user_id, p.full_name);
      });

      // Get sales team members (all users with sales_team role)
      const salesTeam = (rolesRes.data || [])
        .filter((r) => r.role === "sales_team")
        .map((r) => ({
          id: r.user_id,
          name: profilesMap.get(r.user_id) || "Unknown",
        }));
      setSalesTeamMembers(salesTeam);

      setCustomers((customersData || []).map((c) => mapDBCustomer(c, profilesMap)));
      setPurchases((transactionsData || []).map(mapDBPurchase));

      hasLoadedOnceRef.current = true;
    } catch (error: unknown) {
      logError('fetchData', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      isFetchingRef.current = false;
      if (isInitialLoad) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []); // Remove user dependency - we check inside

  // Handle user changes and initial load
  useEffect(() => {
    const userId = user?.id ?? null;
    
    if (!userId) {
      // User logged out - reset state
      if (hasLoadedOnceRef.current || lastUserIdRef.current) {
        hasLoadedOnceRef.current = false;
        lastUserIdRef.current = null;
        setCustomers([]);
        setPurchases([]);
        setSalesTeamMembers([]);
        setIsLoading(false);
      }
      return;
    }

    // User changed or first load
    if (lastUserIdRef.current !== userId || !hasLoadedOnceRef.current) {
      lastUserIdRef.current = userId;
      fetchData(true);
    }
  }, [user?.id, fetchData]);

  // Compute customers with purchase data
  const customersWithPurchases = useMemo((): CustomerWithPurchases[] => {
    const today = new Date();
    
    return customers.map((customer) => {
      const customerPurchases = purchases.filter((p) => p.customerId === customer.id);
      const totalPurchaseAmount = customerPurchases.reduce((sum, p) => sum + p.amount, 0);
      
      const sortedPurchases = [...customerPurchases].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      const lastPurchaseDate = sortedPurchases.length > 0 
        ? new Date(sortedPurchases[0].date) 
        : null;
      
      const daysSinceLastPurchase = lastPurchaseDate 
        ? getDaysBetween(today, lastPurchaseDate)
        : null;

      return {
        ...customer,
        purchases: customerPurchases,
        totalPurchaseAmount,
        lastPurchaseDate,
        daysSinceLastPurchase,
      };
    });
  }, [customers, purchases]);

  // Segment customers by last purchase date
  const segmentedCustomers = useMemo(() => {
    const segments: Record<SegmentPeriod, CustomerWithPurchases[]> = {
      "7d": [], "15d": [], "30d": [], "3m": [], "6m": [], "12m": [], "over": [],
    };

    customersWithPurchases.forEach((customer) => {
      if (customer.daysSinceLastPurchase === null) {
        segments.over.push(customer);
        return;
      }

      const days = customer.daysSinceLastPurchase;
      const segment = SEGMENTS.find((s) => days >= s.minDays && days <= s.maxDays);
      
      if (segment) {
        segments[segment.id].push(customer);
      }
    });

    return segments;
  }, [customersWithPurchases]);

  // Segment statistics
  const segmentStats = useMemo(() => {
    return SEGMENTS.map((segment) => {
      const segmentCustomers = segmentedCustomers[segment.id];
      const totalAmount = segmentCustomers.reduce((sum, c) => sum + c.totalPurchaseAmount, 0);
      
      return {
        ...segment,
        count: segmentCustomers.length,
        totalAmount,
        customers: segmentCustomers,
      };
    });
  }, [segmentedCustomers]);

  // Add customer
  const addCustomer = async (data: Omit<Customer, "id" | "createdAt"> & { assignedTo?: string | null }) => {
    if (!user) return null;
    
    const { data: newCustomer, error } = await supabase
      .from("customers")
      .insert({
        name: data.name,
        address: data.address || null,
        city: data.city || null,
        mobile_no: data.mobileNo,
        assigned_to: data.assignedTo !== undefined ? data.assignedTo : user.id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logError('addCustomer', error);
      toast.error(getSafeErrorMessage(error));
      return null;
    }

    const mapped = mapDBCustomer(newCustomer);
    setCustomers((prev) => [...prev, mapped]);
    toast.success("Customer added successfully!");
    return mapped;
  };

  // Update customer
  const updateCustomer = async (id: string, data: Partial<Customer>) => {
    const updateData: Record<string, any> = {};
    if (data.name) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.mobileNo) updateData.mobile_no = data.mobileNo;

    const { error } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", id);

    if (error) {
      logError('updateCustomer', error);
      toast.error(getSafeErrorMessage(error));
      return;
    }

    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
    toast.success("Customer updated!");
  };

  // Delete customer
  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      logError('deleteCustomer', error);
      toast.error(getSafeErrorMessage(error));
      return;
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setPurchases((prev) => prev.filter((p) => p.customerId !== id));
    toast.success("Customer deleted!");
  };

  // Add purchase
  const addPurchase = async (data: Omit<Purchase, "id">) => {
    if (!user) return null;

    const { data: newPurchase, error } = await supabase
      .from("transactions")
      .insert({
        customer_id: data.customerId,
        amount: data.amount,
        transaction_date: toDbDateString(new Date(data.date)),
        description: data.description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logError('addPurchase', error);
      toast.error(getSafeErrorMessage(error));
      return null;
    }

    const mapped = mapDBPurchase(newPurchase);
    setPurchases((prev) => [...prev, mapped]);
    toast.success("Sale added successfully!");
    return mapped;
  };

  // Delete purchase
  const deletePurchase = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      logError('deletePurchase', error);
      toast.error(getSafeErrorMessage(error));
      return;
    }

    setPurchases((prev) => prev.filter((p) => p.id !== id));
    toast.success("Sale deleted!");
  };

  // Get customer by ID
  const getCustomer = (id: string): CustomerWithPurchases | undefined => {
    return customersWithPurchases.find((c) => c.id === id);
  };

  // Summary stats
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalPurchases = purchases.length;
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);
    const avgPurchaseValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

    return { totalCustomers, totalPurchases, totalRevenue, avgPurchaseValue };
  }, [customers, purchases]);

  // Bulk import (simplified for Supabase)
  const importCustomers = async (
    customersData: Array<Omit<Customer, "id" | "createdAt"> & { assignedTo?: string | null }>,
    overwrite: boolean = false
  ): Promise<{ imported: number; skipped: number; updated: number; errors: string[] }> => {
    if (!user) return { imported: 0, skipped: 0, updated: 0, errors: [] };

    const existingMobiles = new Set(customers.map(c => c.mobileNo));
    let imported = 0, skipped = 0, updated = 0;
    const errors: string[] = [];

    for (const data of customersData) {
      if (existingMobiles.has(data.mobileNo)) {
        if (overwrite) {
          const existing = customers.find(c => c.mobileNo === data.mobileNo);
          if (existing) {
            const { error } = await supabase
              .from("customers")
              .update({
                name: data.name,
                address: data.address || null,
                city: data.city || null,
                assigned_to: data.assignedTo !== undefined ? data.assignedTo : existing.assignedTo,
              })
              .eq("id", existing.id);

            if (error) {
              errors.push(`Failed to update ${data.mobileNo}: ${error.message}`);
            } else {
              updated++;
            }
          }
        } else {
          skipped++;
        }
      } else {
        const result = await addCustomer(data);
        if (result) {
          imported++;
          existingMobiles.add(data.mobileNo); // Prevent duplicate inserts within batch
        } else {
          errors.push(`Failed to add customer: ${data.mobileNo}`);
        }
      }
    }

    await fetchData();
    return { imported, skipped, updated, errors };
  };

  const importPurchases = async (
    purchasesData: Array<{ customerMobile: string; amount: number; date: Date; description?: string }>,
    mobileLookup: Map<string, string>,
    overwrite: boolean = false
  ): Promise<{ imported: number; skipped: number; updated: number; errors: string[] }> => {
    if (!user) return { imported: 0, skipped: 0, updated: 0, errors: [] };

    let imported = 0, skipped = 0, updated = 0;
    const errors: string[] = [];

    // Create a lookup for existing purchases by signature
    const existingSignatures = new Map<string, string>();
    purchases.forEach(p => {
      const sig = `${p.customerId}-${p.amount}-${new Date(p.date).toDateString()}`;
      existingSignatures.set(sig, p.id);
    });

    for (const data of purchasesData) {
      const customerId = mobileLookup.get(data.customerMobile);
      if (!customerId) {
        errors.push(`Customer not found: ${data.customerMobile}`);
        continue;
      }

      const dateStr = new Date(data.date).toDateString();
      const signature = `${customerId}-${data.amount}-${dateStr}`;
      const existingId = existingSignatures.get(signature);

      if (existingId) {
        if (overwrite) {
          // Update existing purchase
          const { error } = await supabase
            .from("transactions")
            .update({
              description: data.description || null,
              transaction_date: toDbDateString(new Date(data.date)),
            })
            .eq("id", existingId);

          if (error) {
            errors.push(`Failed to update sale for ${data.customerMobile}: ${error.message}`);
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        const result = await addPurchase({
          customerId,
          amount: data.amount,
          date: data.date,
          description: data.description,
        });
        
        if (result) {
          imported++;
          // Add to existing signatures to prevent duplicate inserts within the same batch
          existingSignatures.set(signature, result.id);
        } else {
          errors.push(`Failed to add sale for ${data.customerMobile}`);
        }
      }
    }

    await fetchData();
    return { imported, skipped, updated, errors };
  };

  const getCustomerMobileLookup = (): Map<string, string> => {
    const lookup = new Map<string, string>();
    customers.forEach((c) => lookup.set(c.mobileNo, c.id));
    return lookup;
  };

  const getExistingCustomerMobiles = (): Set<string> => {
    return new Set(customers.map(c => c.mobileNo));
  };

  const getExistingPurchases = (): Array<{ customerId: string; amount: number; date: Date }> => {
    return purchases.map(p => ({ customerId: p.customerId, amount: p.amount, date: new Date(p.date) }));
  };

  // Assign customer to a sales team member (Super Admin or Accounts - enforced by DB trigger)
  const assignCustomer = async (customerId: string, salesUserId: string | null) => {
    const { error } = await supabase
      .from("customers")
      .update({ assigned_to: salesUserId })
      .eq("id", customerId);

    if (error) {
      logError('assignCustomer', error);
      toast.error(getSafeErrorMessage(error));
      return false;
    }

    toast.success("Customer assigned successfully!");
    await fetchData();
    return true;
  };

  // Bulk assign customers to a sales team member
  const bulkAssignCustomers = async (customerIds: string[], salesUserId: string | null) => {
    const { error } = await supabase
      .from("customers")
      .update({ assigned_to: salesUserId })
      .in("id", customerIds);

    if (error) {
      logError('bulkAssignCustomers', error);
      toast.error(getSafeErrorMessage(error));
      return false;
    }

    toast.success(`${customerIds.length} customer${customerIds.length !== 1 ? "s" : ""} assigned successfully!`);
    await fetchData();
    return true;
  };

  // Toggle DND status for a customer (Super Admin/Accounts only - enforced by RLS)
  const toggleDND = async (customerId: string, dndStatus: boolean) => {
    const { error } = await supabase
      .from("customers")
      .update({ dnd: dndStatus })
      .eq("id", customerId);

    if (error) {
      logError('toggleDND', error);
      toast.error(getSafeErrorMessage(error));
      return false;
    }

    toast.success(dndStatus ? "Customer marked as DND" : "DND status removed");
    await fetchData();
    return true;
  };

  // Toggle Critical status for a customer (Super Admin only)
  const toggleCritical = async (customerId: string, criticalStatus: boolean) => {
    const { error } = await supabase
      .from("customers")
      .update({ is_critical: criticalStatus })
      .eq("id", customerId);

    if (error) {
      logError('toggleCritical', error);
      toast.error(getSafeErrorMessage(error));
      return false;
    }

    toast.success(criticalStatus ? "Customer marked as Critical" : "Critical status removed");
    await fetchData();
    return true;
  };

  // Bulk toggle critical status
  const bulkToggleCritical = async (customerIds: string[], criticalStatus: boolean) => {
    const { error } = await supabase
      .from("customers")
      .update({ is_critical: criticalStatus })
      .in("id", customerIds);

    if (error) {
      logError('bulkToggleCritical', error);
      toast.error(getSafeErrorMessage(error));
      return false;
    }

    toast.success(`${customerIds.length} customer${customerIds.length !== 1 ? "s" : ""} ${criticalStatus ? "marked as Critical" : "unmarked"}`);
    await fetchData();
    return true;
  };

  return {
    customers: customersWithPurchases,
    purchases,
    segmentedCustomers,
    segmentStats,
    stats,
    isLoading,
    isRefreshing,
    salesTeamMembers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addPurchase,
    deletePurchase,
    getCustomer,
    importCustomers,
    importPurchases,
    getCustomerMobileLookup,
    getExistingCustomerMobiles,
    getExistingPurchases,
    assignCustomer,
    bulkAssignCustomers,
    toggleDND,
    toggleCritical,
    bulkToggleCritical,
    refetch: fetchData,
  };
}
