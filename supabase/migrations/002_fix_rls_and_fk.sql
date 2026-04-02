-- ============================================
-- 002_fix_rls_and_fk.sql
-- 修正 RLS 無限遞迴 & Foreign Key 關聯問題
-- ============================================

-- 1. 建立 get_my_store_id() 函數以避免 RLS 遞迴
CREATE OR REPLACE FUNCTION get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. 修正 Profiles RLS
DROP POLICY IF EXISTS "Users can view profiles in their store" ON profiles;
CREATE POLICY "Users can view profiles in their store"
  ON profiles FOR SELECT
  USING (
    store_id = get_my_store_id()
  );

DROP POLICY IF EXISTS "Managers can update all profiles in their store" ON profiles;
CREATE POLICY "Managers can update all profiles in their store"
  ON profiles FOR UPDATE
  USING (
    store_id = get_my_store_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- 3. 修正 Availabilities RLS
DROP POLICY IF EXISTS "Users can view availabilities in their store" ON availabilities;
CREATE POLICY "Users can view availabilities in their store"
  ON availabilities FOR SELECT
  USING (
    store_id = get_my_store_id()
  );

-- 4. 修正 Shifts RLS
DROP POLICY IF EXISTS "Users can view shifts in their store" ON shifts;
CREATE POLICY "Users can view shifts in their store"
  ON shifts FOR SELECT
  USING (
    store_id = get_my_store_id()
  );

-- 5. 修正 Audit Logs RLS
DROP POLICY IF EXISTS "Managers can view audit logs" ON audit_logs;
CREATE POLICY "Managers can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    store_id = get_my_store_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'manager'
    )
  );


-- ============================================
-- 修正 Foreign Key 關聯 (改為關聯 profiles)
-- ============================================

-- Audit Logs
ALTER TABLE audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Availabilities
ALTER TABLE availabilities
DROP CONSTRAINT IF EXISTS availabilities_user_id_fkey;

ALTER TABLE availabilities
ADD CONSTRAINT availabilities_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Shifts
ALTER TABLE shifts
DROP CONSTRAINT IF EXISTS shifts_user_id_fkey;

ALTER TABLE shifts
ADD CONSTRAINT shifts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


-- ============================================
-- 初始化資料 Helper (僅供測試使用)
-- Usage: SELECT init_test_data('My Initial Store');
-- ============================================
CREATE OR REPLACE FUNCTION init_test_data(store_name TEXT)
RETURNS VOID AS $$
DECLARE
  new_store_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if user exists
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not logged in';
  END IF;

  -- Create Store
  INSERT INTO stores (name)
  VALUES (store_name)
  RETURNING id INTO new_store_id;

  -- Create Manager Profile for current user
  INSERT INTO profiles (id, store_id, full_name, role, employment_type)
  VALUES (current_user_id, new_store_id, 'Test Manager', 'manager', 'fulltime')
  ON CONFLICT (id) DO UPDATE
  SET store_id = EXCLUDED.store_id,
      role = 'manager';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
