-- ============================================
-- 多店面排班系統 - Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. STORES (分店表)
-- ============================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_created_at ON stores(created_at);

-- ============================================
-- 2. PROFILES (人員檔案 - 擴充 auth.users)
-- ============================================
CREATE TYPE user_role AS ENUM ('manager', 'staff');
CREATE TYPE employment_type AS ENUM ('fulltime', 'parttime');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  employment_type employment_type NOT NULL DEFAULT 'parttime',
  hourly_rate INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_store_id ON profiles(store_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- 3. AVAILABILITIES (空閒時間 - Input)
-- ============================================
CREATE TYPE availability_type AS ENUM ('available', 'leave');

CREATE TABLE availabilities (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slots TEXT[] NOT NULL DEFAULT '{}',
  type availability_type NOT NULL DEFAULT 'available',
  leave_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id, date)
);

CREATE INDEX idx_availabilities_store_date ON availabilities(store_id, date);
CREATE INDEX idx_availabilities_user_date ON availabilities(user_id, date);

-- ============================================
-- 4. SHIFTS (正式班表 - Output)
-- ============================================
CREATE TABLE shifts (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  assigned_slots TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id, date)
);

CREATE INDEX idx_shifts_store_date ON shifts(store_id, date);
CREATE INDEX idx_shifts_user_date ON shifts(user_id, date);

-- ============================================
-- 5. MONTHLY_CONFIGS (月度設定)
-- ============================================
CREATE TYPE month_status AS ENUM ('draft', 'published', 'locked');

CREATE TABLE monthly_configs (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  status month_status NOT NULL DEFAULT 'draft',
  closed_dates DATE[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, year_month)
);

CREATE INDEX idx_monthly_configs_store_month ON monthly_configs(store_id, year_month);

-- ============================================
-- 6. SHIFT_TEMPLATES (班別樣板)
-- ============================================
CREATE TABLE shift_templates (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shift_templates_store ON shift_templates(store_id);

-- ============================================
-- 7. AUDIT_LOGS (稽核日誌)
-- ============================================
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_store_created ON audit_logs(store_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STORES: 使用者只能看到自己的店面
-- ============================================
CREATE POLICY "Users can view their own store"
  ON stores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = stores.id
    )
  );

-- ============================================
-- PROFILES: 同店人員可讀取基本資料
-- ============================================
CREATE POLICY "Users can view profiles in their store"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS my_profile
      WHERE my_profile.id = auth.uid()
      AND my_profile.store_id = profiles.store_id
    )
  );

-- 使用者可以更新自己的基本資料（排除 role 和 hourly_rate）
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Manager 可以修改同店所有人員資料
CREATE POLICY "Managers can update all profiles in their store"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS my_profile
      WHERE my_profile.id = auth.uid()
      AND my_profile.role = 'manager'
      AND my_profile.store_id = profiles.store_id
    )
  );

-- Manager 可以新增人員
CREATE POLICY "Managers can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS my_profile
      WHERE my_profile.id = auth.uid()
      AND my_profile.role = 'manager'
      AND my_profile.store_id = profiles.store_id
    )
  );

-- ============================================
-- AVAILABILITIES: Staff 只能修改自己的
-- ============================================
CREATE POLICY "Users can view availabilities in their store"
  ON availabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = availabilities.store_id
    )
  );

CREATE POLICY "Users can insert their own availability"
  ON availabilities FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = availabilities.store_id
    )
  );

CREATE POLICY "Users can update their own availability"
  ON availabilities FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own availability"
  ON availabilities FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- SHIFTS: Manager 可讀寫，Staff 只能讀
-- ============================================
CREATE POLICY "Users can view shifts in their store"
  ON shifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = shifts.store_id
    )
  );

CREATE POLICY "Managers can insert shifts"
  ON shifts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = shifts.store_id
    )
  );

CREATE POLICY "Managers can update shifts"
  ON shifts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = shifts.store_id
    )
  );

CREATE POLICY "Managers can delete shifts"
  ON shifts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = shifts.store_id
    )
  );

-- ============================================
-- MONTHLY_CONFIGS: Manager 可讀寫
-- ============================================
CREATE POLICY "Users can view monthly configs in their store"
  ON monthly_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = monthly_configs.store_id
    )
  );

CREATE POLICY "Managers can manage monthly configs"
  ON monthly_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = monthly_configs.store_id
    )
  );

-- ============================================
-- SHIFT_TEMPLATES: Manager 可讀寫
-- ============================================
CREATE POLICY "Users can view shift templates in their store"
  ON shift_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = shift_templates.store_id
    )
  );

CREATE POLICY "Managers can manage shift templates"
  ON shift_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = shift_templates.store_id
    )
  );

-- ============================================
-- AUDIT_LOGS: 只能寫入，Manager 可讀
-- ============================================
CREATE POLICY "Users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.store_id = audit_logs.store_id
    )
  );

CREATE POLICY "Managers can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'manager'
      AND profiles.store_id = audit_logs.store_id
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER availabilities_updated_at BEFORE UPDATE ON availabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER monthly_configs_updated_at BEFORE UPDATE ON monthly_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shift_templates_updated_at BEFORE UPDATE ON shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
