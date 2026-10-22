// Runs every migration in supabase/migrations on an in-memory Postgres (PGlite) with Supabase's
// auth.uid() and the anon / authenticated / service_role roles stood in, then checks what each
// kind of user may do to `profiles`.      npm run test:db
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function public.uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
let manager_stores = false;
for (const f of files) {
  // manager_stores is used by 20260311 but no migration in this repo creates it: a live database has it
  if (f.startsWith("20260311") && !manager_stores) {
    await db.exec(`create table public.manager_stores (manager_id uuid references auth.users(id) on delete cascade, store_id uuid references public.stores(id) on delete cascade, primary key (manager_id, store_id));
                   grant all on public.manager_stores to anon, authenticated, service_role;`);
    manager_stores = true;
  }
  await db.exec(readFileSync(join(dir, f), "utf8").replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/i, ""));
}

const id = { A: "00000000-0000-0000-0000-00000000000a", B: "00000000-0000-0000-0000-00000000000b",
  mgrA: "11111111-1111-4111-8111-111111111111", staffA: "22222222-2222-4222-8222-222222222222", staffB: "33333333-3333-4333-8333-333333333333" };
await db.exec(`
  insert into auth.users(id,email) values ('${id.mgrA}','m@a'),('${id.staffA}','s@a'),('${id.staffB}','t@b');
  insert into stores(id,name) values ('${id.A}','A'),('${id.B}','B');
  insert into profiles(id,store_id,full_name,role,employment_type,hourly_rate,is_approved) values
    ('${id.mgrA}','${id.A}','Mgr A','manager','fulltime',300,true),
    ('${id.staffA}','${id.A}','Staff A','staff','parttime',183,false),
    ('${id.staffB}','${id.B}','Staff B','staff','parttime',190,true);
  insert into manager_stores(manager_id, store_id) values ('${id.mgrA}','${id.A}');
`);

/** One statement as an API user: the role plus the JWT subject, so RLS and triggers see what they see in production. */
async function as(role, user, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user ?? ""}',false); set role ${role};`);
  try { const r = await db.query(sql); return { ok: true, count: r.affectedRows }; }
  catch (e) { return { ok: false, error: e.message }; }
  finally { await db.exec("reset role"); }
}
const row = async (who) => (await db.query(`select role, store_id, is_approved, hourly_rate, full_name from profiles where id='${who}'`)).rows[0];
const own = (field, value) => as("authenticated", id.staffA, `update profiles set ${field}=${value} where id='${id.staffA}'`);

// staff A (not yet approved) uses the public API with their own login
assert.equal((await own("full_name", "'Renamed'")).ok, true, "a staff member can still edit their name");
for (const [field, value] of [["role", "'manager'"], ["is_approved", "true"], ["hourly_rate", "9999"], ["store_id", `'${id.B}'`]]) {
  const r = await own(field, value);
  assert.equal(r.ok, false, `staff must not be able to change their own ${field}`);
}
assert.deepEqual(await row(id.staffA), { role: "staff", store_id: id.A, is_approved: false, hourly_rate: 183, full_name: "Renamed" });

// the legitimate paths still work
assert.equal((await as("authenticated", id.mgrA, `update profiles set is_approved=true, hourly_rate=200 where id='${id.staffA}'`)).count, 1, "a manager approves and re-rates staff of their store");
assert.equal((await as("authenticated", id.mgrA, `update profiles set role='manager' where id='${id.staffB}'`)).count, 0, "a manager cannot touch another store's staff");
assert.equal((await as("service_role", null, `update profiles set role='manager' where id='${id.staffA}'`)).ok, true, "the service role (Server Actions) is not blocked");
assert.equal((await row(id.staffA)).role, "manager");
assert.equal((await as("authenticated", id.mgrA, `update profiles set store_id='${id.B}' where id='${id.staffA}'`)).ok, false, "a manager cannot move someone into a store they do not manage");

// the same checks when profiles has no hourly_rate column (wages moved to another table):
// a trigger that names NEW.hourly_rate directly fails on EVERY update there
await db.exec("alter table profiles drop column hourly_rate");
await db.exec("reset role");
// (staff A is a manager by now, so staff B plays the ordinary employee)
const ownB = (field, value) => as("authenticated", id.staffB, `update profiles set ${field}=${value} where id='${id.staffB}'`);
assert.equal((await ownB("full_name", "'Again'")).ok, true, "editing a name still works without profiles.hourly_rate");
assert.equal((await ownB("role", "'manager'")).ok, false, "role is still protected without profiles.hourly_rate");
assert.equal((await as("authenticated", id.mgrA, `update profiles set is_approved=false where id='${id.staffA}'`)).count, 1, "a manager still works without profiles.hourly_rate");

console.log("profile column protection: all checks passed");
