-- 1. Create function to handle new user insertion
--    This function automatically creates a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert into public.profiles
  -- Note: We only insert specific fields available from auth (email, name, avatar).
  -- Store ID, Role, etc. are left NULL (or default) to be filled during onboarding.
  insert into public.profiles (id, email, full_name, avatar_url, is_approved)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    false -- User starts as unapproved
  );
  return new;
end;
$$;

-- 2. Create the trigger
--    This fires AFTER every insert into auth.users (e.g., Google login or Email signup)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. (Optional) Backfill existing users if needed?
--    No, existing users already have profiles.
