-- Create enum for review action
CREATE TYPE public.review_action AS ENUM ('approved', 'edited', 'rejected');

-- Create attendance_review table
CREATE TABLE public.attendance_review (
  review_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id UUID NOT NULL REFERENCES public.attendance_logs(log_id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE RESTRICT,
  action public.review_action NOT NULL,
  edited_time TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_review ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admins can do everything
CREATE POLICY "Admins can view all attendance reviews"
  ON public.attendance_review FOR SELECT
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert attendance reviews"
  ON public.attendance_review FOR INSERT
  WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update attendance reviews"
  ON public.attendance_review FOR UPDATE
  USING (is_admin_or_accounts(auth.uid()));

-- No DELETE policy - maintain permanent edit history
-- Reviews should never be deleted to preserve audit trail

-- Create indexes for performance
CREATE INDEX idx_attendance_review_log_id ON public.attendance_review(log_id);
CREATE INDEX idx_attendance_review_manager_id ON public.attendance_review(manager_id);
CREATE INDEX idx_attendance_review_reviewed_at ON public.attendance_review(reviewed_at);