import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Users, MessageSquare, MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LogInteractionDialogProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const INTERACTION_TYPES = [
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
  { value: "in_person", label: "In Person", icon: Users },
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "other", label: "Other", icon: MoreHorizontal },
] as const;

const INTERACTION_OUTCOMES = [
  { value: "successful", label: "Successful" },
  { value: "no_answer", label: "No Answer" },
  { value: "callback_requested", label: "Callback Requested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "order_placed", label: "Order Placed" },
  { value: "follow_up_needed", label: "Follow Up Needed" },
  { value: "other", label: "Other" },
] as const;

export function LogInteractionDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
  onSuccess,
}: LogInteractionDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interactionType, setInteractionType] = useState<string>("phone_call");
  const [outcome, setOutcome] = useState<string>("successful");
  const [notes, setNotes] = useState("");
  const [nextFollowupDate, setNextFollowupDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!notes.trim()) {
      toast.error("Notes are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("interactions").insert({
        customer_id: customerId,
        salesperson_id: user.id,
        interaction_type: interactionType as "phone_call" | "whatsapp" | "email" | "in_person" | "sms" | "other",
        interaction_outcome: outcome as "successful" | "no_answer" | "callback_requested" | "not_interested" | "order_placed" | "follow_up_needed" | "other",
        notes: notes.trim(),
        interaction_datetime: new Date().toISOString(),
        next_followup_date: nextFollowupDate || null,
      });

      if (error) throw error;

      toast.success("Interaction logged successfully!");
      
      // Reset form
      setInteractionType("phone_call");
      setOutcome("successful");
      setNotes("");
      setNextFollowupDate("");
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Failed to log interaction: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
          <DialogDescription>
            Record your interaction with <strong>{customerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Interaction Type */}
          <div className="space-y-2">
            <Label>Interaction Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {INTERACTION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={interactionType === type.value ? "default" : "outline"}
                    size="sm"
                    className="flex flex-col gap-1 h-auto py-2"
                    onClick={() => setInteractionType(type.value)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                {INTERACTION_OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes (Mandatory) */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Enter details about the interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              required
            />
          </div>

          {/* Next Follow-up Date */}
          <div className="space-y-2">
            <Label htmlFor="followup">Next Follow-up Date (Optional)</Label>
            <Input
              id="followup"
              type="date"
              value={nextFollowupDate}
              onChange={(e) => setNextFollowupDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !notes.trim()}>
              {isSubmitting ? "Saving..." : "Save Interaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
