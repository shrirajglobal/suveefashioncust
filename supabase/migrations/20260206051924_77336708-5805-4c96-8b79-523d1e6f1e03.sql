-- Create salary_rules table
CREATE TABLE public.salary_rules (
  rule_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE CASCADE,
  working_days_per_month INTEGER NOT NULL DEFAULT 26,
  paid_leaves_allowed INTEGER NOT NULL DEFAULT 0,
  deduction_per_absent_day NUMERIC(10, 2) NOT NULL DEFAULT 0,
  overtime_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.salary_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admins can do everything
CREATE POLICY "Admins can view all salary rules"
  ON public.salary_rules FOR SELECT
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert salary rules"
  ON public.salary_rules FOR INSERT
  WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update salary rules"
  ON public.salary_rules FOR UPDATE
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete salary rules"
  ON public.salary_rules FOR DELETE
  USING (is_admin_or_accounts(auth.uid()));

-- Create index for performance
CREATE INDEX idx_salary_rules_employee_id ON public.salary_rules(employee_id);

-- Add trigger for updated_at
CREATE TRIGGER update_salary_rules_updated_at
  BEFORE UPDATE ON public.salary_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();