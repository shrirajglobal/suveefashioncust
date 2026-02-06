-- Add is_locked column to monthly_payroll table to prevent editing after finalization
ALTER TABLE public.monthly_payroll 
ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

-- Add locked_at and locked_by columns for audit trail
ALTER TABLE public.monthly_payroll 
ADD COLUMN locked_at timestamp with time zone,
ADD COLUMN locked_by uuid;