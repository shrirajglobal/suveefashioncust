-- Add authentication requirement policy for customers table
-- This creates defense-in-depth ensuring no access without authentication
CREATE POLICY "Require authentication for customers"
ON public.customers
FOR ALL
TO public
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);