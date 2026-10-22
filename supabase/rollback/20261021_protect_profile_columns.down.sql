-- 還原 20261021_protect_profile_columns.sql（只移除它加的東西；不動任何資料列）
-- 注意：還原後員工又能改自己的 role / store_id / is_approved / hourly_rate。
DROP TRIGGER IF EXISTS profiles_protect_columns ON profiles;
DROP FUNCTION IF EXISTS protect_profile_columns();
ALTER FUNCTION get_my_managed_store_ids() RESET search_path;
ALTER FUNCTION get_my_store_id() RESET search_path;
