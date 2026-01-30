-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_key TEXT NOT NULL UNIQUE,
  segment_label TEXT NOT NULL,
  message_template TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view templates
CREATE POLICY "Admins can view templates"
ON public.whatsapp_templates
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

-- Only super_admin can update templates
CREATE POLICY "Super admins can update templates"
ON public.whatsapp_templates
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'));

-- Only super_admin can insert templates
CREATE POLICY "Super admins can insert templates"
ON public.whatsapp_templates
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Insert default templates
INSERT INTO public.whatsapp_templates (segment_key, segment_label, message_template) VALUES
('30d', 'Inactive 1 Month (16-30 days)', 'Hi {name}!

It''s been a while since your last visit to Suvee Fashion. We miss you!

Check out our latest collection - we have some amazing new arrivals that we think you''ll love.

Visit us soon!'),
('3m', 'Inactive 3 Months (1-3 months)', 'Hello {name}!

We noticed you haven''t visited Suvee Fashion in the past few months. We''d love to see you again!

We have exciting new styles and exclusive offers waiting for you.

Come visit us soon!'),
('6m', 'Inactive 6 Months (3-6 months)', 'Dear {name},

It''s been 6 months since we last saw you at Suvee Fashion! We hope you''re doing well.

We''ve got fresh new collections and special deals that we''d love to show you.

Looking forward to welcoming you back!'),
('12m', 'Inactive 1 Year (6-12 months)', 'Hi {name}!

It''s been over a year since your last visit to Suvee Fashion. We truly miss having you as our valued customer!

A lot has changed - new collections, better styles, and amazing deals await you.

We''d be honored to serve you again. Visit us anytime!');

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();