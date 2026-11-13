import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type {
  Api,
  AnnouncementInfo,
  AwardInfo,
  AwardPatch,
  CustomAwardInfo,
  CustomAwardPatch,
  EventBundle,
  EventInfo,
  EventPatch,
  GroupBundle,
  GroupInfo,
  NewEventInput,
  Organizer,
  PlayerInfo,
  PlayerPatch,
  PushPrefs,
  PushTarget,
  ScoreEntry,
  ScoreInfo,
} from './types.ts';
import { ApiError } from './types.ts';

type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// DB の行（snake_case）⇔ アプリの型（camelCase）
// ---------------------------------------------------------------------------

const toEvent = (r: Row): EventInfo => ({
  id: r.id,
  name: r.name,
  date: r.date,
  courseName: r.course_name,
  pars: (r.pars ?? []).map(Number),
  handicapMethod: r.handicap_method,
  hiddenHoles: (r.hidden_holes ?? []).map(Number),
  handicapCap: Number(r.handicap_cap),
  visibility: r.visibility,
  status: r.status,
  trackPutts: r.track_putts,
  trackPenalties: r.track_penalties,
  hiddenAwards: r.hidden_awards ?? [],
  parsConfirmed: r.pars_confirmed ?? undefined,
  viewToken: r.view_token,
  organizerInviteToken: r.organizer_invite_token ?? undefined,
});

const toGroup = (r: Row): GroupInfo => ({
  id: r.id,
  number: r.number,
  submittedAt: r.submitted_at ?? null,
  inputToken: r.input_token ?? undefined,
});

const toPlayer = (r: Row): PlayerInfo => ({
  id: r.id,
  groupId: r.group_id ?? null,
  name: r.name,
  handicap: r.handicap == null ? null : Number(r.handicap),
  sort: r.sort ?? 0,
  holesPlayed: r.holes_played ?? undefined,
});

const toScore = (r: Row): ScoreInfo => ({
  playerId: r.player_id,
  hole: r.hole,
  strokes: r.strokes,
  putts: r.putts ?? null,
  penalties: r.penalties ?? null,
  updatedAt: r.updated_at,
});

const toAward = (r: Row): AwardInfo => ({
  id: r.id,
  kind: r.kind,
  hole: r.hole,
  winnerPlayerId: r.winner_player_id ?? null,
  note: r.note ?? '',
});

const toCustomAward = (r: Row): CustomAwardInfo => ({
  id: r.id,
  title: r.title,
  rule: r.rule,
  rank: r.rank ?? null,
  winnerPlayerId: r.winner_player_id ?? null,
  sort: r.sort ?? 0,
});

const toAnnouncement = (r: Row): AnnouncementInfo => ({ id: r.id, message: r.message, createdAt: r.created_at });

const eventPatchToRow = (p: EventPatch): Row => {
  const row: Row = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.date !== undefined) row.date = p.date;
  if (p.courseName !== undefined) row.course_name = p.courseName;
  if (p.pars !== undefined) row.pars = p.pars;
  if (p.handicapMethod !== undefined) row.handicap_method = p.handicapMethod;
  if (p.hiddenHoles !== undefined) row.hidden_holes = p.hiddenHoles;
  if (p.handicapCap !== undefined) row.handicap_cap = p.handicapCap;
  if (p.visibility !== undefined) row.visibility = p.visibility;
  if (p.status !== undefined) row.status = p.status;
  if (p.trackPutts !== undefined) row.track_putts = p.trackPutts;
  if (p.trackPenalties !== undefined) row.track_penalties = p.trackPenalties;
  if (p.hiddenAwards !== undefined) row.hidden_awards = p.hiddenAwards;
  if (p.parsConfirmed !== undefined) row.pars_confirmed = p.parsConfirmed;
  return row;
};

const entryToRow = (e: ScoreEntry): Row => ({
  player_id: e.playerId,
  hole: e.hole,
  strokes: e.strokes,
  putts: e.putts,
  penalties: e.penalties,
  updated_at: e.updatedAt,
});

