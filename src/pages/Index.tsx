import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { Users, ShoppingBag, IndianRupee, TrendingUp, Filter } from "lucide-react";
import { useSupabaseCRM } from "@/hooks/useSupabaseCRM";
import { useAuth } from "@/contexts/AuthContext";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useWelcomeMetrics } from "@/hooks/useWelcomeMetrics";
import { formatINR, getDaysBetween } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SEGMENTS, CustomerWithPurchases, SegmentPeriod } from "@/types/crm";
import { Header } from "@/components/crm/Header";
import { StatCard } from "@/components/crm/StatCard";
import { SegmentCard } from "@/components/crm/SegmentCard";
import { CustomerTable } from "@/components/crm/CustomerTable";
import { AddCustomerForm } from "@/components/crm/AddCustomerForm";
import { AddPurchaseForm } from "@/components/crm/AddPurchaseForm";
import { ImportCSVForm } from "@/components/crm/ImportCSVForm";
import { BulkWhatsAppDialog } from "@/components/crm/BulkWhatsAppDialog";
import { RevenueComparisonChart } from "@/components/crm/RevenueComparisonChart";
import { TodaysCallList } from "@/components/crm/TodaysCallList";
import { SalespersonDashboard } from "@/components/crm/SalespersonDashboard";
import { WelcomeMessage } from "@/components/crm/WelcomeMessage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      title="Total Sales"
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
      title="Avg. Sale"
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
  const { logPhoneClick } = useUsageTracking();
  const { metrics: welcomeMetrics, showWelcome } = useWelcomeMetrics();
  const [dateRange, setDateRange] = useState<DateRangeType>("month");
  const [selectedSalesman, setSelectedSalesman] = useState<string>("all");
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
    updateCustomer,
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
    refetch,
  } = useSupabaseCRM();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Wrapper for edit customer that returns a boolean for the dialog
  const handleEditCustomer = useCallback(async (
    customerId: string,
    data: { name: string; mobile_no: string; address: string; city: string }
  ): Promise<boolean> => {
    try {
      await updateCustomer(customerId, {
        name: data.name,
        mobileNo: data.mobile_no,
        address: data.address,
        city: data.city,
      });
      return true;
    } catch {
      return false;
    }
  }, [updateCustomer]);

  // Memoized date range label
  const dateRangeLabel = useMemo(() => getDateRangeLabel(dateRange), [dateRange]);

  // Filter customers based on selected salesman (for admin/accounts)
  const filteredCustomers = useMemo(() => {
    if (!isAdminOrAccounts || selectedSalesman === "all") {
      return customers;
    }
    return customers.filter((c) => c.assignedTo === selectedSalesman);
  }, [customers, selectedSalesman, isAdminOrAccounts]);

  // Filter purchases based on filtered customers
  const filteredCustomerIds = useMemo(() => {
    return new Set(filteredCustomers.map((c) => c.id));
  }, [filteredCustomers]);

  // Map customer ID to assigned salesman for chart
  const customerAssignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      if (c.assignedTo) {
        map.set(c.id, c.assignedTo);
      }
    });
    return map;
  }, [customers]);

  // Filter purchases based on selected date range and salesman - optimized with useMemo
  const filteredStats = useMemo(() => {
    const { start, end } = getDateRange(dateRange);
    
    const filteredPurchases = purchases.filter((p) => {
      const purchaseDate = new Date(p.date);
      const inDateRange = purchaseDate >= start && purchaseDate <= end;
      const belongsToFilteredCustomer = filteredCustomerIds.has(p.customerId);
      return inDateRange && belongsToFilteredCustomer;
    });

    const totalCustomers = filteredCustomers.length;
    const totalPurchases = filteredPurchases.length;
    const totalRevenue = filteredPurchases.reduce((sum, p) => sum + p.amount, 0);
    const avgPurchaseValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

    return { totalCustomers, totalPurchases, totalRevenue, avgPurchaseValue };
  }, [filteredCustomers.length, purchases, dateRange, filteredCustomerIds]);

  // Calculate filtered segment stats based on selected salesman
  const filteredSegmentStats = useMemo(() => {
    const today = new Date();
    
    // First, enrich filtered customers with purchase data
    const customersWithPurchases: CustomerWithPurchases[] = filteredCustomers.map((customer) => {
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

    // Segment the customers
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

    // Generate stats
    return SEGMENTS.map((segment) => {
      const segmentCustomers = segments[segment.id];
      const totalAmount = segmentCustomers.reduce((sum, c) => sum + c.totalPurchaseAmount, 0);
      
      return {
        ...segment,
        count: segmentCustomers.length,
        totalAmount,
        customers: segmentCustomers,
      };
    });
  }, [filteredCustomers, purchases]);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleDateRangeChange = useCallback((value: DateRangeType) => {
    setDateRange(value);
  }, []);

  const handleSalesmanChange = useCallback((value: string) => {
    setSelectedSalesman(value);
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
        {/* Filters */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Dashboard Overview</h2>
              <p className="text-sm text-muted-foreground">
                Showing data for: {dateRangeLabel}
                {isAdminOrAccounts && selectedSalesman !== "all" && (
                  <span className="ml-1">
                    • Filtered by: {salesTeamMembers.find(m => m.id === selectedSalesman)?.name || "Unknown"}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Salesman Filter - Only for Admin/Accounts */}
              {isAdminOrAccounts && salesTeamMembers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="salesman-filter" className="flex items-center gap-1 text-sm whitespace-nowrap">
                    <Filter className="h-4 w-4" />
                    Salesman
                  </Label>
                  <Select value={selectedSalesman} onValueChange={handleSalesmanChange}>
                    <SelectTrigger id="salesman-filter" className="w-[180px]">
                      <SelectValue placeholder="All Salesmen" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-md z-50">
                      <SelectItem value="all">All Salesmen</SelectItem>
                      {salesTeamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
            </div>
          </div>
        </section>

        {/* Welcome Message for Salespeople - visible immediately on login */}
        {showWelcome && welcomeMetrics && (
          <WelcomeMessage
            userName={welcomeMetrics.userName}
            callsMadeToday={welcomeMetrics.callsMadeToday}
            customersContactedToday={welcomeMetrics.customersContactedToday}
            overdueCount={welcomeMetrics.overdueCount}
            highValueOverdueCount={welcomeMetrics.highValueOverdueCount}
            avgDailyCalls={welcomeMetrics.avgDailyCalls}
            salesTarget={welcomeMetrics.salesTarget}
            salesAchieved={welcomeMetrics.salesAchieved}
          />
        )}

        {/* Stats Overview - Memoized */}
        <StatsSection stats={filteredStats} dateRangeLabel={dateRangeLabel} />

        {/* Revenue Comparison Chart - Visible for all users */}
        <RevenueComparisonChart
          purchases={purchases}
          filteredCustomerIds={filteredCustomerIds}
          selectedSalesman={selectedSalesman}
          salesmanName={salesTeamMembers.find(m => m.id === selectedSalesman)?.name}
          salesTeamMembers={salesTeamMembers}
          customerAssignments={customerAssignmentMap}
        />

        {/* Action Buttons */}
        <section className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
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

        {/* Tabs for Dashboard / Call List / All Customers */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="my-dashboard">My Stats</TabsTrigger>
            <TabsTrigger value="dashboard">Segments</TabsTrigger>
            <TabsTrigger value="calllist">Call List</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          <TabsContent value="my-dashboard" className="space-y-6">
            <SalespersonDashboard />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Customer Segmentation */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Customer Segmentation</h2>
              <p className="text-sm text-muted-foreground">
                Customers grouped by their last sale date
              </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredSegmentStats.map((segment) => (
                  <SegmentCard 
                    key={segment.id} 
                    segment={segment} 
                    allCustomers={filteredCustomers}
                    onPhoneClick={logPhoneClick}
                  />
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="calllist">
            <TodaysCallList onPhoneClick={logPhoneClick} />
          </TabsContent>

          <TabsContent value="customers">
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">All Customers</h2>
                <p className="text-sm text-muted-foreground">
                  View and manage all your customers
                  {isAdminOrAccounts && selectedSalesman !== "all" && (
                    <span className="ml-1">
                      (Filtered by: {salesTeamMembers.find(m => m.id === selectedSalesman)?.name || "Unknown"})
                    </span>
                  )}
                </p>
              </div>
              <CustomerTable 
                customers={filteredCustomers} 
                onDelete={deleteCustomer} 
                salesTeamMembers={salesTeamMembers}
                onAssignCustomer={assignCustomer}
                onBulkAssign={bulkAssignCustomers}
                onToggleDND={toggleDND}
                onToggleCritical={toggleCritical}
                onBulkToggleCritical={bulkToggleCritical}
                onPhoneClick={logPhoneClick}
                onEditCustomer={handleEditCustomer}
              />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
