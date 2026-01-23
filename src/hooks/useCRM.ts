import { useState, useEffect, useMemo } from "react";
import { Customer, Purchase, CustomerWithPurchases, SEGMENTS, SegmentPeriod } from "@/types/crm";
import { getDaysBetween } from "@/lib/formatters";

const STORAGE_KEYS = {
  customers: "crm_customers",
  purchases: "crm_purchases",
};

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function useCRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.customers);
    const storedPurchases = localStorage.getItem(STORAGE_KEYS.purchases);

    if (storedCustomers) {
      setCustomers(JSON.parse(storedCustomers));
    }
    if (storedPurchases) {
      setPurchases(JSON.parse(storedPurchases));
    }
    setIsLoading(false);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
    }
  }, [customers, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.purchases, JSON.stringify(purchases));
    }
  }, [purchases, isLoading]);

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
      "7d": [],
      "15d": [],
      "30d": [],
      "3m": [],
      "6m": [],
      "12m": [],
      "over": [],
    };

    customersWithPurchases.forEach((customer) => {
      if (customer.daysSinceLastPurchase === null) {
        // Customers with no purchases go to "over" segment
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
      const totalAmount = segmentCustomers.reduce(
        (sum, c) => sum + c.totalPurchaseAmount, 
        0
      );
      
      return {
        ...segment,
        count: segmentCustomers.length,
        totalAmount,
        customers: segmentCustomers,
      };
    });
  }, [segmentedCustomers]);

  // Add customer
  const addCustomer = (data: Omit<Customer, "id" | "createdAt">) => {
    const newCustomer: Customer = {
      ...data,
      id: generateId(),
      createdAt: new Date(),
    };
    setCustomers((prev) => [...prev, newCustomer]);
    return newCustomer;
  };

  // Bulk import customers with duplicate handling
  const importCustomers = (
    customersData: Array<Omit<Customer, "id" | "createdAt">>,
    overwrite: boolean = false
  ): { imported: number; skipped: number; updated: number } => {
    const existingMobiles = new Set(customers.map(c => c.mobileNo));
    let imported = 0;
    let skipped = 0;
    let updated = 0;

    const newCustomers: Customer[] = [];
    const updatedCustomers: Customer[] = [];

    customersData.forEach((data) => {
      if (existingMobiles.has(data.mobileNo)) {
        if (overwrite) {
          updatedCustomers.push({
            ...data,
            id: customers.find(c => c.mobileNo === data.mobileNo)!.id,
            createdAt: customers.find(c => c.mobileNo === data.mobileNo)!.createdAt,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        newCustomers.push({
          ...data,
          id: generateId(),
          createdAt: new Date(),
        });
        imported++;
      }
    });

    setCustomers((prev) => {
      let result = [...prev];
      // Update existing customers
      updatedCustomers.forEach((updated) => {
        result = result.map(c => c.id === updated.id ? updated : c);
      });
      // Add new customers
      return [...result, ...newCustomers];
    });

    return { imported, skipped, updated };
  };

  // Bulk import purchases with duplicate handling
  const importPurchases = (
    purchasesData: Array<{
      customerMobile: string;
      amount: number;
      date: Date;
      description?: string;
    }>,
    mobileLookup: Map<string, string>,
    overwrite: boolean = false
  ): { imported: number; skipped: number; updated: number } => {
    // Create a map of existing purchase signatures
    const existingPurchaseMap = new Map<string, string>(); // signature -> purchaseId
    purchases.forEach(p => {
      const signature = `${p.customerId}-${p.amount}-${new Date(p.date).toDateString()}`;
      existingPurchaseMap.set(signature, p.id);
    });

    let imported = 0;
    let skipped = 0;
    let updated = 0;

    const newPurchases: Purchase[] = [];
    const updatedPurchases: Purchase[] = [];

    purchasesData.forEach((data) => {
      const customerId = mobileLookup.get(data.customerMobile);
      if (!customerId) return;

      const signature = `${customerId}-${data.amount}-${new Date(data.date).toDateString()}`;
      const existingId = existingPurchaseMap.get(signature);

      if (existingId) {
        if (overwrite) {
          updatedPurchases.push({
            id: existingId,
            customerId,
            amount: data.amount,
            date: data.date,
            description: data.description,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        newPurchases.push({
          id: generateId(),
          customerId,
          amount: data.amount,
          date: data.date,
          description: data.description,
        });
        imported++;
      }
    });

    setPurchases((prev) => {
      let result = [...prev];
      // Update existing purchases
      updatedPurchases.forEach((updated) => {
        result = result.map(p => p.id === updated.id ? updated : p);
      });
      // Add new purchases
      return [...result, ...newPurchases];
    });

    return { imported, skipped, updated };
  };

  // Get customer mobile -> id lookup map
  const getCustomerMobileLookup = (): Map<string, string> => {
    const lookup = new Map<string, string>();
    customers.forEach((c) => {
      lookup.set(c.mobileNo, c.id);
    });
    return lookup;
  };

  // Get set of existing customer mobiles
  const getExistingCustomerMobiles = (): Set<string> => {
    return new Set(customers.map(c => c.mobileNo));
  };

  // Get existing purchases for duplicate checking
  const getExistingPurchases = (): Array<{ customerId: string; amount: number; date: Date }> => {
    return purchases.map(p => ({
      customerId: p.customerId,
      amount: p.amount,
      date: new Date(p.date),
    }));
  };

  // Update customer
  const updateCustomer = (id: string, data: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
  };

  // Delete customer
  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setPurchases((prev) => prev.filter((p) => p.customerId !== id));
  };

  // Add purchase
  const addPurchase = (data: Omit<Purchase, "id">) => {
    const newPurchase: Purchase = {
      ...data,
      id: generateId(),
    };
    setPurchases((prev) => [...prev, newPurchase]);
    return newPurchase;
  };

  // Delete purchase
  const deletePurchase = (id: string) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
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

    return {
      totalCustomers,
      totalPurchases,
      totalRevenue,
      avgPurchaseValue,
    };
  }, [customers, purchases]);

  return {
    customers: customersWithPurchases,
    purchases,
    segmentedCustomers,
    segmentStats,
    stats,
    isLoading,
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
  };
}
