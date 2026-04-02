-- Add function to get all stores (id, name) for the dropdown
-- This allows authenticated users (even those without a profile) to see the list of stores.
CREATE OR REPLACE FUNCTION public.get_all_stores_public()
RETURNS TABLE (id UUID, name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT stores.id, stores.name FROM stores ORDER BY stores.name;
END;
$$;
