-- Minimal stand-in for Supabase's auth schema so migrations run on plain
-- Postgres in CI. Never run this against a real Supabase project.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
