-- Add is_critical column to customers table for priority flagging
ALTER TABLE public.customers 
ADD COLUMN is_critical boolean NOT NULL DEFAULT false;

-- Add access restriction columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_restricted boolean NOT NULL DEFAULT false,
ADD COLUMN restricted_until timestamp with time zone DEFAULT NULL,
ADD COLUMN restriction_reason text DEFAULT NULL;

-- Create index for critical customers for faster queries
CREATE INDEX idx_customers_is_critical ON public.customers(is_critical) WHERE is_critical = true;

-- Create index for restricted users
CREATE INDEX idx_profiles_is_restricted ON public.profiles(is_restricted) WHERE is_restricted = true;