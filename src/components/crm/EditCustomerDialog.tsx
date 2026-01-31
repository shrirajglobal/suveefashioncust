import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface EditCustomerDialogProps {
  customer: {
    id: string;
    name: string;
    mobileNo: string;
    address: string;
    city: string;
  };
  onSave: (customerId: string, data: {
    name: string;
    mobile_no: string;
    address: string;
    city: string;
  }) => Promise<boolean>;
}

export function EditCustomerDialog({ customer, onSave }: EditCustomerDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: customer.name,
    mobileNo: customer.mobileNo,
    address: customer.address || "",
    city: customer.city || "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: customer.name,
        mobileNo: customer.mobileNo,
        address: customer.address || "",
        city: customer.city || "",
      });
    }
  }, [open, customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    
    if (!formData.mobileNo.trim()) {
      toast.error("Mobile number is required");
      return;
    }

    setIsLoading(true);
    const success = await onSave(customer.id, {
      name: formData.name.trim(),
      mobile_no: formData.mobileNo.trim(),
      address: formData.address.trim() || "",
      city: formData.city.trim() || "",
    });

    setIsLoading(false);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit Customer">
          <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer details. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobileNo">Mobile Number *</Label>
              <Input
                id="mobileNo"
                value={formData.mobileNo}
                onChange={(e) => setFormData(prev => ({ ...prev, mobileNo: e.target.value }))}
                placeholder="Mobile number"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="City"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
