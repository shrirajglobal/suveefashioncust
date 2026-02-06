-- Create enum for payment mode
CREATE TYPE public.staff_payment_mode AS ENUM ('UPI', 'Bank', 'Cash');

-- Create staff_payments table
CREATE TABLE public.staff_payments (
  payment_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE RESTRICT,
  payroll_id UUID NOT NULL REFERENCES public.monthly_payroll(payroll_id) ON DELETE RESTRICT,
  amount_paid NUMERIC(12, 2) NOT NULL,
  payment_mode public.staff_payment_mode NOT NULL,
  transaction_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admins can do everything
CREATE POLICY "Admins can view all staff payments"
  ON public.staff_payments FOR SELECT
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert staff payments"
  ON public.staff_payments FOR INSERT
  WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update staff payments"
  ON public.staff_payments FOR UPDATE
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete staff payments"
  ON public.staff_payments FOR DELETE
  USING (is_admin_or_accounts(auth.uid()));

-- Create indexes
CREATE INDEX idx_staff_payments_employee_id ON public.staff_payments(employee_id);
CREATE INDEX idx_staff_payments_payroll_id ON public.staff_payments(payroll_id);
CREATE INDEX idx_staff_payments_payment_date ON public.staff_payments(payment_date);
CREATE INDEX idx_staff_payments_recorded_by ON public.staff_payments(recorded_by);

-- Add trigger for updated_at
CREATE TRIGGER update_staff_payments_updated_at
  BEFORE UPDATE ON public.staff_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();