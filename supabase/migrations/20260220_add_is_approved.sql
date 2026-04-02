-- Add is_approved column to profiles table
ALTER TABLE profiles 
ADD COLUMN is_approved BOOLEAN DEFAULT false;

-- Backfill: Set existing users to true (so current managers/staff don't get locked out)
UPDATE profiles SET is_approved = true;

-- (Optional) If you want the created_at column for sorting
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
