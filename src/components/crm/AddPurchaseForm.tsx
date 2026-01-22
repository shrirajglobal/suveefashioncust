import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CustomerWithPurchases } from "@/types/crm";

interface AddPurchaseFormProps {
  customers: CustomerWithPurchases[];
  onSubmit: (data: {
    customerId: string;
    amount: number;
    date: Date;
    description?: string;
  }) => void;
}

export function AddPurchaseForm({ customers, onSubmit }: AddPurchaseFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please select a customer and enter an amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      customerId: formData.customerId,
      amount,
      date: new Date(formData.date),
      description: formData.description || undefined,
    });

    setFormData({
      customerId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    });
    setOpen(false);
    toast({
      title: "Purchase Recorded",
      description: `₹${amount.toLocaleString("en-IN")} purchase has been recorded`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Add Purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record New Purchase</DialogTitle>
          <DialogDescription>
            Add a new purchase for an existing customer
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <Select
              value={formData.customerId}
              onValueChange={(value) =>
                setFormData({ ...formData, customerId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} - {customer.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Purchase Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Purchase description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Record Purchase</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
