-- v2: 結果の共有（追加の賞・定番賞の表示切替）とプッシュ通知（Web）
-- 1つ目の migration の後に実行する

-- ---------------------------------------------------------------------------
-- 賞
-- ---------------------------------------------------------------------------

-- 表示しない定番賞（'second','third','booby','booby_maker','best_gross'）。優勝は常に表示
alter table public.events add column if not exists hidden_awards text[] not null default '{}';

-- 幹事が自由に追加する賞
--   rank: N位（飛び賞）/ most_penalties: OB・罰打が最多（OB王）/ most_putts: パット最多 / manual: 幹事が受賞者を選ぶ
create table public.custom_awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (length(title) between 1 and 30),
  rule text not null check (rule in ('rank', 'most_penalties', 'most_putts', 'manual')),
  rank smallint check (rank between 1 and 200),
  winner_player_id uuid references public.players (id) on delete set null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index custom_awards_event_idx on public.custom_awards (event_id);
alter table public.custom_awards enable row level security;
create policy custom_awards_organizer_all on public.custom_awards for all to authenticated
  using (public.is_organizer(event_id)) with check (public.is_organizer(event_id));
grant select, insert, update, delete on public.custom_awards to authenticated;

-- ---------------------------------------------------------------------------
-- 幹事からの連絡
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  message text not null check (length(message) between 1 and 200),
  created_at timestamptz not null default now(),
  -- 通知を送った時刻（二重送信を防ぐ）
  sent_at timestamptz
);
create index announcements_event_idx on public.announcements (event_id, created_at desc);
alter table public.announcements enable row level security;
create policy announcements_organizer_all on public.announcements for all to authenticated
  using (public.is_organizer(event_id)) with check (public.is_organizer(event_id));
grant select, insert, delete on public.announcements to authenticated;

-- ---------------------------------------------------------------------------
-- プッシュ通知
-- ---------------------------------------------------------------------------

-- 最後に通知した暫定トップ（同じ人で何度も通知しないため）
alter table public.special_awards add column if not exists notified_winner_id uuid;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) < 200),
  auth text not null check (length(auth) < 100),
  -- 受け取る通知の種類
  drive_pin boolean not null default true,
  announcements boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
-- 幹事も含め、アプリからは直接読めない（関数経由のみ）

-- 通知の署名に使う鍵（VAPID）など。push 関数（service_role）だけが読み書きする
create table public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

-- 閲覧リンクのトークンで、この端末の通知の受け取りを登録・更新する
create or replace function public.save_push_subscription(
  p_view_token text, p_endpoint text, p_p256dh text, p_auth text,
  p_drive_pin boolean, p_announcements boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
begin
  select id into v_event from public.events where view_token = p_view_token;
  if v_event is null then
    raise exception 'invalid token' using errcode = 'P0002';
  end if;
  insert into public.push_subscriptions (event_id, endpoint, p256dh, auth, drive_pin, announcements)
  values (v_event, p_endpoint, p_p256dh, p_auth, p_drive_pin, p_announcements)
  on conflict (event_id, endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        drive_pin = excluded.drive_pin, announcements = excluded.announcements;
end $$;

create or replace function public.delete_push_subscription(p_view_token text, p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions s
  using public.events e
  where e.view_token = p_view_token and s.event_id = e.id and s.endpoint = p_endpoint
$$;

-- ---------------------------------------------------------------------------
-- 閲覧リンク・入力リンクの返す内容に、追加の賞と連絡を加える
-- ---------------------------------------------------------------------------

create or replace function public.event_public_json(e public.events) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'date', e.date,
    'course_name', e.course_name,
    'pars', e.pars,
    'handicap_method', e.handicap_method,
    'hidden_holes', case when e.status = 'final' then e.hidden_holes else '{}'::smallint[] end,
    'handicap_cap', e.handicap_cap,
    'visibility', e.visibility,
    'status', e.status,
    'track_putts', e.track_putts,
    'track_penalties', e.track_penalties,
    'hidden_awards', e.hidden_awards,
    'view_token', e.view_token
  )
$$;

create or replace function public.custom_awards_json(p_event_id uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'rule', c.rule, 'rank', c.rank,
    'winner_player_id', c.winner_player_id, 'sort', c.sort
  ) order by c.sort, c.created_at), '[]'::jsonb)
  from public.custom_awards c where c.event_id = p_event_id
