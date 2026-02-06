-- Create table to store employee location history
CREATE TABLE public.employee_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_employee_locations_employee_date ON public.employee_locations(employee_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.employee_locations ENABLE ROW LEVEL SECURITY;

-- Admins can view all locations
CREATE POLICY "Admins can view all locations"
ON public.employee_locations
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

-- Managers can view team locations
CREATE POLICY "Managers can view team locations"
ON public.employee_locations
FOR SELECT
USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

-- Staff can insert their own location
CREATE POLICY "Staff can insert own location"
ON public.employee_locations
FOR INSERT
WITH CHECK (employee_id = get_employee_id(auth.uid()));

-- Staff can view own location history
CREATE POLICY "Staff can view own locations"
ON public.employee_locations
FOR SELECT
USING (employee_id = get_employee_id(auth.uid()));

-- Create table for location tracking settings
CREATE TABLE public.location_tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employee_master(employee_id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  tracking_start_time time NOT NULL DEFAULT '09:00',
  tracking_end_time time NOT NULL DEFAULT '18:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.location_tracking_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all settings
CREATE POLICY "Admins can manage location settings"
ON public.location_tracking_settings
FOR ALL
USING (is_admin_or_accounts(auth.uid()));

-- Staff can view own settings
CREATE POLICY "Staff can view own settings"
ON public.location_tracking_settings
FOR SELECT
USING (employee_id = get_employee_id(auth.uid()));