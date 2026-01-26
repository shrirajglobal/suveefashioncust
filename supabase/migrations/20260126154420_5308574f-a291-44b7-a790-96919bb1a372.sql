-- Add DND column to customers table
ALTER TABLE public.customers 
ADD COLUMN dnd boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.dnd IS 'Do Not Disturb flag - when true, sales team cannot see contact details';