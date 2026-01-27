-- Drop existing restrictive SELECT policies on usage_events
DROP POLICY IF EXISTS "Admins can view all events" ON public.usage_events;
DROP POLICY IF EXISTS "Users can view their own events" ON public.usage_events;

-- Recreate as PERMISSIVE policies (default behavior, OR logic)
CREATE POLICY "Admins can view all events" 
ON public.usage_events 
FOR SELECT 
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Users can view their own events" 
ON public.usage_events 
FOR SELECT 
USING (auth.uid() = user_id);