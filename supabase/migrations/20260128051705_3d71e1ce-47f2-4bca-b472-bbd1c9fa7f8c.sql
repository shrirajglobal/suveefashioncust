-- 1. Add last_contacted_date to existing customers table
ALTER TABLE public.customers
ADD COLUMN last_contacted_date timestamp with time zone;

-- 2. Create interaction_type enum
CREATE TYPE public.interaction_type AS ENUM (
  'phone_call',
  'whatsapp',
  'email',
  'in_person',
  'sms',
  'other'
);

-- 3. Create interaction_outcome enum
CREATE TYPE public.interaction_outcome AS ENUM (
  'successful',
  'no_answer',
  'callback_requested',
  'not_interested',
  'order_placed',
  'follow_up_needed',
  'other'
);

-- 4. Create interactions table
CREATE TABLE public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  salesperson_id uuid NOT NULL,
  interaction_type public.interaction_type NOT NULL,
  interaction_outcome public.interaction_outcome NOT NULL,
  notes text NOT NULL CHECK (char_length(trim(notes)) > 0),
  interaction_datetime timestamp with time zone NOT NULL DEFAULT now(),
  next_followup_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Create indexes for better query performance
CREATE INDEX idx_interactions_customer_id ON public.interactions(customer_id);
CREATE INDEX idx_interactions_salesperson_id ON public.interactions(salesperson_id);
CREATE INDEX idx_interactions_datetime ON public.interactions(interaction_datetime DESC);
CREATE INDEX idx_interactions_next_followup ON public.interactions(next_followup_date) WHERE next_followup_date IS NOT NULL;

-- 6. Enable RLS on interactions
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for interactions
-- Admins/Accounts can view all interactions
CREATE POLICY "Admins can view all interactions"
ON public.interactions FOR SELECT
USING (is_admin_or_accounts(auth.uid()));

-- Admins/Accounts can insert interactions
CREATE POLICY "Admins can insert interactions"
ON public.interactions FOR INSERT
WITH CHECK (is_admin_or_accounts(auth.uid()));

-- Admins/Accounts can update interactions
CREATE POLICY "Admins can update interactions"
ON public.interactions FOR UPDATE
USING (is_admin_or_accounts(auth.uid()));

-- Admins/Accounts can delete interactions
CREATE POLICY "Admins can delete interactions"
ON public.interactions FOR DELETE
USING (is_admin_or_accounts(auth.uid()));

-- Sales team can view interactions for their assigned customers
CREATE POLICY "Sales can view assigned customer interactions"
ON public.interactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = interactions.customer_id
    AND customers.assigned_to = auth.uid()
  )
);

-- Sales team can insert interactions for their assigned customers
CREATE POLICY "Sales can insert assigned customer interactions"
ON public.interactions FOR INSERT
WITH CHECK (
  salesperson_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = interactions.customer_id
    AND customers.assigned_to = auth.uid()
  )
);

-- Sales team can update their own interactions
CREATE POLICY "Sales can update own interactions"
ON public.interactions FOR UPDATE
USING (salesperson_id = auth.uid());

-- Sales team can delete their own interactions
CREATE POLICY "Sales can delete own interactions"
ON public.interactions FOR DELETE
USING (salesperson_id = auth.uid());

-- 8. Create trigger to auto-update last_contacted_date on customer when interaction is added
CREATE OR REPLACE FUNCTION public.update_customer_last_contacted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET last_contacted_date = NEW.interaction_datetime
  WHERE id = NEW.customer_id
    AND (last_contacted_date IS NULL OR last_contacted_date < NEW.interaction_datetime);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_last_contacted
AFTER INSERT ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_last_contacted();

-- 9. Create a view for customer analytics with calculated fields
CREATE OR REPLACE VIEW public.customer_analytics AS
SELECT 
  c.id AS customer_id,
  c.name,
  c.mobile_no AS phone,
  c.city,
  c.assigned_to AS assigned_salesperson_id,
  p.full_name AS assigned_salesperson_name,
  c.last_contacted_date,
  -- Days since last contact (NULL if never contacted)
  CASE 
    WHEN c.last_contacted_date IS NOT NULL 
    THEN EXTRACT(DAY FROM (now() - c.last_contacted_date))::integer
    ELSE NULL
  END AS days_since_last_contact,
  -- Total lifetime sales from transactions
  COALESCE(t.total_sales, 0) AS total_lifetime_sales,
  -- Last order date
  t.last_order_date,
  -- Days since last order
  CASE 
    WHEN t.last_order_date IS NOT NULL 
    THEN (CURRENT_DATE - t.last_order_date)
    ELSE NULL
  END AS days_since_last_order,
  -- Priority score: higher = more urgent to contact
  -- Based on: days since contact (40%), days since order (40%), lifetime value (20%)
  CASE
    WHEN c.last_contacted_date IS NULL AND t.last_order_date IS NULL THEN 100 -- Never contacted, never ordered
    ELSE
      LEAST(100, (
        -- Days since contact component (0-40 points)
        COALESCE(
          LEAST(40, EXTRACT(DAY FROM (now() - c.last_contacted_date))::integer * 0.5),
          40 -- Max if never contacted
        ) +
        -- Days since order component (0-40 points)  
        COALESCE(
          LEAST(40, (CURRENT_DATE - t.last_order_date) * 0.5),
          40 -- Max if never ordered
        ) +
        -- Lifetime value component (0-20 points) - higher value = higher priority
        LEAST(20, COALESCE(t.total_sales, 0) / 10000)
      ))
  END AS priority_score,
  c.dnd,
  c.created_at
FROM public.customers c
LEFT JOIN public.profiles p ON c.assigned_to = p.user_id
LEFT JOIN (
  SELECT 
    customer_id,
    SUM(amount) AS total_sales,
    MAX(transaction_date) AS last_order_date
  FROM public.transactions
  GROUP BY customer_id
) t ON c.id = t.customer_id;