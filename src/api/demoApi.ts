import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ScoreEntry,
  ScoreInfo,
} from './types.ts';
import { ApiError } from './types.ts';

/**
 * デモ用のバックエンド。Supabase を設定していないときに使う。
 * データはこの端末（ブラウザ）の中だけに保存し、権限のルールは
 * supabase/migrations の関数と同じにしてある。
 * 通信できない状態を試すときは、開発者ツールで `globalThis.__demoOffline = true`。
 */

interface DemoDb {
  events: (EventInfo & { organizerIds: string[] })[];
  groups: (GroupInfo & { eventId: string; inputToken: string })[];
  players: (PlayerInfo & { eventId: string })[];
  scores: (ScoreInfo & { eventId: string })[];
  awards: (AwardInfo & { eventId: string })[];
  customAwards?: (CustomAwardInfo & { eventId: string })[];
  announcements?: (AnnouncementInfo & { eventId: string })[];
}

const DB_KEY = 'golf-compe/demo-db/v1';
const DEMO_ORGANIZER: Organizer = { id: 'demo-organizer', displayName: 'デモ幹事' };
const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];

const token = () =>
  Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const id = () => token().slice(0, 12);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export class DemoApi implements Api {
  readonly mode = 'demo' as const;
  private db: DemoDb | null = null;
  private loggedIn = true;
  private authListeners = new Set<() => void>();

  private async load(): Promise<DemoDb> {
    if ((globalThis as any).__demoOffline) throw new ApiError('network', 'offline (demo)');
    await new Promise((r) => setTimeout(r, 30));
    // 別のタブ（組代表の画面など）での変更も見えるよう、毎回読み直す
    const raw = await AsyncStorage.getItem(DB_KEY);
    this.db = raw ? JSON.parse(raw) : { events: [], groups: [], players: [], scores: [], awards: [] };
    this.db!.customAwards ??= [];
    this.db!.announcements ??= [];
    return this.db!;
  }

  private async save() {
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(this.db));
  }

  private requireOrganizer(db: DemoDb, eventId: string) {
    const event = db.events.find((e) => e.id === eventId);
    if (!event || !this.loggedIn || !event.organizerIds.includes(DEMO_ORGANIZER.id)) {
      throw new ApiError('forbidden');
    }
    return event;
  }

  // --- ログイン（デモでは常にデモ幹事） ---

  async getOrganizer() {
    return this.loggedIn ? DEMO_ORGANIZER : null;
  }
  onAuthChange(listener: () => void) {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  }
  async startLineLogin() {
    this.loggedIn = true;
    this.authListeners.forEach((l) => l());
  }
  async completeLineLogin() {}
  async signOut() {
    this.loggedIn = false;
    this.authListeners.forEach((l) => l());
  }

  // --- 幹事 ---

  async listMyEvents() {
    const db = await this.load();
    return db.events
      .filter((e) => this.loggedIn && e.organizerIds.includes(DEMO_ORGANIZER.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => ({ id: e.id, name: e.name, date: e.date, courseName: e.courseName, status: e.status }));
  }

  async createEvent(input: NewEventInput) {
    const db = await this.load();
    if (!this.loggedIn) throw new ApiError('login_required');
    const event = {
      id: id(),
      name: input.name,
      date: input.date,
      courseName: input.courseName,
      pars: DEFAULT_PARS,
      handicapMethod: input.handicapMethod,
      hiddenHoles: input.hiddenHoles,
      handicapCap: 36,
      visibility: 'live' as const,
      status: 'open' as const,
      trackPutts: false,
      trackPenalties: false,
      hiddenAwards: [],
      viewToken: token(),
      organizerInviteToken: token(),
      organizerIds: [DEMO_ORGANIZER.id],
    };
    db.events.push(event);
    await this.save();
    return event.id;
  }

  async getEvent(eventId: string): Promise<EventBundle | null> {
    const db = await this.load();
    const event = db.events.find((e) => e.id === eventId);
    if (!event || !event.organizerIds.includes(DEMO_ORGANIZER.id) || !this.loggedIn) return null;
    const { organizerIds: _o, ...info } = event;
    return clone({
      event: info,
      groups: db.groups.filter((g) => g.eventId === eventId).sort((a, b) => a.number - b.number),
      players: db.players.filter((p) => p.eventId === eventId).sort((a, b) => a.sort - b.sort),
      scores: db.scores.filter((s) => s.eventId === eventId),
      awards: db.awards.filter((a) => a.eventId === eventId).sort((a, b) => a.hole - b.hole),
      customAwards: db.customAwards!.filter((c) => c.eventId === eventId).sort((a, b) => a.sort - b.sort),
      announcements: this.announcementsOf(db, eventId),
      scoresHidden: false,
    });
  }

  async updateEvent(eventId: string, patch: EventPatch) {
    const db = await this.load();
    Object.assign(this.requireOrganizer(db, eventId), patch);
    await this.save();
  }

  async deleteEvent(eventId: string) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    db.events = db.events.filter((e) => e.id !== eventId);
    db.groups = db.groups.filter((g) => g.eventId !== eventId);
    db.players = db.players.filter((p) => p.eventId !== eventId);
    db.scores = db.scores.filter((s) => s.eventId !== eventId);
    db.awards = db.awards.filter((a) => a.eventId !== eventId);
    await this.save();
  }

  async joinAsOrganizer(inviteToken: string) {
    const db = await this.load();
    const event = db.events.find((e) => e.organizerInviteToken === inviteToken);
    if (!event) throw new ApiError('invalid_token');
    if (!event.organizerIds.includes(DEMO_ORGANIZER.id)) event.organizerIds.push(DEMO_ORGANIZER.id);
    await this.save();
    return event.id;
  }

  private ensureGroup(db: DemoDb, eventId: string, number: number) {
    let group = db.groups.find((g) => g.eventId === eventId && g.number === number);
    if (!group) {
      group = { id: id(), eventId, number, submittedAt: null, inputToken: token() };
      db.groups.push(group);
    }
    return group.id;
  }

  async addPlayer(eventId: string, input: { name: string; handicap: number | null; groupNumber: number }) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    db.players.push({
      id: id(),
      eventId,
      groupId: this.ensureGroup(db, eventId, input.groupNumber),
      name: input.name,
      handicap: input.handicap,
      sort: Date.now(),
    });
    await this.save();
  }

  async updatePlayer(eventId: string, playerId: string, patch: PlayerPatch) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    const player = db.players.find((p) => p.id === playerId && p.eventId === eventId);
    if (!player) throw new ApiError('forbidden');
    if (patch.name !== undefined) player.name = patch.name;
    if (patch.handicap !== undefined) player.handicap = patch.handicap;
    if (patch.groupNumber !== undefined) player.groupId = this.ensureGroup(db, eventId, patch.groupNumber);
    await this.save();
  }

  async deletePlayer(playerId: string) {
    const db = await this.load();
    const player = db.players.find((p) => p.id === playerId);
    if (!player) return;
    this.requireOrganizer(db, player.eventId);
    db.players = db.players.filter((p) => p.id !== playerId);
    db.scores = db.scores.filter((s) => s.playerId !== playerId);
    db.awards.forEach((a) => {
      if (a.winnerPlayerId === playerId) a.winnerPlayerId = null;
    });
    await this.save();
  }

  private applyEntries(db: DemoDb, eventId: string, entries: ScoreEntry[], onlyNewer: boolean) {
    for (const e of entries) {
      const index = db.scores.findIndex((s) => s.playerId === e.playerId && s.hole === e.hole);
      const existing = db.scores[index];
      if (onlyNewer && existing && existing.updatedAt > e.updatedAt) continue;
      if (e.strokes == null) {
        if (index >= 0) db.scores.splice(index, 1);
        continue;
      }
      const row = { ...e, strokes: e.strokes, eventId };
      if (index >= 0) db.scores[index] = row;
      else db.scores.push(row);
    }
  }

  async saveScoresAsOrganizer(eventId: string, entries: ScoreEntry[]) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    this.applyEntries(db, eventId, entries, false);
    await this.save();
  }

  async setGroupSubmitted(groupId: string, submitted: boolean) {
    const db = await this.load();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) throw new ApiError('forbidden');
    this.requireOrganizer(db, group.eventId);
    group.submittedAt = submitted ? new Date().toISOString() : null;
    await this.save();
  }

  async regenerateGroupToken(groupId: string) {
    const db = await this.load();
    const group = db.groups.find((g) => g.id === groupId);
    if (!group) throw new ApiError('forbidden');
    this.requireOrganizer(db, group.eventId);
    group.inputToken = token();
    await this.save();
  }

  async addAward(eventId: string, kind: AwardInfo['kind'], hole: number) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    db.awards.push({ id: id(), eventId, kind, hole, winnerPlayerId: null, note: '' });
    await this.save();
  }

  async updateAward(awardId: string, patch: AwardPatch) {
    const db = await this.load();
    const award = db.awards.find((a) => a.id === awardId);
    if (!award) throw new ApiError('forbidden');
    this.requireOrganizer(db, award.eventId);
    Object.assign(award, patch);
    await this.save();
  }

  async deleteAward(awardId: string) {
    const db = await this.load();
    const award = db.awards.find((a) => a.id === awardId);
    if (!award) return;
    this.requireOrganizer(db, award.eventId);
    db.awards = db.awards.filter((a) => a.id !== awardId);
    await this.save();
  }

  async addCustomAward(eventId: string, input: { title: string; rule: CustomAwardInfo['rule']; rank?: number }) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    db.customAwards!.push({
      id: id(),
      eventId,
      title: input.title,
      rule: input.rule,
      rank: input.rank ?? null,
      winnerPlayerId: null,
      sort: Date.now(),
    });
    await this.save();
  }

  async updateCustomAward(awardId: string, patch: CustomAwardPatch) {
    const db = await this.load();
    const award = db.customAwards!.find((a) => a.id === awardId);
    if (!award) throw new ApiError('forbidden');
    this.requireOrganizer(db, award.eventId);
    Object.assign(award, patch);
    await this.save();
  }

  async deleteCustomAward(awardId: string) {
    const db = await this.load();
    const award = db.customAwards!.find((a) => a.id === awardId);
    if (!award) return;
    this.requireOrganizer(db, award.eventId);
    db.customAwards = db.customAwards!.filter((a) => a.id !== awardId);
    await this.save();
  }

  async postAnnouncement(eventId: string, message: string) {
    const db = await this.load();
    this.requireOrganizer(db, eventId);
    db.announcements!.push({ id: id(), eventId, message, createdAt: new Date().toISOString() });
    await this.save();
  }

  // --- プッシュ通知（デモでは使えない。アプリ内のお知らせだけ） ---

  async getPushPublicKey() {
    return null;
  }
  async savePushSubscription() {}
  async deletePushSubscription() {}
  async notifyAward() {}

  // --- リンク ---

  private publicEvent(event: DemoDb['events'][number]): EventInfo {
    const { organizerIds: _o, organizerInviteToken: _t, ...info } = event;
    return { ...info, hiddenHoles: event.status === 'final' ? event.hiddenHoles : [] };
  }

  async getEventView(viewToken: string): Promise<EventBundle | null> {
    const db = await this.load();
    const event = db.events.find((e) => e.viewToken === viewToken);
    if (!event) return null;
    const show = event.status === 'final' || event.visibility === 'live';
    const scores = db.scores.filter((s) => s.eventId === event.id);
    return clone({
      event: this.publicEvent(event),
      groups: db.groups
        .filter((g) => g.eventId === event.id)
        .map(({ id, number, submittedAt }) => ({ id, number, submittedAt })),
      players: db.players
        .filter((p) => p.eventId === event.id)
        .map((p) => ({ ...p, holesPlayed: scores.filter((s) => s.playerId === p.id).length })),
      scores: show ? scores : [],
      awards: db.awards.filter((a) => a.eventId === event.id),
      customAwards: event.status === 'final' ? db.customAwards!.filter((c) => c.eventId === event.id) : [],
      announcements: this.announcementsOf(db, event.id),
      scoresHidden: !show,
    });
  }

  async getGroupInput(inputToken: string): Promise<GroupBundle | null> {
    const db = await this.load();
    const group = db.groups.find((g) => g.inputToken === inputToken);
    if (!group) return null;
    const event = db.events.find((e) => e.id === group.eventId)!;
    const players = db.players.filter((p) => p.groupId === group.id);
    const ids = new Set(players.map((p) => p.id));
    return clone({
      event: this.publicEvent(event),
      group: { id: group.id, number: group.number, submittedAt: group.submittedAt },
      players,
      scores: db.scores.filter((s) => ids.has(s.playerId)),
      awards: db.awards.filter((a) => a.eventId === event.id),
      allPlayers: db.players
        .filter((p) => p.eventId === event.id)
        .map((p) => ({ id: p.id, groupId: p.groupId, name: p.name })),
      announcements: this.announcementsOf(db, event.id),
    });
  }

  private announcementsOf(db: DemoDb, eventId: string) {
    return db.announcements!
      .filter((a) => a.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  }

  private openGroup(db: DemoDb, inputToken: string) {
    const group = db.groups.find((g) => g.inputToken === inputToken);
    if (!group) throw new ApiError('invalid_token');
    const event = db.events.find((e) => e.id === group.eventId)!;
    if (event.status !== 'open') throw new ApiError('event_final');
    if (group.submittedAt) throw new ApiError('group_submitted');
    return group;
  }

  async saveGroupScores(inputToken: string, entries: ScoreEntry[]) {
    const db = await this.load();
    const group = this.openGroup(db, inputToken);
    for (const e of entries) {
      if (!db.players.some((p) => p.id === e.playerId && p.groupId === group.id)) throw new ApiError('forbidden');
    }
    this.applyEntries(db, group.eventId, entries, true);
    await this.save();
  }

  async submitGroup(inputToken: string) {
    const db = await this.load();
    const group = this.openGroup(db, inputToken);
    const incomplete = db.players
      .filter((p) => p.groupId === group.id)
      .some((p) => db.scores.filter((s) => s.playerId === p.id).length < 18);
    if (incomplete) throw new ApiError('incomplete');
    group.submittedAt = new Date().toISOString();
    await this.save();
  }

  async setAwardWinner(inputToken: string, awardId: string, playerId: string | null, note: string) {
    const db = await this.load();
    const group = this.openGroup(db, inputToken);
    const award = db.awards.find((a) => a.id === awardId && a.eventId === group.eventId);
    if (!award) throw new ApiError('invalid_token');
    const inGroup = (pid: string | null) => db.players.some((p) => p.id === pid && p.groupId === group.id);
    if (playerId && !inGroup(playerId)) throw new ApiError('forbidden');
    if (!playerId && award.winnerPlayerId && !inGroup(award.winnerPlayerId)) throw new ApiError('forbidden');
    award.winnerPlayerId = playerId;
    award.note = note;
    await this.save();
  }
}
