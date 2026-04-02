-- ============================================
-- 修正多店管理 RLS 權限問題
-- 允許 Manager 查看其管理的所有分店資料
-- ============================================

-- 1. 建立取得目前使用者所有管理店面 ID 的函數
CREATE OR REPLACE FUNCTION get_my_managed_store_ids()
RETURNS UUID[] AS $$
DECLARE
  base_store_id UUID;
  managed_ids UUID[];
BEGIN
  -- 取得主店 ID
  SELECT store_id INTO base_store_id FROM profiles WHERE id = auth.uid();
  
  -- 取得管理店面 ID (包含主店)
  SELECT ARRAY_AGG(DISTINCT store_id) INTO managed_ids
  FROM (
    SELECT base_store_id AS store_id WHERE base_store_id IS NOT NULL
    UNION
    SELECT store_id FROM manager_stores WHERE manager_id = auth.uid()
  ) AS combined_stores;

  RETURN COALESCE(managed_ids, '{}'::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 更新 Profiles RLS (SELECT & UPDATE)
DROP POLICY IF EXISTS "Users can view profiles in their store" ON profiles;
CREATE POLICY "Users can view profiles in their store"
  ON profiles FOR SELECT
  USING (
    store_id = ANY(get_my_managed_store_ids())
  );

DROP POLICY IF EXISTS "Managers can update all profiles in their store" ON profiles;
CREATE POLICY "Managers can update all profiles in their store"
  ON profiles FOR UPDATE
  USING (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

-- 3. 更新 Availabilities RLS (SELECT)
DROP POLICY IF EXISTS "Users can view availabilities in their store" ON availabilities;
CREATE POLICY "Users can view availabilities in their store"
  ON availabilities FOR SELECT
  USING (
    store_id = ANY(get_my_managed_store_ids())
  );

-- 4. 更新 Shifts RLS (ALL)
DROP POLICY IF EXISTS "Users can view shifts in their store" ON shifts;
CREATE POLICY "Users can view shifts in their store"
  ON shifts FOR SELECT
  USING (
    store_id = ANY(get_my_managed_store_ids())
  );

DROP POLICY IF EXISTS "Managers can insert shifts" ON shifts;
CREATE POLICY "Managers can insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

DROP POLICY IF EXISTS "Managers can update shifts" ON shifts;
CREATE POLICY "Managers can update shifts"
  ON shifts FOR UPDATE
  USING (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

DROP POLICY IF EXISTS "Managers can delete shifts" ON shifts;
CREATE POLICY "Managers can delete shifts"
  ON shifts FOR DELETE
  USING (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

-- 5. 更新 Monthly Configs RLS (ALL)
DROP POLICY IF EXISTS "Users can view monthly configs in their store" ON monthly_configs;
CREATE POLICY "Users can view monthly configs in their store"
  ON monthly_configs FOR SELECT
  USING (
    store_id = ANY(get_my_managed_store_ids())
  );

DROP POLICY IF EXISTS "Managers can manage monthly configs" ON monthly_configs;
CREATE POLICY "Managers can manage monthly configs"
  ON monthly_configs FOR ALL
  USING (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

-- 6. 更新 Shift Templates RLS (ALL)
DROP POLICY IF EXISTS "Users can view shift templates in their store" ON shift_templates;
CREATE POLICY "Users can view shift templates in their store"
  ON shift_templates FOR SELECT
  USING (
    store_id = ANY(get_my_managed_store_ids())
  );

DROP POLICY IF EXISTS "Managers can manage shift templates" ON shift_templates;
CREATE POLICY "Managers can manage shift templates"
  ON shift_templates FOR ALL
  USING (
    store_id = ANY(get_my_managed_store_ids())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );
