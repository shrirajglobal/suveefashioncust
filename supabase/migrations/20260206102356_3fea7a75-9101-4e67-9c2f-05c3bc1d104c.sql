-- Create table to store push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can insert own subscription"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all for debugging
CREATE POLICY "Admins can view all subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);