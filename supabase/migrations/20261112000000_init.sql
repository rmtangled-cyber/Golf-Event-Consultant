-- ゴルフコンペ v1: コンペ共有・組代表入力
--
-- アクセスモデル
--   幹事（LINEログイン = authenticated）: event_organizers に登録されたコンペを RLS 経由で直接読み書き
--   組代表・閲覧者（ログインなし = anon）: テーブルには一切アクセスできず、
--     リンクのトークンを引数に取る security definer 関数だけを呼べる

-- ---------------------------------------------------------------------------
-- ユーティリティ
-- ---------------------------------------------------------------------------

create or replace function public.new_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '')
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  date date not null default current_date,
  course_name text not null default '',
  pars smallint[] not null default '{4,4,3,5,4,4,3,4,5,4,4,3,5,4,4,3,4,5}',
  handicap_method text not null default 'shin-peoria'
    check (handicap_method in ('shin-peoria', 'fixed', 'none')),
  hidden_holes smallint[] not null default '{}',
  handicap_cap numeric(4, 1) not null default 36,
  -- live: プレー中も順位を公開 / hidden: 結果確定まで非公開
  visibility text not null default 'live' check (visibility in ('live', 'hidden')),
  -- open: 開催中 / final: 結果確定（以後は幹事のみ編集可）
  status text not null default 'open' check (status in ('open', 'final')),
  track_putts boolean not null default false,
  track_penalties boolean not null default false,
  view_token text not null unique default public.new_token(),
  organizer_invite_token text not null unique default public.new_token(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_pars_18 check (array_length(pars, 1) = 18)
);

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create table public.event_organizers (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_organizers_user_idx on public.event_organizers (user_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  number smallint not null check (number between 1 and 99),
  input_token text not null unique default public.new_token(),
  submitted_at timestamptz,
  unique (event_id, number)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  name text not null check (length(name) between 1 and 40),
  handicap numeric(4, 1),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index players_event_idx on public.players (event_id);
create index players_group_idx on public.players (group_id);

create table public.scores (
  player_id uuid not null references public.players (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  hole smallint not null check (hole between 1 and 18),
  strokes smallint not null check (strokes between 1 and 30),
  putts smallint check (putts between 0 and 20),
  penalties smallint check (penalties between 0 and 20),
  -- 端末で入力した時刻。電波が戻ってから遅れて届いた古い入力で上書きしないために使う
  updated_at timestamptz not null default now(),
  primary key (player_id, hole)
);
create index scores_event_idx on public.scores (event_id);

create table public.special_awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('drive', 'pin')),
  hole smallint not null check (hole between 1 and 18),
  winner_player_id uuid references public.players (id) on delete set null,
  note text not null default '',
  updated_at timestamptz not null default now()
);
create index special_awards_event_idx on public.special_awards (event_id);

create trigger special_awards_touch before update on public.special_awards
  for each row execute function public.touch_updated_at();

-- players.event_id と group / scores の event_id の整合性
create or replace function public.check_player_group() returns trigger
language plpgsql as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.groups g where g.id = new.group_id and g.event_id = new.event_id
  ) then
    raise exception 'group belongs to another event';
  end if;
  return new;
end $$;
create trigger players_check_group before insert or update on public.players
  for each row execute function public.check_player_group();

create or replace function public.fill_score_event() returns trigger
language plpgsql as $$
begin
  select p.event_id into new.event_id from public.players p where p.id = new.player_id;
  return new;
end $$;
create trigger scores_fill_event before insert or update on public.scores
  for each row execute function public.fill_score_event();

-- ---------------------------------------------------------------------------
-- 幹事の権限（RLS）
-- ---------------------------------------------------------------------------

create or replace function public.is_organizer(p_event_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_organizers
    where event_id = p_event_id and user_id = auth.uid()
  )
$$;

alter table public.events enable row level security;
alter table public.event_organizers enable row level security;
alter table public.groups enable row level security;
alter table public.players enable row level security;
alter table public.scores enable row level security;
alter table public.special_awards enable row level security;

create policy events_organizer_select on public.events for select to authenticated
  using (public.is_organizer(id));
