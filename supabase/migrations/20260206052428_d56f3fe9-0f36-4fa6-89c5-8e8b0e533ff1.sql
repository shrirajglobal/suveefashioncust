-- Step 1: Add user_id column to employee_master
ALTER TABLE public.employee_master 
ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_employee_master_user_id ON public.employee_master(user_id);