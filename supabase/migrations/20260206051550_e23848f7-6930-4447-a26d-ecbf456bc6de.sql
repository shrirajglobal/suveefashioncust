-- Create enum for punch type
CREATE TYPE public.punch_type AS ENUM ('IN', 'OUT');

-- Create enum for entry status
CREATE TYPE public.entry_status AS ENUM ('auto', 'edited');

-- Create attendance_logs table
CREATE TABLE public.attendance_logs (
  log_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master(employee_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  punch_type public.punch_type NOT NULL,
  punch_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  gps_latitude NUMERIC(10, 8),
  gps_longitude NUMERIC(11, 8),
  selfie_image_url TEXT,
  device_id TEXT,
  entry_status public.entry_status NOT NULL DEFAULT 'auto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admins can do everything
CREATE POLICY "Admins can view all attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert attendance logs"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete attendance logs"
  ON public.attendance_logs FOR DELETE
  USING (is_admin_or_accounts(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_attendance_logs_employee_id ON public.attendance_logs(employee_id);
CREATE INDEX idx_attendance_logs_date ON public.attendance_logs(date);
CREATE INDEX idx_attendance_logs_employee_date ON public.attendance_logs(employee_id, date);

-- Add trigger for updated_at
CREATE TRIGGER update_attendance_logs_updated_at
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for attendance selfies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-selfies', 'attendance-selfies', true);

-- Storage policies for attendance selfies
CREATE POLICY "Admins can view attendance selfies"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attendance-selfies' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can upload attendance selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attendance-selfies' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update attendance selfies"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'attendance-selfies' AND is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete attendance selfies"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attendance-selfies' AND is_admin_or_accounts(auth.uid()));

-- Public read access for selfie images (so they can be displayed)
CREATE POLICY "Public can view attendance selfies"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attendance-selfies');