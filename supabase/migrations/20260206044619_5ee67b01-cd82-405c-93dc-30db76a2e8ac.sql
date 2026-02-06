-- Create enum for salary_type
CREATE TYPE public.salary_type AS ENUM ('monthly', 'daily', 'hourly');

-- Create enum for employee status
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive');

-- Create Employee_Master table
CREATE TABLE public.employee_master (
  employee_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  role TEXT NOT NULL,
  reporting_manager_id UUID REFERENCES public.employee_master(employee_id) ON DELETE SET NULL,
  salary_type public.salary_type NOT NULL DEFAULT 'monthly',
  base_salary NUMERIC NOT NULL DEFAULT 0,
  per_day_rate NUMERIC NOT NULL DEFAULT 0,
  overtime_rate NUMERIC NOT NULL DEFAULT 0,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.employee_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employee_master ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - Admins can manage all employees
CREATE POLICY "Admins can view all employees"
ON public.employee_master
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert employees"
ON public.employee_master
FOR INSERT
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update employees"
ON public.employee_master
FOR UPDATE
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete employees"
ON public.employee_master
FOR DELETE
USING (is_admin_or_accounts(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_master_updated_at
BEFORE UPDATE ON public.employee_master
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_employee_master_department ON public.employee_master(department);
CREATE INDEX idx_employee_master_status ON public.employee_master(status);
CREATE INDEX idx_employee_master_reporting_manager ON public.employee_master(reporting_manager_id);