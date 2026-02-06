-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid');

-- Create monthly_payroll table
CREATE TABLE public.monthly_payroll (
  payroll_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE RESTRICT,
  month_year TEXT NOT NULL,
  total_working_days INTEGER NOT NULL DEFAULT 26,
  days_present INTEGER NOT NULL DEFAULT 0,
  leave_days INTEGER NOT NULL DEFAULT 0,
  absent_days INTEGER NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  -- Store rates at payroll time for historical accuracy
  per_day_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deduction_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Auto-calculated columns
  gross_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    (days_present * per_day_rate) + (overtime_hours * overtime_rate)
  ) STORED,
  total_deductions NUMERIC(12, 2) GENERATED ALWAYS AS (
    absent_days * deduction_rate
  ) STORED,
  net_salary NUMERIC(12, 2) GENERATED ALWAYS AS (
    ((days_present * per_day_rate) + (overtime_hours * overtime_rate)) - (absent_days * deduction_rate)
  ) STORED,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month_year)
);

-- Enable RLS
ALTER TABLE public.monthly_payroll ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admins can do everything
CREATE POLICY "Admins can view all payroll"
  ON public.monthly_payroll FOR SELECT
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert payroll"
  ON public.monthly_payroll FOR INSERT
  WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update payroll"
  ON public.monthly_payroll FOR UPDATE
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete payroll"
  ON public.monthly_payroll FOR DELETE
  USING (is_admin_or_accounts(auth.uid()));

-- Create indexes
CREATE INDEX idx_monthly_payroll_employee_id ON public.monthly_payroll(employee_id);
CREATE INDEX idx_monthly_payroll_month_year ON public.monthly_payroll(month_year);
CREATE INDEX idx_monthly_payroll_status ON public.monthly_payroll(payment_status);

-- Add trigger for updated_at
CREATE TRIGGER update_monthly_payroll_updated_at
  BEFORE UPDATE ON public.monthly_payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-populate rates from employee_master and salary_rules on insert
CREATE OR REPLACE FUNCTION public.populate_payroll_rates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get rates from employee_master
  SELECT per_day_rate, overtime_rate
  INTO NEW.per_day_rate, NEW.overtime_rate
  FROM public.employee_master
  WHERE employee_id = NEW.employee_id;
  
  -- Get deduction rate from salary_rules
  SELECT deduction_per_absent_day
  INTO NEW.deduction_rate
  FROM public.salary_rules
  WHERE employee_id = NEW.employee_id;
  
  -- Default to 0 if no salary rules found
  IF NEW.deduction_rate IS NULL THEN
    NEW.deduction_rate := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-populate rates before insert
CREATE TRIGGER populate_payroll_rates_trigger
  BEFORE INSERT ON public.monthly_payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_payroll_rates();