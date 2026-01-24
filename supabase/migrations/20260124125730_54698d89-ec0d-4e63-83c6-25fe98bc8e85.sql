-- Create a trigger function to ensure only super_admin can change assigned_to
CREATE OR REPLACE FUNCTION public.check_customer_assignment_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If assigned_to is being changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Only super_admin can change assignments
    IF NOT has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only Super Admin can reassign customers';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_customer_assignment_permission ON public.customers;
CREATE TRIGGER enforce_customer_assignment_permission
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_customer_assignment_permission();

-- Also enforce on INSERT - only super_admin can assign to someone else
CREATE OR REPLACE FUNCTION public.check_customer_insert_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If assigning to someone other than yourself
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
    -- Only super_admin can assign to others
    IF NOT has_role(auth.uid(), 'super_admin') THEN
      RAISE EXCEPTION 'Only Super Admin can assign customers to other users';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_customer_insert_assignment ON public.customers;
CREATE TRIGGER enforce_customer_insert_assignment
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_customer_insert_assignment();