create policy events_organizer_update on public.events for update to authenticated
  using (public.is_organizer(id)) with check (public.is_organizer(id));
create policy events_organizer_delete on public.events for delete to authenticated
  using (public.is_organizer(id));

create policy organizers_select on public.event_organizers for select to authenticated
  using (public.is_organizer(event_id));

create policy groups_organizer_all on public.groups for all to authenticated
  using (public.is_organizer(event_id)) with check (public.is_organizer(event_id));
create policy players_organizer_all on public.players for all to authenticated
  using (public.is_organizer(event_id)) with check (public.is_organizer(event_id));
create policy scores_organizer_all on public.scores for all to authenticated
  using (public.is_organizer(event_id))
  with check (public.is_organizer((select p.event_id from public.players p where p.id = player_id)));
create policy awards_organizer_all on public.special_awards for all to authenticated
  using (public.is_organizer(event_id)) with check (public.is_organizer(event_id));

-- 幹事が見るための表示名・アイコン（LINE のプロフィール）
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_self on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_co_organizers on public.profiles for select to authenticated
  using (exists (
    select 1 from public.event_organizers mine
    join public.event_organizers theirs on theirs.event_id = mine.event_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  ));

-- ---------------------------------------------------------------------------
-- 幹事用の関数
-- ---------------------------------------------------------------------------

create or replace function public.create_event(
  p_name text,
  p_date date,
  p_course_name text,
  p_handicap_method text,
  p_hidden_holes smallint[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  insert into public.events (name, date, course_name, handicap_method, hidden_holes, created_by)
  values (p_name, p_date, p_course_name, p_handicap_method, p_hidden_holes, auth.uid())
  returning id into v_id;
  insert into public.event_organizers (event_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

-- 幹事招待リンクから幹事に加わる
create or replace function public.join_event_as_organizer(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  select id into v_id from public.events where organizer_invite_token = p_token;
  if v_id is null then
    raise exception 'invalid token' using errcode = 'P0002';
  end if;
  insert into public.event_organizers (event_id, user_id) values (v_id, auth.uid())
  on conflict do nothing;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 閲覧リンク・組の入力リンク用の関数（ログイン不要）
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
    -- 隠しホールは結果確定まで公開しない
    'hidden_holes', case when e.status = 'final' then e.hidden_holes else '{}'::smallint[] end,
    'handicap_cap', e.handicap_cap,
    'visibility', e.visibility,
    'status', e.status,
    'track_putts', e.track_putts,
    'track_penalties', e.track_penalties,
    'view_token', e.view_token
  )
$$;

create or replace function public.awards_json(p_event_id uuid) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'kind', a.kind, 'hole', a.hole,
    'winner_player_id', a.winner_player_id, 'note', a.note, 'updated_at', a.updated_at
  ) order by a.hole, a.kind), '[]'::jsonb)
  from public.special_awards a where a.event_id = p_event_id
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
    'awards', public.awards_json(e.id)
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
    -- 暫定トップの人の名前を出すため、コンペ全体の参加者名
    'all_players', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'group_id', p.group_id, 'name', p.name
      )), '[]'::jsonb) from public.players p where p.event_id = e.id)
  );
end $$;

-- 組の状態チェック（入力・提出の前に呼ぶ）。開催中かつ未提出の組だけを返す
create or replace function public.open_group_for_input(p_token text) returns public.groups
language plpgsql stable security definer set search_path = public as $$
declare
  g public.groups;
  v_status text;
begin
  select * into g from public.groups where input_token = p_token;
  if not found then
    raise exception 'invalid token' using errcode = 'P0002';
  end if;
  select status into v_status from public.events where id = g.event_id;
  if v_status <> 'open' then
    raise exception 'event finalized' using errcode = 'P0001', hint = 'event_final';
  end if;
  if g.submitted_at is not null then
    raise exception 'group submitted' using errcode = 'P0001', hint = 'group_submitted';
  end if;
  return g;
end $$;

