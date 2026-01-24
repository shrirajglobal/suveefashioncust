-- Update trigger function to allow accounts role to assign customers on insert
CREATE OR REPLACE FUNCTION public.check_customer_insert_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If assigning to someone other than yourself
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
    -- Only super_admin or accounts can assign to others
    IF NOT is_admin_or_accounts(auth.uid()) THEN
      RAISE EXCEPTION 'Only Super Admin or Accounts can assign customers to other users';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update trigger function to allow accounts role to reassign customers
CREATE OR REPLACE FUNCTION public.check_customer_assignment_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If assigned_to is being changed
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Only super_admin or accounts can change assignments
    IF NOT is_admin_or_accounts(auth.uid()) THEN
      RAISE EXCEPTION 'Only Super Admin or Accounts can reassign customers';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;