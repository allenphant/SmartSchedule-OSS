-- ============================================
-- 1. 確保 store_id 可以為空
-- ============================================
-- 這行確保新人登入時不用立即有分店
ALTER TABLE public.profiles ALTER COLUMN store_id DROP NOT NULL;

-- ============================================
-- 2. 確保 full_name 可以為空 (如果 Google 沒給)
-- ============================================
-- 這行確保即使 Google 沒給名字也能成功註冊
ALTER TABLE public.profiles ALTER COLUMN full_name DROP NOT NULL;

-- ============================================
-- 3. 確保 role 和 type 有預設值 (確保不會為空)
-- ============================================
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'staff';
ALTER TABLE public.profiles ALTER COLUMN employment_type SET DEFAULT 'parttime';
ALTER TABLE public.profiles ALTER COLUMN hourly_rate SET DEFAULT 0;

-- ============================================
-- 4. 最強版本的新用戶處理邏輯 (加上防呆機制)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- 使用 COALESCE 確保名字有人填，如果沒名字就填 Email 帳號
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1) -- 如果上面的都沒有，就拿 email 的 @ 前面當名字
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- 如果發生錯誤，把它記錄下來但不中斷流程 (或者您可以選擇 RAISE EXCEPTION)
  -- 但為了讓用戶能登入，這裡我們選擇 RAISE NOTICE 讓開發者在 Log 看到
  RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 因為函數已經建立，這裡不需要再重建 Trigger，只要函數內容更新即可生效。
-- 但為了保險起見，我們還是重建一次：
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
