import { useState } from "react";
import { Phone, MapPin, Trash2, Search, SortAsc, SortDesc, UserCheck, Users, MessageCircle, PhoneOff } from "lucide-react";
import { CustomerWithPurchases } from "@/types/crm";
import { formatINR, formatDaysAgo, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CustomerTableProps {
  customers: CustomerWithPurchases[];
  onDelete: (id: string) => void;
  salesTeamMembers?: Array<{ id: string; name: string }>;
  onAssignCustomer?: (customerId: string, salesUserId: string | null) => Promise<boolean>;
  onBulkAssign?: (customerIds: string[], salesUserId: string | null) => Promise<boolean>;
  onToggleDND?: (customerId: string, dndStatus: boolean) => Promise<boolean>;
}

type SortField = "name" | "city" | "totalPurchaseAmount" | "daysSinceLastPurchase" | "assignedTo";
type SortOrder = "asc" | "desc";

export function CustomerTable({ 
  customers, 
  onDelete,
  salesTeamMembers = [],
  onAssignCustomer,
  onBulkAssign,
  onToggleDND,
}: CustomerTableProps) {
  const { userRole, isAdminOrAccounts } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignValue, setBulkAssignValue] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  const canAssignCustomers = userRole === "super_admin" || userRole === "accounts";

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.city.toLowerCase().includes(search.toLowerCase()) ||
      customer.mobileNo.includes(search) ||
      (customer.assignedToName?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "city":
        comparison = a.city.localeCompare(b.city);
        break;
      case "totalPurchaseAmount":
        comparison = a.totalPurchaseAmount - b.totalPurchaseAmount;
        break;
      case "daysSinceLastPurchase":
        const aDays = a.daysSinceLastPurchase ?? Infinity;
        const bDays = b.daysSinceLastPurchase ?? Infinity;
        comparison = aDays - bDays;
        break;
      case "assignedTo":
        comparison = (a.assignedToName ?? "").localeCompare(b.assignedToName ?? "");
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <SortAsc className="h-4 w-4" />
    ) : (
      <SortDesc className="h-4 w-4" />
    );
  };

  const getUrgencyBadge = (days: number | null) => {
    if (days === null) return <Badge variant="secondary">No Purchases</Badge>;
    if (days <= 7) return <Badge className="bg-success">Active</Badge>;
    if (days <= 15) return <Badge className="bg-warning">Recent</Badge>;
    if (days <= 30) return <Badge className="bg-urgent">Follow Up</Badge>;
    return <Badge variant="destructive">At Risk</Badge>;
  };

  const handleAssign = async (customerId: string, value: string) => {
    if (!onAssignCustomer) return;
    const salesUserId = value === "unassigned" ? null : value;
    await onAssignCustomer(customerId, salesUserId);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCustomers.map((c) => c.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!onBulkAssign || selectedIds.size === 0 || !bulkAssignValue) return;
    
    setIsAssigning(true);
    const salesUserId = bulkAssignValue === "unassigned" ? null : bulkAssignValue;
    const success = await onBulkAssign(Array.from(selectedIds), salesUserId);
    
    if (success) {
      setSelectedIds(new Set());
      setBulkAssignValue("");
    }
    setIsAssigning(false);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAssignValue("");
  };

  return (
    <div className="space-y-4">
      {/* Bulk Action Bar */}
      {canAssignCustomers && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border animate-fade-in">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {selectedIds.size} customer{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={bulkAssignValue} onValueChange={setBulkAssignValue}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {salesTeamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkAssign}
              disabled={!bulkAssignValue || isAssigning}
            >
              {isAssigning ? "Assigning..." : "Assign"}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, city, mobile, or assigned to..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {canAssignCustomers && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={sortedCustomers.length > 0 && selectedIds.size === sortedCustomers.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Customer
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead>Contact</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("city")}
              >
                <div className="flex items-center gap-2">
                  City
                  <SortIcon field="city" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("assignedTo")}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Assigned To
                  <SortIcon field="assignedTo" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("totalPurchaseAmount")}
              >
                <div className="flex items-center justify-end gap-2">
                  Total Purchases
                  <SortIcon field="totalPurchaseAmount" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("daysSinceLastPurchase")}
              >
                <div className="flex items-center gap-2">
                  Last Purchase
                  <SortIcon field="daysSinceLastPurchase" />
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canAssignCustomers ? 9 : 8} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {search ? "No customers found" : "No customers yet. Add your first customer!"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedCustomers.map((customer) => (
                <TableRow key={customer.id} className="animate-fade-in">
                  {canAssignCustomers && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(customer.id)}
                        onCheckedChange={() => toggleSelect(customer.id)}
                        aria-label={`Select ${customer.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <a 
                        href={`tel:${customer.mobileNo}`}
                        className="font-medium hover:text-primary hover:underline transition-colors"
                      >
                        {customer.name}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {customer.purchases.length} purchase{customer.purchases.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.dnd && !isAdminOrAccounts ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <PhoneOff className="h-4 w-4" />
                        <span className="text-sm italic">DND</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <a 
                          href={`tel:${customer.mobileNo}`}
                          className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a 
                          href={`https://wa.me/${customer.mobileNo.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-success hover:text-success/80 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <span className="text-sm">{customer.mobileNo}</span>
                        {customer.dnd && isAdminOrAccounts && (
                          <Badge variant="outline" className="text-destructive border-destructive text-xs">
                            DND
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {customer.city || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canAssignCustomers && onAssignCustomer ? (
                      <Select
                        value={customer.assignedTo || "unassigned"}
                        onValueChange={(value) => handleAssign(customer.id, value)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span className="text-muted-foreground">Unassigned</span>
                          </SelectItem>
                          {salesTeamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {customer.assignedToName || "Unassigned"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(customer.totalPurchaseAmount)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">
                        {formatDaysAgo(customer.daysSinceLastPurchase)}
                      </p>
                      {customer.lastPurchaseDate && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(customer.lastPurchaseDate)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getUrgencyBadge(customer.daysSinceLastPurchase)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isAdminOrAccounts && onToggleDND && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onToggleDND(customer.id, !customer.dnd)}
                          title={customer.dnd ? "Remove DND" : "Mark as DND"}
                        >
                          <PhoneOff className={cn(
                            "h-4 w-4",
                            customer.dnd 
                              ? "text-destructive" 
                              : "text-muted-foreground hover:text-destructive"
                          )} />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {customer.name}? This will also delete all their purchase records. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(customer.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
