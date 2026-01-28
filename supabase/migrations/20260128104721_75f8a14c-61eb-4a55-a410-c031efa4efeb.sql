-- Drop existing problematic policies on customers table
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Sales can view assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Sales can insert assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Sales can update assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Sales can delete assigned customers" ON public.customers;
DROP POLICY IF EXISTS "Require authentication for customers" ON public.customers;

-- Create PERMISSIVE policies (OR logic - user needs to satisfy at least one)
-- Admin/Accounts users can do everything
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

-- Sales team can only see/manage customers assigned to them
CREATE POLICY "Sales can view assigned customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (assigned_to = auth.uid());

CREATE POLICY "Sales can insert own customers" 
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