/** Supabase のエラーをアプリのエラーに変換 */
function toApiError(error: PostgrestError | Error | { message?: string; hint?: string; code?: string }): ApiError {
  const e = error as { message?: string; hint?: string; code?: string };
  const hint = e.hint ?? '';
  if (hint === 'group_submitted' || hint === 'event_final' || hint === 'incomplete') return new ApiError(hint, e.message);
  if (e.code === 'P0002') return new ApiError('invalid_token', e.message);
  if (e.code === '42501') return new ApiError('forbidden', e.message);
  const message = e.message ?? '';
  if (/fetch|network|Load failed|timeout/i.test(message)) return new ApiError('network', message);
  return new ApiError('unknown', message);
}

function check<T>(result: { data: T; error: any }): T {
  if (result.error) throw toApiError(result.error);
  return result.data;
}

/** fetch 自体が失敗した（圏外など）場合も network エラーにする */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('network', String(error));
  }
}

// ---------------------------------------------------------------------------
// LINE ログイン
// ---------------------------------------------------------------------------

const LINE_STATE_KEY = 'golf-compe/line-login';

function lineRedirectUri() {
  if (Platform.OS !== 'web') {
    throw new ApiError('unknown', 'アプリ版のLINEログインは未対応です。Web版からログインしてください。');
  }
  return `${window.location.origin}/auth/line`;
}

const randomString = () =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------------------

export class SupabaseApi implements Api {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;
  private lineChannelId: string;

  constructor(url: string, anonKey: string, lineChannelId: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    this.lineChannelId = lineChannelId;
  }

  // --- ログイン ---

