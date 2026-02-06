-- Create table for paid holidays
CREATE TABLE public.paid_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  holiday_name text NOT NULL,
  financial_year text NOT NULL, -- e.g., "2024-25"
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(holiday_date, financial_year)
);

-- Create table for work shifts
CREATE TABLE public.work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_duration_minutes integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(shift_name)
);

-- Enable RLS
ALTER TABLE public.paid_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for paid_holidays (only super_admin and accounts can manage)
CREATE POLICY "Admins can view holidays"
ON public.paid_holidays FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert holidays"
ON public.paid_holidays FOR INSERT
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update holidays"
ON public.paid_holidays FOR UPDATE
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete holidays"
ON public.paid_holidays FOR DELETE
USING (is_admin_or_accounts(auth.uid()));

-- RLS Policies for work_shifts
CREATE POLICY "Admins can view shifts"
ON public.work_shifts FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert shifts"
ON public.work_shifts FOR INSERT
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update shifts"
ON public.work_shifts FOR UPDATE
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete shifts"
ON public.work_shifts FOR DELETE
USING (is_admin_or_accounts(auth.uid()));

-- All authenticated users can view shifts (for attendance display)
CREATE POLICY "Authenticated users can view shifts"
ON public.work_shifts FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_paid_holidays_updated_at
BEFORE UPDATE ON public.paid_holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_shifts_updated_at
BEFORE UPDATE ON public.work_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default shift
INSERT INTO public.work_shifts (shift_name, start_time, end_time, break_duration_minutes, is_default)
VALUES ('General Shift', '09:00:00', '18:00:00', 60, true);