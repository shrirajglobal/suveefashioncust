-- Fix security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.customer_analytics;

CREATE VIEW public.customer_analytics
WITH (security_invoker = on)
AS
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