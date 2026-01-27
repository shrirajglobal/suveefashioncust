import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { Users, ShoppingBag, IndianRupee, TrendingUp } from "lucide-react";
import { useSupabaseCRM } from "@/hooks/useSupabaseCRM";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR } from "@/lib/formatters";
import { Header } from "@/components/crm/Header";
import { StatCard } from "@/components/crm/StatCard";
import { SegmentCard } from "@/components/crm/SegmentCard";
import { CustomerTable } from "@/components/crm/CustomerTable";
import { AddCustomerForm } from "@/components/crm/AddCustomerForm";
import { AddPurchaseForm } from "@/components/crm/AddPurchaseForm";
import { ImportCSVForm } from "@/components/crm/ImportCSVForm";
import { BulkWhatsAppDialog } from "@/components/crm/BulkWhatsAppDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeFilter, DateRangeType, getDateRange, getDateRangeLabel } from "@/components/crm/DateRangeFilter";

// Memoized stat cards section
const StatsSection = memo(({ stats, dateRangeLabel }: { 
  stats: { totalCustomers: number; totalPurchases: number; totalRevenue: number; avgPurchaseValue: number };
  dateRangeLabel: string;
}) => (
  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard
      title="Total Customers"
      value={stats.totalCustomers}
      icon={Users}
      description="Registered customers"
    />
    <StatCard
      title="Total Purchases"
      value={stats.totalPurchases}
      icon={ShoppingBag}
      description={dateRangeLabel}
    />
    <StatCard
      title="Total Revenue"
      value={formatINR(stats.totalRevenue)}
      icon={IndianRupee}
      description={dateRangeLabel}
    />
    <StatCard
      title="Avg. Purchase"
      value={formatINR(stats.avgPurchaseValue)}
      icon={TrendingUp}
      description="Per transaction"
    />
  </section>
));

StatsSection.displayName = "StatsSection";

// Loading skeleton
const LoadingSkeleton = memo(() => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container mx-auto px-4 py-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </main>
  </div>
));

LoadingSkeleton.displayName = "LoadingSkeleton";

const Index = () => {
  const { isAdminOrAccounts } = useAuth();
  const [dateRange, setDateRange] = useState<DateRangeType>("month");
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem("crm:index:activeTab") ?? "dashboard";
    } catch {
      return "dashboard";
    }
  });
  
  const {
    customers,
    purchases,
    segmentStats,
    isLoading,
    salesTeamMembers,
    addCustomer,
    addPurchase,
    deleteCustomer,
    importCustomers,
    importPurchases,
    getCustomerMobileLookup,
    getExistingCustomerMobiles,
    getExistingPurchases,
    assignCustomer,
    bulkAssignCustomers,
    toggleDND,
  } = useSupabaseCRM();

  // Memoized date range label
  const dateRangeLabel = useMemo(() => getDateRangeLabel(dateRange), [dateRange]);

  // Filter purchases based on selected date range - optimized with useMemo
  const filteredStats = useMemo(() => {
    const { start, end } = getDateRange(dateRange);
    
    const filteredPurchases = purchases.filter((p) => {
      const purchaseDate = new Date(p.date);
      return purchaseDate >= start && purchaseDate <= end;
    });

    const totalCustomers = customers.length;
    const totalPurchases = filteredPurchases.length;
    const totalRevenue = filteredPurchases.reduce((sum, p) => sum + p.amount, 0);
    const avgPurchaseValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

    return { totalCustomers, totalPurchases, totalRevenue, avgPurchaseValue };
  }, [customers.length, purchases, dateRange]);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleDateRangeChange = useCallback((value: DateRangeType) => {
    setDateRange(value);
  }, []);

  // Memoized lookup functions
  const customerLookup = useMemo(() => getCustomerMobileLookup(), [customers]);
  const existingMobiles = useMemo(() => getExistingCustomerMobiles(), [customers]);
  const existingPurchasesList = useMemo(() => getExistingPurchases(), [purchases]);

  // Persist tab so background refresh / remount never snaps back to Dashboard
  useEffect(() => {
    try {
      localStorage.setItem("crm:index:activeTab", activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Date Range Filter */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Dashboard Overview</h2>
            <p className="text-sm text-muted-foreground">
              Showing data for: {dateRangeLabel}
            </p>
          </div>
          <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
        </section>

        {/* Stats Overview - Memoized */}
        <StatsSection stats={filteredStats} dateRangeLabel={dateRangeLabel} />

        {/* Action Buttons */}
        <section className="flex flex-wrap gap-3">
          <AddCustomerForm onSubmit={addCustomer} />
          <AddPurchaseForm customers={customers} onSubmit={addPurchase} />
          <ImportCSVForm
            onImportCustomers={importCustomers}
            onImportPurchases={importPurchases}
            customerLookup={customerLookup}
            existingCustomerMobiles={existingMobiles}
            existingPurchases={existingPurchasesList}
            salesTeamMembers={salesTeamMembers}
            canAssignCustomers={isAdminOrAccounts}
          />
          {isAdminOrAccounts && (
            <BulkWhatsAppDialog customers={customers} />
          )}
        </section>

        {/* Tabs for Dashboard / All Customers */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="customers">All Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Customer Segmentation */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Customer Segmentation</h2>
                <p className="text-sm text-muted-foreground">
                  Customers grouped by their last purchase date
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {segmentStats.map((segment) => (
                  <SegmentCard 
                    key={segment.id} 
                    segment={segment} 
                    allCustomers={customers}
                  />
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="customers">
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">All Customers</h2>
                <p className="text-sm text-muted-foreground">
                  View and manage all your customers
                </p>
              </div>
              <CustomerTable 
                customers={customers} 
                onDelete={deleteCustomer} 
                salesTeamMembers={salesTeamMembers}
                onAssignCustomer={assignCustomer}
                onBulkAssign={bulkAssignCustomers}
                onToggleDND={toggleDND}
              />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
