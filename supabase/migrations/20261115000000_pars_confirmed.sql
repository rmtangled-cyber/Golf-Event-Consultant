-- 幹事がコースのパーを確定したか。確定するまで参加者登録・リンク配布に進めない（アプリ側で制御）
alter table public.events add column if not exists pars_confirmed boolean not null default false;
