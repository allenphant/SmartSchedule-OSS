-- ============================================
-- 修正 Google 登入與新人報到流程的資料庫結構
-- ============================================

-- 1. 允許 profiles 的 store_id 先為空 (因為 Google 登入時還不知道分店)
ALTER TABLE public.profiles ALTER COLUMN store_id DROP NOT NULL;

-- 2. 確保 stores 表有 code 欄位 (用於新人輸入代碼加入分店)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'code') THEN
        ALTER TABLE public.stores ADD COLUMN code TEXT;
        CREATE UNIQUE INDEX idx_stores_code ON stores(code);
    END IF;
END $$;

-- 3. 更新處理新用戶的 Function (移除 store_id, role 等欄位的寫入，改用預設值)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    false -- 預設未審核
  );
  RETURN NEW;
END;
$$;

-- 4. 建立一個輔助函數，讓新人可以透過代碼找到分店 ID (繞過 RLS)
CREATE OR REPLACE FUNCTION public.find_store_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_store_id UUID;
BEGIN
  SELECT id INTO v_store_id FROM public.stores WHERE code = p_code;
  RETURN v_store_id;
END;
$$;
