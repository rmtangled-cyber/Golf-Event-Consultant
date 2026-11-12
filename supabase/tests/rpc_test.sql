-- migration の権限と関数の振る舞いを確認する。失敗すると例外で止まる
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\o /dev/null

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
end $$;

create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error "%" but succeeded: %', p_like, p_sql;
exception when others then
  if sqlerrm not like p_like and coalesce(sqlerrm, '') not like 'expected error%' then
    raise exception 'expected error "%" but got "%": %', p_like, sqlerrm, p_sql;
  end if;
  if sqlerrm like 'expected error%' then raise; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- 1. 幹事 A がコンペを作る
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.create_event('テストコンペ', '2026-11-20', 'テストCC', 'shin-peoria',
  '{1,3,4,5,6,8,10,11,12,13,14,17}') as event_id \gset
insert into public.groups (event_id, number) values (:'event_id', 1), (:'event_id', 2);
select id as g1 from public.groups where number = 1 \gset
select id as g2 from public.groups where number = 2 \gset
insert into public.players (event_id, group_id, name, sort) values
  (:'event_id', :'g1', '山田', 1), (:'event_id', :'g1', '佐藤', 2), (:'event_id', :'g2', '鈴木', 3);
select id as p1 from public.players where name = '山田' \gset
select id as p2 from public.players where name = '佐藤' \gset
select id as p3 from public.players where name = '鈴木' \gset
insert into public.special_awards (event_id, kind, hole) values (:'event_id', 'drive', 4) returning id as award \gset
select input_token as t1 from public.groups where id = :'g1' \gset
select view_token as vt, organizer_invite_token as it from public.events where id = :'event_id' \gset
reset role;

-- 2. 幹事でない B には見えない。招待リンクで参加すると見える
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.events) = 0, 'B must not see the event';
end $$;
select public.join_event_as_organizer(:'it');
do $$ begin
  assert (select count(*) from public.events) = 1, 'B sees the event after joining';
end $$;
reset role;

-- 3. ログインなし（anon）はテーブルに触れず、幹事用の関数も呼べない
select pg_temp.as_user(null);
set role anon;
select pg_temp.expect_error('select * from public.events', 'permission denied%');
select pg_temp.expect_error('select * from public.scores', 'permission denied%');
select pg_temp.expect_error($$select public.create_event('x', '2026-01-01', '', 'none', '{}')$$, 'permission denied%');
select pg_temp.expect_error($$select public.open_group_for_input('x')$$, 'permission denied%');

-- 4. 組の入力リンク・閲覧リンク
do $$ begin
  assert public.get_group_input('nope') is null, 'unknown token returns null';
end $$;
select jsonb_array_length(public.get_group_input(:'t1') -> 'players') as n \gset
select (public.get_group_input(:'t1') -> 'players') @> jsonb_build_array(jsonb_build_object('name', '山田')) as has_yamada \gset
select (public.get_group_input(:'t1') -> 'players') @> jsonb_build_array(jsonb_build_object('name', '鈴木')) as has_suzuki \gset
select :'has_yamada'::boolean and not :'has_suzuki'::boolean and :n = 2 as ok \gset
\if :ok
\else
  \echo 'group input must contain only own group players' \q
\endif
select public.get_event_view(:'vt') -> 'event' -> 'hidden_holes' = '[]'::jsonb as hidden_ok \gset
\if :hidden_ok
\else
  \echo 'hidden holes must be hidden before final' \q
\endif

-- 5. スコア保存。古い入力では上書きしない。null で消える
select public.save_group_scores(:'t1', jsonb_build_array(
  jsonb_build_object('player_id', :'p1', 'hole', 1, 'strokes', 5, 'updated_at', '2026-11-20T10:00:00Z'),
  jsonb_build_object('player_id', :'p2', 'hole', 1, 'strokes', 4, 'putts', 2, 'updated_at', '2026-11-20T10:00:00Z')
)) as applied \gset
select public.save_group_scores(:'t1', jsonb_build_array(
  jsonb_build_object('player_id', :'p1', 'hole', 1, 'strokes', 9, 'updated_at', '2026-11-20T09:00:00Z')
)) as stale \gset
select public.save_group_scores(:'t1', jsonb_build_array(
  jsonb_build_object('player_id', :'p2', 'hole', 1, 'strokes', null, 'updated_at', '2026-11-20T11:00:00Z')
)) as cleared \gset
select :applied = 2 and :stale = 0 and :cleared = 1 as ok \gset
\if :ok
\else
  \echo 'save_group_scores: applied/stale/cleared = ' :applied :stale :cleared \q
\endif
select pg_temp.expect_error(format($$select public.save_group_scores(%L, %L)$$, :'t1',
  jsonb_build_array(jsonb_build_object('player_id', :'p3', 'hole', 1, 'strokes', 4))), 'player not in group');

-- 6. ドラコン：他の組の人は暫定トップにできない
select pg_temp.expect_error(format($$select public.set_award_winner(%L, %L, %L, '')$$, :'t1', :'award', :'p3'), 'player not in group');
select public.set_award_winner(:'t1', :'award', :'p2', '');

-- 7. 提出：18ホール揃っていないと不可。提出後は入力不可
select pg_temp.expect_error(format($$select public.submit_group(%L)$$, :'t1'), 'scores incomplete');
select public.save_group_scores(:'t1', (
  select jsonb_agg(jsonb_build_object('player_id', p, 'hole', h, 'strokes', 4))
  from unnest(array[:'p1', :'p2']::uuid[]) p, generate_series(1, 18) h
));
select public.submit_group(:'t1');
select pg_temp.expect_error(format($$select public.save_group_scores(%L, %L)$$, :'t1',
  jsonb_build_array(jsonb_build_object('player_id', :'p1', 'hole', 1, 'strokes', 3))), 'group submitted');
reset role;

-- 8. 提出後も幹事は直せる
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update public.scores set strokes = 3 where player_id = :'p1' and hole = 1;
do $$ begin
  assert (select strokes from public.scores where hole = 1 and strokes = 3) = 3, 'organizer edit';
end $$;
update public.events set visibility = 'hidden' where id = :'event_id';
reset role;

-- 9. 非公開設定ならスコアは返さない。結果確定で公開され、隠しホールも出る
select pg_temp.as_user(null);
set role anon;
select (public.get_event_view(:'vt') ->> 'scores_hidden')::boolean
   and jsonb_array_length(public.get_event_view(:'vt') -> 'scores') = 0 as ok \gset
\if :ok
\else
  \echo 'hidden visibility must not return scores' \q
\endif
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update public.events set status = 'final' where id = :'event_id';
reset role;
set role anon;
select jsonb_array_length(public.get_event_view(:'vt') -> 'scores') = 36
   and jsonb_array_length(public.get_event_view(:'vt') -> 'event' -> 'hidden_holes') = 12 as ok \gset
\if :ok
\else
  \echo 'final event must reveal scores and hidden holes' \q
\endif
reset role;

\o
\echo 'ALL RPC TESTS PASSED'
