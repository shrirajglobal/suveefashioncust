import { useState } from "react";
import { ChevronDown, ChevronUp, Phone, MapPin, IndianRupee, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerWithPurchases, Segment } from "@/types/crm";
import { formatINR, formatDaysAgo } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SegmentCardProps {
  segment: Segment & {
    count: number;
    totalAmount: number;
    customers: CustomerWithPurchases[];
  };
}

export function SegmentCard({ segment }: SegmentCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 bg-card shadow-segment transition-all duration-300 hover:shadow-card-hover animate-fade-in",
        segment.borderClass
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full h-auto p-5 justify-between rounded-none hover:bg-transparent",
              segment.bgClass
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full font-bold text-xl",
                  segment.count > 0 ? "bg-card shadow-sm" : "bg-muted"
                )}
              >
                {segment.count}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">
                  {segment.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {segment.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="font-semibold text-foreground">
                  {formatINR(segment.totalAmount)}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {segment.customers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No customers in this segment
            </div>
          ) : (
            <div className="divide-y border-t">
              {segment.customers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="space-y-1">
                    <a 
                      href={`tel:${customer.mobileNo}`}
                      className="font-medium hover:text-primary hover:underline transition-colors"
                    >
                      {customer.name}
                    </a>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <a 
                          href={`tel:${customer.mobileNo}`}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <a 
                          href={`https://wa.me/${customer.mobileNo.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-success hover:text-success/80 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <span>{customer.mobileNo}</span>
                      </div>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {customer.city}
                      </span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-medium flex items-center justify-end gap-1">
                      <IndianRupee className="h-3.5 w-3.5" />
                      {customer.totalPurchaseAmount.toLocaleString("en-IN")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDaysAgo(customer.daysSinceLastPurchase)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
