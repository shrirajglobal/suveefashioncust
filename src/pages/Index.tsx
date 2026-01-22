import { Users, ShoppingBag, IndianRupee, TrendingUp } from "lucide-react";
import { useCRM } from "@/hooks/useCRM";
import { formatINR } from "@/lib/formatters";
import { Header } from "@/components/crm/Header";
import { StatCard } from "@/components/crm/StatCard";
import { SegmentCard } from "@/components/crm/SegmentCard";
import { CustomerTable } from "@/components/crm/CustomerTable";
import { AddCustomerForm } from "@/components/crm/AddCustomerForm";
import { AddPurchaseForm } from "@/components/crm/AddPurchaseForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const {
    customers,
    segmentStats,
    stats,
    isLoading,
    addCustomer,
    addPurchase,
    deleteCustomer,
  } = useCRM();

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Overview */}
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
            description="All time purchases"
          />
          <StatCard
            title="Total Revenue"
            value={formatINR(stats.totalRevenue)}
            icon={IndianRupee}
            description="Lifetime value"
          />
          <StatCard
            title="Avg. Purchase"
            value={formatINR(stats.avgPurchaseValue)}
            icon={TrendingUp}
            description="Per transaction"
          />
        </section>

        {/* Action Buttons */}
        <section className="flex flex-wrap gap-3">
          <AddCustomerForm onSubmit={addCustomer} />
          <AddPurchaseForm customers={customers} onSubmit={addPurchase} />
        </section>

        {/* Tabs for Dashboard / All Customers */}
        <Tabs defaultValue="dashboard" className="space-y-6">
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
                  <SegmentCard key={segment.id} segment={segment} />
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
              <CustomerTable customers={customers} onDelete={deleteCustomer} />
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
