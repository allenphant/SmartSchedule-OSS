-- ============================================
-- 熱修：把 protect_profile_columns() 換成「欄位不存在也不會出錯」的版本
--
-- 什麼情況要跑：你已經執行過第一版 20261021_protect_profile_columns.sql，而你的
-- profiles 表已經沒有 hourly_rate 欄位（薪資搬到 employee_salary 之後）。
-- 第一版直接寫 NEW.hourly_rate，欄位不存在時，登入使用者對 profiles 的「每一次」UPDATE
-- 都會報：record "new" has no field "hourly_rate"。
--
-- 這個檔案只做一件事：CREATE OR REPLACE 這個函式。不動 trigger、不動任何資料。
-- 可以重複執行；profiles 有沒有 hourly_rate 都適用。
-- ============================================

CREATE OR REPLACE FUNCTION protect_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- service role 與直接連線沒有 auth.uid()；anon 沒有身分也過不了 RLS 的 USING
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 用 to_jsonb 比對：某個欄位不存在（例如薪資已搬到別的表、hourly_rate 欄位已移除）
  -- 時取到的是 NULL 對 NULL，不會報錯；直接寫 NEW.hourly_rate 在欄位不存在時每次更新都會出錯。
  IF to_jsonb(NEW) -> 'role' IS NOT DISTINCT FROM to_jsonb(OLD) -> 'role'
     AND to_jsonb(NEW) -> 'store_id' IS NOT DISTINCT FROM to_jsonb(OLD) -> 'store_id'
     AND to_jsonb(NEW) -> 'is_approved' IS NOT DISTINCT FROM to_jsonb(OLD) -> 'is_approved'
     AND to_jsonb(NEW) -> 'hourly_rate' IS NOT DISTINCT FROM to_jsonb(OLD) -> 'hourly_rate' THEN
    RETURN NEW;
  END IF;

  IF (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'manager'
     AND OLD.store_id = ANY (get_my_managed_store_ids())
     AND NEW.store_id = ANY (get_my_managed_store_ids()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only a manager of this store can change role, store, approval or hourly rate'
    USING ERRCODE = '42501';
END;
$$;
