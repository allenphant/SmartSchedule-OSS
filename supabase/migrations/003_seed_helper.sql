-- ============================================
-- 003_seed_helper.sql
-- 建立可指定 User ID 的初始化函數
-- ============================================

CREATE OR REPLACE FUNCTION init_test_data_v2(store_name TEXT, target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  new_store_id UUID;
BEGIN
  -- 1. Create Store
  INSERT INTO stores (name)
  VALUES (store_name)
  RETURNING id INTO new_store_id;

  -- 2. Create Manager Profile for the target user
  INSERT INTO profiles (id, store_id, full_name, role, employment_type)
  VALUES (target_user_id, new_store_id, 'Test Manager', 'manager', 'fulltime')
  ON CONFLICT (id) DO UPDATE
  SET store_id = EXCLUDED.store_id,
      role = 'manager';

  RAISE NOTICE 'Created Store: % (ID: %)', store_name, new_store_id;
  RAISE NOTICE 'Created Profile for User: %', target_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
