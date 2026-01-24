-- Drop all existing RESTRICTIVE policies on customers table
DROP POLICY IF EXISTS "Admins can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Require authentication for customers" ON public.customers;
DROP POLICY IF EXISTS "Sales team can delete their assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Sales team can insert customers assigned to them" ON public.customers;
DROP POLICY IF EXISTS "Sales team can update their assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Sales team can view assigned customers" ON public.customers;

-- Create PERMISSIVE policies (default behavior is PERMISSIVE, combined with OR)
-- Admins/Accounts can do everything
CREATE POLICY "Admins can view all customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

-- Sales team can only see/manage their assigned customers
CREATE POLICY "Sales can view assigned customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Sales can insert assigned customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Sales can update assigned customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Sales can delete assigned customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (assigned_to = auth.uid());