  async getOrganizer(): Promise<Organizer | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const meta = user.user_metadata ?? {};
    return { id: user.id, displayName: meta.name ?? '幹事', avatarUrl: meta.picture ?? null };
  }

  onAuthChange(listener: () => void) {
    const { data } = this.client.auth.onAuthStateChange(() => listener());
    return () => data.subscription.unsubscribe();
  }

  async startLineLogin() {
    if (!this.lineChannelId) throw new ApiError('unknown', 'LINEログインの設定（チャネルID）がありません');
    const state = randomString();
    const nonce = randomString();
    await AsyncStorage.setItem(LINE_STATE_KEY, JSON.stringify({ state, nonce }));
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.lineChannelId,
      redirect_uri: lineRedirectUri(),
      state,
      nonce,
      scope: 'profile openid',
    });
    window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params}`);
  }

  async completeLineLogin({ code, state }: { code: string; state: string }) {
    const saved = JSON.parse((await AsyncStorage.getItem(LINE_STATE_KEY)) ?? 'null');
    await AsyncStorage.removeItem(LINE_STATE_KEY);
    if (!saved || saved.state !== state) throw new ApiError('forbidden', 'ログインをやり直してください');
    const { data, error } = await this.client.functions.invoke('line-auth', {
      body: { code, redirectUri: lineRedirectUri(), nonce: saved.nonce },
    });
    if (error || !data?.token_hash) throw new ApiError('unknown', 'LINEログインに失敗しました');
    const verified = await this.client.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (verified.error) throw new ApiError('unknown', verified.error.message);
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  // --- 幹事 ---

  listMyEvents() {
    return guard(async () => {
      const rows = check(
        await this.client.from('events').select('id, name, date, course_name, status').order('date', { ascending: false }),
      ) as Row[];
      return rows.map((r) => ({ id: r.id, name: r.name, date: r.date, courseName: r.course_name, status: r.status }));
    });
  }

  createEvent(input: NewEventInput) {
    return guard(async () =>
      check(
        await this.client.rpc('create_event', {
          p_name: input.name,
          p_date: input.date,
          p_course_name: input.courseName,
          p_handicap_method: input.handicapMethod,
          p_hidden_holes: input.hiddenHoles,
        }),
      ) as string,
    );
  }

  getEvent(eventId: string) {
    return guard(async (): Promise<EventBundle | null> => {
      const [event, groups, players, scores, awards, customAwards, announcements] = await Promise.all([
        this.client.from('events').select('*').eq('id', eventId).maybeSingle(),
        this.client.from('groups').select('*').eq('event_id', eventId).order('number'),
        this.client.from('players').select('*').eq('event_id', eventId).order('sort').order('created_at'),
        this.client.from('scores').select('*').eq('event_id', eventId),
        this.client.from('special_awards').select('*').eq('event_id', eventId).order('hole'),
        this.client.from('custom_awards').select('*').eq('event_id', eventId).order('sort').order('created_at'),
        this.client
          .from('announcements')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      const eventRow = check(event) as Row | null;
      if (!eventRow) return null;
      return {
        event: toEvent(eventRow),
        groups: (check(groups) as Row[]).map(toGroup),
        players: (check(players) as Row[]).map(toPlayer),
        scores: (check(scores) as Row[]).map(toScore),
        awards: (check(awards) as Row[]).map(toAward),
        customAwards: (check(customAwards) as Row[]).map(toCustomAward),
        announcements: (check(announcements) as Row[]).map(toAnnouncement),
        scoresHidden: false,
      };
    });
  }

  updateEvent(eventId: string, patch: EventPatch) {
    return guard(async () => {
      check(await this.client.from('events').update(eventPatchToRow(patch)).eq('id', eventId));
    });
  }

  deleteEvent(eventId: string) {
    return guard(async () => {
      check(await this.client.from('events').delete().eq('id', eventId));
    });
  }

  joinAsOrganizer(inviteToken: string) {
    return guard(async () => check(await this.client.rpc('join_event_as_organizer', { p_token: inviteToken })) as string);
  }

  /** 組番号の組がなければ作って id を返す */
  private async ensureGroup(eventId: string, number: number): Promise<string> {
    const existing = check(
      await this.client.from('groups').select('id').eq('event_id', eventId).eq('number', number).maybeSingle(),
    ) as Row | null;
    if (existing) return existing.id;
    const created = check(
      await this.client.from('groups').insert({ event_id: eventId, number }).select('id').single(),
    ) as Row;
    return created.id;
  }

  addPlayer(eventId: string, input: { name: string; handicap: number | null; groupNumber: number }) {
    return guard(async () => {
      const groupId = await this.ensureGroup(eventId, input.groupNumber);
      check(
        await this.client.from('players').insert({
          event_id: eventId,
          group_id: groupId,
          name: input.name,
          handicap: input.handicap,
          sort: Date.now() % 2_000_000_000,
        }),
      );
    });
  }

  updatePlayer(eventId: string, playerId: string, patch: PlayerPatch) {
    return guard(async () => {
      const row: Row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.handicap !== undefined) row.handicap = patch.handicap;
      if (patch.groupNumber !== undefined) row.group_id = await this.ensureGroup(eventId, patch.groupNumber);
      check(await this.client.from('players').update(row).eq('id', playerId));
    });
  }

  deletePlayer(playerId: string) {
    return guard(async () => {
      check(await this.client.from('players').delete().eq('id', playerId));
    });
  }

  saveScoresAsOrganizer(_eventId: string, entries: ScoreEntry[]) {
    return guard(async () => {
      const upserts = entries.filter((e) => e.strokes != null).map(entryToRow);
      if (upserts.length) check(await this.client.from('scores').upsert(upserts));
      for (const e of entries.filter((e) => e.strokes == null)) {
        check(await this.client.from('scores').delete().eq('player_id', e.playerId).eq('hole', e.hole));
      }
    });
  }

  setGroupSubmitted(groupId: string, submitted: boolean) {
    return guard(async () => {
      check(
        await this.client
          .from('groups')
          .update({ submitted_at: submitted ? new Date().toISOString() : null })
          .eq('id', groupId),
      );
    });
  }

  regenerateGroupToken(groupId: string) {
    return guard(async () => {
      const token = randomString() + randomString();
      check(await this.client.from('groups').update({ input_token: token.slice(0, 32) }).eq('id', groupId));
    });
  }

  addAward(eventId: string, kind: AwardInfo['kind'], hole: number) {
    return guard(async () => {
      check(await this.client.from('special_awards').insert({ event_id: eventId, kind, hole }));
    });
  }

  updateAward(awardId: string, patch: AwardPatch) {
    return guard(async () => {
      const row: Row = {};
      if (patch.hole !== undefined) row.hole = patch.hole;
      if (patch.winnerPlayerId !== undefined) row.winner_player_id = patch.winnerPlayerId;
      if (patch.note !== undefined) row.note = patch.note;
      check(await this.client.from('special_awards').update(row).eq('id', awardId));
    });
  }

  deleteAward(awardId: string) {
    return guard(async () => {
      check(await this.client.from('special_awards').delete().eq('id', awardId));
    });
  }

  addCustomAward(eventId: string, input: { title: string; rule: CustomAwardInfo['rule']; rank?: number }) {
    return guard(async () => {
      check(
        await this.client.from('custom_awards').insert({
          event_id: eventId,
          title: input.title,
          rule: input.rule,
          rank: input.rank ?? null,
          sort: Date.now() % 2_000_000_000,
        }),
      );
    });
  }

  updateCustomAward(awardId: string, patch: CustomAwardPatch) {
    return guard(async () => {
      const row: Row = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.rank !== undefined) row.rank = patch.rank;
      if (patch.winnerPlayerId !== undefined) row.winner_player_id = patch.winnerPlayerId;
      check(await this.client.from('custom_awards').update(row).eq('id', awardId));
    });
  }

  deleteCustomAward(awardId: string) {
    return guard(async () => {
      check(await this.client.from('custom_awards').delete().eq('id', awardId));
    });
  }

  postAnnouncement(eventId: string, message: string) {
    return guard(async () => {
      const row = check(
        await this.client.from('announcements').insert({ event_id: eventId, message }).select('id').single(),
      ) as Row;
      // 通知の送信に失敗しても、連絡自体はアプリに表示される
      await this.client.functions.invoke('push', { body: { action: 'announcement', announcementId: row.id } });
    });
  }

  // --- プッシュ通知 ---

  async getPushPublicKey() {
    const { data, error } = await this.client.functions.invoke('push', { body: { action: 'vapid' } });
    if (error || !data?.publicKey) return null;
    return data.publicKey as string;
  }

  savePushSubscription(viewToken: string, target: PushTarget, prefs: PushPrefs) {
    return guard(async () => {
      check(
        await this.client.rpc('save_push_subscription', {
          p_view_token: viewToken,
          p_endpoint: target.endpoint,
          p_p256dh: target.p256dh,
          p_auth: target.auth,
          p_drive_pin: prefs.drivePin,
          p_announcements: prefs.announcements,
        }),
      );
    });
  }

  deletePushSubscription(viewToken: string, endpoint: string) {
    return guard(async () => {
      check(await this.client.rpc('delete_push_subscription', { p_view_token: viewToken, p_endpoint: endpoint }));
    });
  }

  async notifyAward(awardId: string) {
    // 通知は「おまけ」なので、失敗しても入力の流れは止めない
    await this.client.functions.invoke('push', { body: { action: 'award', awardId } }).catch(() => undefined);
  }

  // --- リンク ---

  getEventView(viewToken: string) {
    return guard(async (): Promise<EventBundle | null> => {
      const data = check(await this.client.rpc('get_event_view', { p_token: viewToken })) as Row | null;
      if (!data) return null;
      return {
        event: toEvent(data.event),
        groups: data.groups.map(toGroup),
        players: data.players.map(toPlayer),
        scores: data.scores.map(toScore),
        awards: data.awards.map(toAward),
        customAwards: (data.custom_awards ?? []).map(toCustomAward),
        announcements: (data.announcements ?? []).map(toAnnouncement),
        scoresHidden: data.scores_hidden,
      };
    });
  }

  getGroupInput(inputToken: string) {
    return guard(async (): Promise<GroupBundle | null> => {
      const data = check(await this.client.rpc('get_group_input', { p_token: inputToken })) as Row | null;
      if (!data) return null;
      return {
        event: toEvent(data.event),
        group: toGroup(data.group),
        players: data.players.map(toPlayer),
        scores: data.scores.map(toScore),
        awards: data.awards.map(toAward),
        allPlayers: data.all_players.map((p: Row) => ({ id: p.id, groupId: p.group_id ?? null, name: p.name })),
        announcements: (data.announcements ?? []).map(toAnnouncement),
      };
    });
  }

  saveGroupScores(inputToken: string, entries: ScoreEntry[]) {
    return guard(async () => {
      check(await this.client.rpc('save_group_scores', { p_token: inputToken, p_entries: entries.map(entryToRow) }));
    });
  }

  submitGroup(inputToken: string) {
    return guard(async () => {
      check(await this.client.rpc('submit_group', { p_token: inputToken }));
    });
  }

  setAwardWinner(inputToken: string, awardId: string, playerId: string | null, note: string) {
    return guard(async () => {
      check(
        await this.client.rpc('set_award_winner', {
          p_token: inputToken,
          p_award_id: awardId,
          p_player_id: playerId,
          p_note: note,
        }),
      );
    });
  }
}