-- 打数をまとめて保存。entries = [{player_id, hole, strokes|null, putts, penalties, updated_at}]
-- strokes が null ならそのホールを未入力に戻す。updated_at が既存より古い入力は無視する。
create or replace function public.save_group_scores(p_token text, p_entries jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  v_entry jsonb;
  v_player uuid;
  v_hole smallint;
  v_at timestamptz;
  v_applied integer := 0;
  v_rows integer;
begin
  g := public.open_group_for_input(p_token);
  for v_entry in select * from jsonb_array_elements(p_entries) loop
    v_player := (v_entry ->> 'player_id')::uuid;
    v_hole := (v_entry ->> 'hole')::smallint;
    v_at := coalesce((v_entry ->> 'updated_at')::timestamptz, now());
    if not exists (select 1 from public.players where id = v_player and group_id = g.id) then
      raise exception 'player not in group' using errcode = '42501';
    end if;
    if v_entry ->> 'strokes' is null then
      delete from public.scores
      where player_id = v_player and hole = v_hole and updated_at <= v_at;
    else
      insert into public.scores (player_id, hole, strokes, putts, penalties, updated_at)
      values (
        v_player, v_hole, (v_entry ->> 'strokes')::smallint,
        (v_entry ->> 'putts')::smallint, (v_entry ->> 'penalties')::smallint, v_at
      )
      on conflict (player_id, hole) do update
        set strokes = excluded.strokes, putts = excluded.putts,
            penalties = excluded.penalties, updated_at = excluded.updated_at
        where public.scores.updated_at <= excluded.updated_at;
    end if;
    get diagnostics v_rows = row_count;
    v_applied := v_applied + v_rows;
  end loop;
  return v_applied;
end $$;

-- ホールアウト後の提出。全員18ホール入力済みでなければエラー。提出後は組代表は編集できない
create or replace function public.submit_group(p_token text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  v_missing integer;
  v_at timestamptz := now();
begin
  g := public.open_group_for_input(p_token);
  select count(*) into v_missing from public.players p
  where p.group_id = g.id
    and (select count(*) from public.scores s where s.player_id = p.id) < 18;
  if v_missing > 0 then
    raise exception 'scores incomplete' using errcode = 'P0001', hint = 'incomplete';
  end if;
  update public.groups set submitted_at = v_at where id = g.id;
  return v_at;
end $$;

-- ドラコン・ニアピンの暫定トップを記録。自分の組の人だけを暫定トップにできる。
-- 取り消し（null）は現在の暫定トップが自分の組の人のときだけ。
create or replace function public.set_award_winner(
  p_token text, p_award_id uuid, p_player_id uuid, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
  a public.special_awards;
begin
  g := public.open_group_for_input(p_token);
  select * into a from public.special_awards where id = p_award_id and event_id = g.event_id;
  if not found then
    raise exception 'award not found' using errcode = 'P0002';
  end if;
  if p_player_id is not null
     and not exists (select 1 from public.players where id = p_player_id and group_id = g.id) then
    raise exception 'player not in group' using errcode = '42501';
  end if;
  if p_player_id is null and a.winner_player_id is not null
     and not exists (select 1 from public.players where id = a.winner_player_id and group_id = g.id) then
    raise exception 'winner is in another group' using errcode = '42501';
  end if;
  update public.special_awards
  set winner_player_id = p_player_id, note = coalesce(p_note, '')
  where id = a.id;
end $$;

-- anon は関数だけ。テーブルの既定権限は RLS で閉じているが、念のため明示的に外す
revoke all on all tables in schema public from anon;
revoke execute on function public.create_event(text, date, text, text, smallint[]) from public, anon;
revoke execute on function public.join_event_as_organizer(text) from public, anon;
revoke execute on function public.open_group_for_input(text) from public, anon, authenticated;
grant execute on function public.create_event(text, date, text, text, smallint[]) to authenticated;
grant execute on function public.join_event_as_organizer(text) to authenticated;
grant execute on function public.get_event_view(text) to anon, authenticated;
grant execute on function public.get_group_input(text) to anon, authenticated;
grant execute on function public.save_group_scores(text, jsonb) to anon, authenticated;
grant execute on function public.submit_group(text) to anon, authenticated;
grant execute on function public.set_award_winner(text, uuid, uuid, text) to anon, authenticated;
