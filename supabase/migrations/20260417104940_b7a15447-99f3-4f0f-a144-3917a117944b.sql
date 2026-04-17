
-- 1. Remove broad "auth.uid() IS NOT NULL" policy on profiles
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

-- 2. Remove broad "auth.uid() IS NOT NULL" policy on user_roles
DROP POLICY IF EXISTS "Require authentication for user_roles" ON public.user_roles;

-- 3. Make payslips bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payslips';

-- 4. Drop the public read policy on payslips
DROP POLICY IF EXISTS "Public can view payslips" ON storage.objects;

-- 5. Add scoped read policies on payslips
-- Staff can read their own payslip files (path layout: {employee_id}/...)
CREATE POLICY "Staff can read own payslips"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payslips'
  AND (storage.foldername(name))[1] = (public.get_employee_id(auth.uid()))::text
);

-- Admins/accounts can read all payslips
CREATE POLICY "Admins can read all payslips"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_admin_or_accounts(auth.uid())
);

-- Admins/accounts can write/delete payslips (edge function uses service role anyway)
CREATE POLICY "Admins can manage payslips"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'payslips'
  AND public.is_admin_or_accounts(auth.uid())
)
WITH CHECK (
  bucket_id = 'payslips'
  AND public.is_admin_or_accounts(auth.uid())
);
