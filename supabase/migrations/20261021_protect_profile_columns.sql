-- ============================================
-- 20261021: 員工不能再改自己的 role / store_id / is_approved / hourly_rate
--
-- 001_init_schema.sql 的 "Users can update their own profile" 只有列層級的
-- USING (id = auth.uid())。RLS 管不到「哪些欄位」，所以員工只要拿公開的 anon key
-- 加自己的登入 token 對 REST 發 PATCH，就能把自己改成 manager、自己核准自己、
-- 改自己的時薪。這個 trigger 在資料庫端擋住這四個欄位。
--
-- 放行的人：
--   * 沒有使用者身分的連線（service role 的 Server Action、SQL Editor）
--   * 該店的 manager（舊店與新店都必須是他管理的店）
-- 前置條件：已套用 20260311_fix_multi_store_rls.sql（需要 get_my_managed_store_ids()
-- 與 manager_stores 表）。
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

DROP TRIGGER IF EXISTS profiles_protect_columns ON profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_columns();

-- SECURITY DEFINER 函式固定 search_path（Supabase 安全檢查的建議）
ALTER FUNCTION get_my_managed_store_ids() SET search_path = public;
ALTER FUNCTION get_my_store_id() SET search_path = public;
