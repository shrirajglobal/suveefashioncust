-- Drop all existing RESTRICTIVE policies on transactions table
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Require authentication for transactions" ON public.transactions;
DROP POLICY IF EXISTS "Sales team can delete transactions for assigned customers" ON public.transactions;
DROP POLICY IF EXISTS "Sales team can insert transactions for assigned customers" ON public.transactions;
DROP POLICY IF EXISTS "Sales team can update transactions for assigned customers" ON public.transactions;
DROP POLICY IF EXISTS "Sales team can view transactions for assigned customers" ON public.transactions;

-- Create PERMISSIVE policies for transactions
-- Admins/Accounts can do everything
CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can insert transactions" 
ON public.transactions 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can update transactions" 
ON public.transactions 
FOR UPDATE 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

CREATE POLICY "Admins can delete transactions" 
ON public.transactions 
FOR DELETE 
TO authenticated
USING (is_admin_or_accounts(auth.uid()));

-- Sales team can only see/manage transactions for their assigned customers
CREATE POLICY "Sales can view assigned customer transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = transactions.customer_id 
    AND customers.assigned_to = auth.uid()
  )
);

CREATE POLICY "Sales can insert assigned customer transactions" 
ON public.transactions 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = transactions.customer_id 
    AND customers.assigned_to = auth.uid()
  )
);

CREATE POLICY "Sales can update assigned customer transactions" 
ON public.transactions 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = transactions.customer_id 
    AND customers.assigned_to = auth.uid()
  )
);

CREATE POLICY "Sales can delete assigned customer transactions" 
ON public.transactions 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM customers 
    WHERE customers.id = transactions.customer_id 
    AND customers.assigned_to = auth.uid()
  )
);