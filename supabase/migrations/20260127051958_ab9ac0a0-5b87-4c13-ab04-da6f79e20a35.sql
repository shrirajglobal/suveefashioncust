-- Create usage events table to track user activity
CREATE TABLE public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('phone_click', 'app_open')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_usage_events_user_date ON public.usage_events (user_id, created_at);
CREATE INDEX idx_usage_events_type_date ON public.usage_events (event_type, created_at);

-- Enable RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert their own events"
ON public.usage_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.usage_events
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

-- Users can view their own events
CREATE POLICY "Users can view their own events"
ON public.usage_events
FOR SELECT
USING (auth.uid() = user_id);