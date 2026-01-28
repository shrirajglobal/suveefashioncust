-- Add sales team member fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN mobile_no text DEFAULT NULL,
ADD COLUMN salary numeric DEFAULT NULL,
ADD COLUMN sales_target numeric GENERATED ALWAYS AS (COALESCE(salary, 0) * 30) STORED;

-- Create index for quick lookups
CREATE INDEX idx_profiles_mobile_no ON public.profiles(mobile_no) WHERE mobile_no IS NOT NULL;

COMMENT ON COLUMN public.profiles.salary IS 'Monthly salary in rupees';
COMMENT ON COLUMN public.profiles.sales_target IS 'Auto-calculated as salary × 30';