$$;

create or replace function public.announcements_json(p_event_id uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'message', a.message, 'created_at', a.created_at
  ) order by a.created_at desc), '[]'::jsonb)
  from (
    select * from public.announcements where event_id = p_event_id order by created_at desc limit 5
  ) a
$$;

create or replace function public.get_event_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  e public.events;
  v_show_scores boolean;
begin
  select * into e from public.events where view_token = p_token;
  if not found then
    return null;
  end if;
  v_show_scores := e.status = 'final' or e.visibility = 'live';
  return jsonb_build_object(
    'event', public.event_public_json(e),
    'scores_hidden', not v_show_scores,
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'number', g.number, 'submitted_at', g.submitted_at
      ) order by g.number), '[]'::jsonb) from public.groups g where g.event_id = e.id),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'group_id', p.group_id, 'name', p.name, 'handicap', p.handicap, 'sort', p.sort,
        'holes_played', (select count(*) from public.scores s where s.player_id = p.id)
      ) order by p.sort, p.created_at), '[]'::jsonb) from public.players p where p.event_id = e.id),
    'scores', case when v_show_scores then (select coalesce(jsonb_agg(jsonb_build_object(
        'player_id', s.player_id, 'hole', s.hole, 'strokes', s.strokes,
        'putts', s.putts, 'penalties', s.penalties, 'updated_at', s.updated_at
      )), '[]'::jsonb) from public.scores s where s.event_id = e.id) else '[]'::jsonb end,
    'awards', public.awards_json(e.id),
    -- 追加の賞は、結果確定まで受賞者を伏せる（手動で選ぶ賞も含む）
    'custom_awards', case when e.status = 'final' then public.custom_awards_json(e.id) else '[]'::jsonb end,
    'announcements', public.announcements_json(e.id)
  );
end $$;

create or replace function public.get_group_input(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  g public.groups;
  e public.events;
begin
  select * into g from public.groups where input_token = p_token;
  if not found then
    return null;
  end if;
  select * into e from public.events where id = g.event_id;
  return jsonb_build_object(
    'event', public.event_public_json(e),
    'group', jsonb_build_object('id', g.id, 'number', g.number, 'submitted_at', g.submitted_at),
    'players', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'group_id', p.group_id, 'name', p.name, 'handicap', p.handicap, 'sort', p.sort
      ) order by p.sort, p.created_at), '[]'::jsonb) from public.players p where p.group_id = g.id),
    'scores', (select coalesce(jsonb_agg(jsonb_build_object(
        'player_id', s.player_id, 'hole', s.hole, 'strokes', s.strokes,
        'putts', s.putts, 'penalties', s.penalties, 'updated_at', s.updated_at
      )), '[]'::jsonb)
      from public.scores s join public.players p on p.id = s.player_id where p.group_id = g.id),
    'awards', public.awards_json(e.id),
    'all_players', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'group_id', p.group_id, 'name', p.name
      )), '[]'::jsonb) from public.players p where p.event_id = e.id),
    'announcements', public.announcements_json(e.id)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------------------

revoke execute on function public.save_push_subscription(text, text, text, text, boolean, boolean) from public;
revoke execute on function public.delete_push_subscription(text, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.delete_push_subscription(text, text) to anon, authenticated;

-- 通知を送る push 関数（service_role）が読み書きする表
grant usage on schema public to service_role;
grant select, insert, update, delete on public.push_subscriptions, public.app_secrets to service_role;
grant select, update on public.special_awards, public.announcements to service_role;
grant select on public.events, public.players, public.groups to service_role;
