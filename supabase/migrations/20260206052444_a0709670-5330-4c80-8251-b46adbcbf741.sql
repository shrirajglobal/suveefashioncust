-- Function to get employee_id from user_id
CREATE OR REPLACE FUNCTION public.get_employee_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id
  FROM public.employee_master
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to check if user is a staff member
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'staff'::app_role
  );
END;
$$;

-- Function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'manager'::app_role
  );
END;
$$;

-- Function to check if employee reports to a manager
CREATE OR REPLACE FUNCTION public.is_team_member(_manager_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.employee_master em
    JOIN public.employee_master mgr ON em.reporting_manager_id = mgr.employee_id
    WHERE mgr.user_id = _manager_user_id
      AND em.employee_id = _employee_id
  );
END;
$$;

-- RLS policies for attendance_logs - Staff
CREATE POLICY "Staff can view own attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Staff can insert own attendance logs"
  ON public.attendance_logs FOR INSERT
  WITH CHECK (employee_id = get_employee_id(auth.uid()));

-- RLS policies for attendance_logs - Managers
CREATE POLICY "Managers can view team attendance logs"
  ON public.attendance_logs FOR SELECT
  USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

CREATE POLICY "Managers can update team attendance logs"
  ON public.attendance_logs FOR UPDATE
  USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

-- RLS policies for attendance_review - Managers
CREATE POLICY "Managers can view team reviews"
  ON public.attendance_review FOR SELECT
  USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), (
    SELECT employee_id FROM public.attendance_logs WHERE log_id = attendance_review.log_id
  )));

CREATE POLICY "Managers can insert reviews for team"
  ON public.attendance_review FOR INSERT
  WITH CHECK (is_manager(auth.uid()) AND is_team_member(auth.uid(), (
    SELECT employee_id FROM public.attendance_logs WHERE log_id = attendance_review.log_id
  )));

CREATE POLICY "Managers can update own reviews"
  ON public.attendance_review FOR UPDATE
  USING (is_manager(auth.uid()) AND manager_id = get_employee_id(auth.uid()));

-- RLS policies for monthly_payroll - Staff and Managers
CREATE POLICY "Staff can view own payroll"
  ON public.monthly_payroll FOR SELECT
  USING (employee_id = get_employee_id(auth.uid()));

CREATE POLICY "Managers can view team payroll"
  ON public.monthly_payroll FOR SELECT
  USING (is_manager(auth.uid()) AND is_team_member(auth.uid(), employee_id));

-- RLS policies for staff_payments - Staff
CREATE POLICY "Staff can view own payments"
  ON public.staff_payments FOR SELECT
  USING (employee_id = get_employee_id(auth.uid()));

-- Storage policies for staff
CREATE POLICY "Staff can view own payslips"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payslips' 
    AND (storage.foldername(name))[1] = get_employee_id(auth.uid())::text
  );

CREATE POLICY "Staff can upload own attendance selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-selfies' 
    AND (storage.foldername(name))[1] = get_employee_id(auth.uid())::text
  );