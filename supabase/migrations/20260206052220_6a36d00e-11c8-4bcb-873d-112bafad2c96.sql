-- Add payslip_url column to monthly_payroll
ALTER TABLE public.monthly_payroll 
ADD COLUMN payslip_url TEXT;

-- Create storage bucket for payslips
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payslips', 'payslips', true);

-- Storage policies for payslips
CREATE POLICY "Admins can view payslips"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payslips' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can upload payslips"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payslips' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update payslips"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payslips' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete payslips"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payslips' AND is_admin_or_accounts(auth.uid()));

-- Public read access for payslip downloads
CREATE POLICY "Public can view payslips"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payslips');