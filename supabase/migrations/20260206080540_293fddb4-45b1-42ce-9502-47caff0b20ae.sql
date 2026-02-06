-- Create table to track flagged attendance entries for review
CREATE TABLE IF NOT EXISTS public.attendance_flags (
    flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    flag_type TEXT NOT NULL CHECK (flag_type IN ('absent', 'incomplete_punch', 'missing_selfie', 'missing_gps')),
    description TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by UUID REFERENCES public.employee_master(employee_id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(employee_id, date, flag_type)
);

-- Enable RLS
ALTER TABLE public.attendance_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attendance_flags
CREATE POLICY "Admins can view all flags"
ON public.attendance_flags
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert flags"
ON public.attendance_flags
FOR INSERT
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update flags"
ON public.attendance_flags
FOR UPDATE
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete flags"
ON public.attendance_flags
FOR DELETE
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Managers can view team flags"
ON public.attendance_flags
FOR SELECT
USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

CREATE POLICY "Managers can update team flags"
ON public.attendance_flags
FOR UPDATE
USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

-- Add trigger for updated_at
CREATE TRIGGER update_attendance_flags_updated_at
BEFORE UPDATE ON public.attendance_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_attendance_flags_date ON public.attendance_flags(date);
CREATE INDEX idx_attendance_flags_employee ON public.attendance_flags(employee_id);
CREATE INDEX idx_attendance_flags_unresolved ON public.attendance_flags(is_resolved) WHERE is_resolved = false;