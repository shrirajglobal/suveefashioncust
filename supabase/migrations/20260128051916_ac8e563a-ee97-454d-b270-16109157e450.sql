-- Update customer_analytics view with new priority_score formula
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
  -- Days since last contact (NULL if never contacted, 9999 for calculation purposes)
  CASE 
    WHEN c.last_contacted_date IS NOT NULL 
    THEN EXTRACT(DAY FROM (now() - c.last_contacted_date))::integer
    ELSE NULL
  END AS days_since_last_contact,
  -- Total lifetime sales from transactions
  COALESCE(t.total_sales, 0)::numeric AS total_lifetime_sales,
  -- Last order date
  t.last_order_date,
  -- Days since last order
  CASE 
    WHEN t.last_order_date IS NOT NULL 
    THEN (CURRENT_DATE - t.last_order_date)
    ELSE NULL
  END AS days_since_last_order,
  -- Priority score formula: (total_lifetime_sales * 0.6) + (days_since_last_contact * 0.4)
  -- Higher score = higher priority (more valuable customer + longer since contact)
  -- For customers never contacted, use 365 days as default for calculation
  ROUND(
    (COALESCE(t.total_sales, 0) * 0.6) + 
    (COALESCE(
      EXTRACT(DAY FROM (now() - c.last_contacted_date))::numeric,
      365 -- Default to 365 days if never contacted
    ) * 0.4),
    2
  ) AS priority_score,
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