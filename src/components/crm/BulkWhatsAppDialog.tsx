import { useState, useMemo, useEffect } from "react";
import { MessageCircle, Send, CheckCircle, Phone, PhoneOff, Users } from "lucide-react";
import { CustomerWithPurchases, SEGMENTS, SegmentPeriod } from "@/types/crm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";

// Fallback message templates (used if DB fetch fails)
const FALLBACK_TEMPLATES: Record<string, string> = {
  "30d": `Hi {name}!

It's been a while since your last visit to Suvee Fashion. We miss you!

Check out our latest collection - we have some amazing new arrivals that we think you'll love.

Visit us soon!`,
  "3m": `Hello {name}!

We noticed you haven't visited Suvee Fashion in the past few months. We'd love to see you again!

We have exciting new styles and exclusive offers waiting for you.

Come visit us soon!`,
  "6m": `Dear {name},

It's been 6 months since we last saw you at Suvee Fashion! We hope you're doing well.

We've got fresh new collections and special deals that we'd love to show you.

Looking forward to welcoming you back!`,
  "12m": `Hi {name}!

It's been over a year since your last visit to Suvee Fashion. We truly miss having you as our valued customer!

A lot has changed - new collections, better styles, and amazing deals await you.

We'd be honored to serve you again. Visit us anytime!`,
};

// Segment options for the dropdown
const SEGMENT_OPTIONS = [
  { value: "30d", label: "Inactive 1 Month (16-30 days)", minDays: 16, maxDays: 30 },
  { value: "3m", label: "Inactive 3 Months (1-3 months)", minDays: 31, maxDays: 90 },
  { value: "6m", label: "Inactive 6 Months (3-6 months)", minDays: 91, maxDays: 180 },
  { value: "12m", label: "Inactive 1 Year (6-12 months)", minDays: 181, maxDays: 365 },
];

interface BulkWhatsAppDialogProps {
  customers: CustomerWithPurchases[];
  initialSegment?: string;
  trigger?: React.ReactNode;
}

export function BulkWhatsAppDialog({ 
  customers, 
  initialSegment,
  trigger 
}: BulkWhatsAppDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(initialSegment || "30d");
  const [templates, setTemplates] = useState<Record<string, string>>(FALLBACK_TEMPLATES);
  const [message, setMessage] = useState(FALLBACK_TEMPLATES[initialSegment || "30d"]);
  const [sentCustomers, setSentCustomers] = useState<Set<string>>(new Set());
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // Fetch templates from database when dialog opens
  useEffect(() => {
    if (open && !templatesLoaded) {
      fetchTemplates();
    }
  }, [open, templatesLoaded]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("segment_key, message_template");

      if (error) throw error;

      if (data && data.length > 0) {
        const templatesMap: Record<string, string> = {};
        data.forEach((t) => {
          templatesMap[t.segment_key] = t.message_template;
        });
        setTemplates(templatesMap);
        // Update current message if we have a template for the selected segment
        if (templatesMap[selectedSegment]) {
          setMessage(templatesMap[selectedSegment]);
        }
      }
      setTemplatesLoaded(true);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      // Fall back to hardcoded templates
      setTemplatesLoaded(true);
    }
  };

  // Filter customers by segment and exclude DND
  const eligibleCustomers = useMemo(() => {
    const segment = SEGMENT_OPTIONS.find(s => s.value === selectedSegment);
    if (!segment) return [];

    return customers.filter(customer => {
      // Exclude DND customers
      if (customer.dnd) return false;
      
      // Filter by days since last purchase
      const days = customer.daysSinceLastPurchase;
      if (days === null) {
        // Customers with no purchases - include in 12m+ segment
        return selectedSegment === "12m";
      }
      
      return days >= segment.minDays && days <= segment.maxDays;
    });
  }, [customers, selectedSegment]);

  const handleSegmentChange = (value: string) => {
    setSelectedSegment(value);
    setMessage(templates[value] || FALLBACK_TEMPLATES[value] || FALLBACK_TEMPLATES["30d"]);
    setSentCustomers(new Set());
  };

  const getWhatsAppLink = (customer: CustomerWithPurchases) => {
    const personalizedMessage = message.replace(/{name}/g, customer.name.split(" ")[0]);
    const encodedMessage = encodeURIComponent(personalizedMessage);
    // Remove all non-digit characters from phone number
    const phone = customer.mobileNo.replace(/\D/g, "");
    // Use whatsapp:// protocol to open the desktop app directly
    const link = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
    console.log("WhatsApp link generated:", link);
    return link;
  };

  const handleSendClick = (customerId: string, link: string) => {
    console.log("Opening WhatsApp link:", link);
    window.open(link, "_blank");
    setSentCustomers(prev => new Set(prev).add(customerId));
  };

  const sentCount = sentCustomers.size;
  const totalCount = eligibleCustomers.length;
  const remainingCount = totalCount - sentCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Bulk WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            Bulk WhatsApp Messaging
          </DialogTitle>
          <DialogDescription>
            Send pre-filled WhatsApp messages to inactive customers. DND customers are automatically excluded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Segment Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Customer Segment</label>
            <Select value={selectedSegment} onValueChange={handleSegmentChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message Template</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message..."
              className="min-h-[120px] text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{"{name}"}</code> to personalize with customer's first name
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{totalCount}</strong> eligible customers
              </span>
            </div>
            {sentCount > 0 && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {sentCount} sent
                </Badge>
                <Badge variant="outline">
                  {remainingCount} remaining
                </Badge>
              </>
            )}
          </div>

          {/* Customer List */}
          <div className="flex-1 overflow-hidden">
            <label className="text-sm font-medium mb-2 block">
              Customers ({eligibleCustomers.length})
            </label>
            <ScrollArea className="h-[250px] border rounded-lg">
              {eligibleCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <PhoneOff className="h-8 w-8 mb-2" />
                  <p className="text-sm">No eligible customers in this segment</p>
                  <p className="text-xs">Try selecting a different segment</p>
                </div>
              ) : (
                <div className="divide-y">
                  {eligibleCustomers.map(customer => {
                    const isSent = sentCustomers.has(customer.id);
                    const whatsappLink = getWhatsAppLink(customer);
                    
                    return (
                      <div 
                        key={customer.id}
                        className={cn(
                          "flex items-center justify-between p-3 hover:bg-muted/50 transition-colors",
                          isSent && "bg-success/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                            isSent ? "bg-success text-success-foreground" : "bg-muted"
                          )}>
                            {isSent ? <CheckCircle className="h-4 w-4" /> : customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{customer.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.mobileNo}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSent ? "secondary" : "default"}
                          className={cn(
                            "gap-1",
                            !isSent && "bg-success hover:bg-success/90 text-white"
                          )}
                          onClick={() => handleSendClick(customer.id, whatsappLink)}
                        >
                          {isSent ? (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              Sent
                            </>
                          ) : (
                            <>
                              <Send className="h-3 w-3" />
                              Send
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
