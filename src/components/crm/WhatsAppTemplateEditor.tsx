import { useState, useEffect } from "react";
import { MessageCircle, Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WhatsAppTemplate {
  id: string;
  segment_key: string;
  segment_label: string;
  message_template: string;
  updated_at: string;
}

// Default templates for reset functionality
const DEFAULT_TEMPLATES: Record<string, string> = {
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

export function WhatsAppTemplateEditor() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("segment_key");

      if (error) throw error;

      setTemplates(data || []);
      // Initialize edited templates with current values
      const edited: Record<string, string> = {};
      data?.forEach((t) => {
        edited[t.id] = t.message_template;
      });
      setEditedTemplates(edited);
    } catch (error: any) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load WhatsApp templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (template: WhatsAppTemplate) => {
    const newMessage = editedTemplates[template.id];
    if (newMessage === template.message_template) {
      toast.info("No changes to save");
      return;
    }

    setSavingId(template.id);
    try {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ 
          message_template: newMessage,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(`Template for "${template.segment_label}" saved successfully`);
      // Refresh templates
      fetchTemplates();
    } catch (error: any) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template: " + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = (template: WhatsAppTemplate) => {
    const defaultMessage = DEFAULT_TEMPLATES[template.segment_key];
    if (defaultMessage) {
      setEditedTemplates((prev) => ({
        ...prev,
        [template.id]: defaultMessage,
      }));
      toast.info("Template reset to default. Click Save to apply.");
    }
  };

  const hasChanges = (template: WhatsAppTemplate) => {
    return editedTemplates[template.id] !== template.message_template;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading templates...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-success" />
          WhatsApp Message Templates
        </CardTitle>
        <CardDescription>
          Edit the message templates used for bulk WhatsApp messaging to inactive customers.
          Use <code className="bg-muted px-1 rounded text-xs">{"{name}"}</code> to personalize with customer's first name.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {templates.map((template) => (
            <AccordionItem key={template.id} value={template.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{template.segment_label}</span>
                  {hasChanges(template) && (
                    <Badge variant="secondary" className="text-xs">
                      Unsaved changes
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor={`template-${template.id}`}>Message Template</Label>
                  <Textarea
                    id={`template-${template.id}`}
                    value={editedTemplates[template.id] || ""}
                    onChange={(e) =>
                      setEditedTemplates((prev) => ({
                        ...prev,
                        [template.id]: e.target.value,
                      }))
                    }
                    className="min-h-[180px] font-mono text-sm"
                    placeholder="Enter your message template..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleSave(template)}
                    disabled={!hasChanges(template) || savingId === template.id}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingId === template.id ? "Saving..." : "Save Template"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleReset(template)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset to Default
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(template.updated_at).toLocaleString()}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
