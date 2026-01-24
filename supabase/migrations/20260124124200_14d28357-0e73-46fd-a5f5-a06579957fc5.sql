-- Fix: Add base PERMISSIVE policies that require authentication
-- These ensure anonymous users cannot access the tables at all

-- For profiles table: Add a base policy requiring authentication
CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- For customers table: Add a base policy requiring authentication
CREATE POLICY "Require authentication for customers"
ON public.customers
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- For transactions table: Also add authentication requirement for completeness
CREATE POLICY "Require authentication for transactions"
ON public.transactions
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- For user_roles table: Also add authentication requirement for completeness
CREATE POLICY "Require authentication for user_roles"
ON public.user_roles
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);