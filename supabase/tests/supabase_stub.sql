-- ローカルの素の Postgres で migration をテストするための Supabase 互換スタブ
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
-- 「Automatically expose new tables」がオフのプロジェクトと同じく、表の既定権限は付けない。
-- migration が必要な権限を自分で付けていることを確かめるため。
-- （関数の EXECUTE は Postgres の既定どおり PUBLIC に付く）
