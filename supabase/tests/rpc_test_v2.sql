-- v2（追加の賞・連絡・プッシュ通知の登録）の権限と振る舞い
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\o /dev/null

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
end $$;
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error "%" but succeeded: %', p_like, p_sql;
exception when others then
  if sqlerrm like 'expected error%' then raise; end if;
  if sqlerrm not like p_like then
    raise exception 'expected error "%" but got "%": %', p_like, sqlerrm, p_sql;
  end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select public.create_event('v2コンペ', '2026-12-01', '', 'none', '{}') as event_id \gset
insert into public.groups (event_id, number) values (:'event_id', 1) returning id as g1 \gset
insert into public.players (event_id, group_id, name) values (:'event_id', :'g1', '山田') returning id as p1 \gset
insert into public.custom_awards (event_id, title, rule, rank) values (:'event_id', '飛び賞', 'rank', 7);
insert into public.custom_awards (event_id, title, rule, winner_player_id) values (:'event_id', 'ラッキー賞', 'manual', :'p1');
update public.events set hidden_awards = '{booby_maker}', pars_confirmed = true where id = :'event_id';
insert into public.announcements (event_id, message) values (:'event_id', '表彰式は17:30から') returning id as ann \gset
select view_token as vt from public.events where id = :'event_id' \gset
reset role;

-- 閲覧リンク：連絡は見える。追加の賞は結果確定まで伏せる
select pg_temp.as_user(null);
set role anon;
select (public.get_event_view(:'vt') -> 'announcements' -> 0 ->> 'message') = '表彰式は17:30から'
   and jsonb_array_length(public.get_event_view(:'vt') -> 'custom_awards') = 0
   and public.get_event_view(:'vt') -> 'event' -> 'hidden_awards' = '["booby_maker"]'::jsonb as ok \gset
\if :ok
\else
  \o
  \echo 'view must show announcements, hide custom awards before final' \q
\endif
select pg_temp.expect_error('select * from public.announcements', 'permission denied%');
select pg_temp.expect_error('select * from public.custom_awards', 'permission denied%');
select pg_temp.expect_error('select * from public.push_subscriptions', 'permission denied%');
select pg_temp.expect_error('select * from public.app_secrets', 'permission denied%');

-- 通知の登録：閲覧リンクのトークンで。同じ端末は上書き
select public.save_push_subscription(:'vt', 'https://push.example/abc', 'k1', 'a1', true, false);
select public.save_push_subscription(:'vt', 'https://push.example/abc', 'k2', 'a2', true, true);
select pg_temp.expect_error(format($$select public.save_push_subscription('nope', %L, 'k', 'a', true, true)$$, 'https://push.example/x'), 'invalid token');
select pg_temp.expect_error(format($$select public.save_push_subscription(%L, 'http://insecure', 'k', 'a', true, true)$$, :'vt'), '%push_subscriptions_endpoint_check%');
reset role;

-- 幹事でも、通知の登録内容は直接読めない
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select pg_temp.expect_error('select * from public.push_subscriptions', 'permission denied%');
update public.events set status = 'final' where id = :'event_id';
reset role;

-- push 関数（service_role）は読める
set role service_role;
select count(*) = 1 and bool_and(announcements) and bool_and(p256dh = 'k2') as ok from public.push_subscriptions \gset
\if :ok
\else
  \o
  \echo 'subscription upsert failed' \q
\endif
update public.special_awards set notified_winner_id = null;
insert into public.app_secrets (name, value) values ('vapid_public', 'x');
reset role;

-- 結果確定後は追加の賞も返る。登録の解除
select pg_temp.as_user(null);
set role anon;
select jsonb_array_length(public.get_event_view(:'vt') -> 'custom_awards') = 2 as ok \gset
\if :ok
\else
  \o
  \echo 'custom awards must be returned after final' \q
\endif
select public.delete_push_subscription(:'vt', 'https://push.example/abc');
reset role;
set role service_role;
select count(*) = 0 as ok from public.push_subscriptions \gset
\if :ok
\else
  \o
  \echo 'unsubscribe failed' \q
\endif
reset role;

\o
\echo 'ALL V2 TESTS PASSED'
