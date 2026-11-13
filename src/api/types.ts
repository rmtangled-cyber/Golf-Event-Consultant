import type { CustomAwardRule, HandicapMethod, SpecialAwardKind, StandardAwardKey } from '@/domain/types.ts';

export type Visibility = 'live' | 'hidden';
export type EventStatus = 'open' | 'final';

export interface EventInfo {
  id: string;
  name: string;
  date: string;
  courseName: string;
  pars: number[];
  handicapMethod: HandicapMethod;
  /** 閲覧リンク・入力リンクでは結果確定まで空 */
  hiddenHoles: number[];
  handicapCap: number;
  visibility: Visibility;
  status: EventStatus;
  trackPutts: boolean;
  trackPenalties: boolean;
  /** 表示しない定番賞 */
  hiddenAwards: StandardAwardKey[];
  /** 幹事がコースのパーを確定したか（確定までは参加者登録・リンク配布に進めない） */
  parsConfirmed?: boolean;
  viewToken: string;
  /** 幹事にだけ返る */
  organizerInviteToken?: string;
}

export interface GroupInfo {
  id: string;
  number: number;
  submittedAt: string | null;
  /** 幹事にだけ返る */
  inputToken?: string;
}

export interface PlayerInfo {
  id: string;
  groupId: string | null;
  name: string;
  handicap: number | null;
  sort: number;
  /** 閲覧リンクで順位が非公開のとき、進み具合だけ表示するため */
  holesPlayed?: number;
}

export interface ScoreInfo {
  playerId: string;
  hole: number; // 1-18
  strokes: number;
  putts: number | null;
  penalties: number | null;
  updatedAt: string;
}

export interface AwardInfo {
  id: string;
  kind: SpecialAwardKind;
  hole: number;
  winnerPlayerId: string | null;
  note: string;
}

/** 幹事が追加した賞（飛び賞・OB王など） */
export interface CustomAwardInfo {
  id: string;
  title: string;
  rule: CustomAwardRule;
  rank: number | null;
  winnerPlayerId: string | null;
  sort: number;
}

/** 幹事からの連絡 */
export interface AnnouncementInfo {
  id: string;
  message: string;
  createdAt: string;
}

/** コンペ全体（幹事画面・閲覧リンク） */
export interface EventBundle {
  event: EventInfo;
  groups: GroupInfo[];
  players: PlayerInfo[];
  scores: ScoreInfo[];
  awards: AwardInfo[];
  /** 閲覧リンクでは結果確定まで空 */
  customAwards: CustomAwardInfo[];
  /** 新しい順に最大5件 */
  announcements: AnnouncementInfo[];
  /** 「結果確定まで非公開」でスコアが返っていない */
  scoresHidden: boolean;
}

/** 組の入力リンク */
export interface GroupBundle {
  event: EventInfo;
  group: GroupInfo;
  players: PlayerInfo[];
  scores: ScoreInfo[];
  awards: AwardInfo[];
  /** 暫定トップの名前表示用 */
  allPlayers: { id: string; groupId: string | null; name: string }[];
  announcements: AnnouncementInfo[];
}

/** 1ホール分の入力。strokes が null ならそのホールを未入力に戻す */
export interface ScoreEntry {
  playerId: string;
  hole: number;
  strokes: number | null;
  putts: number | null;
  penalties: number | null;
  /** 端末で入力した時刻（ISO）。遅れて届いた古い入力で上書きしないため */
  updatedAt: string;
}

export interface EventSummary {
  id: string;
  name: string;
  date: string;
  courseName: string;
  status: EventStatus;
}

export interface Organizer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface NewEventInput {
  name: string;
  date: string;
  courseName: string;
  handicapMethod: HandicapMethod;
  hiddenHoles: number[];
}

export type EventPatch = Partial<
  Pick<
    EventInfo,
    | 'name'
    | 'date'
    | 'courseName'
    | 'pars'
    | 'handicapMethod'
    | 'hiddenHoles'
    | 'handicapCap'
    | 'visibility'
    | 'status'
    | 'trackPutts'
    | 'trackPenalties'
    | 'hiddenAwards'
    | 'parsConfirmed'
  >
>;

export interface CustomAwardPatch {
  title?: string;
  rank?: number | null;
  winnerPlayerId?: string | null;
}

/** ブラウザの通知の宛先（PushSubscription から取り出したもの） */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPrefs {
  /** ドラコン・ニアピンの暫定トップ更新 */
  drivePin: boolean;
  /** 幹事からの連絡 */
  announcements: boolean;
}

export interface PlayerPatch {
  name?: string;
  handicap?: number | null;
  groupNumber?: number;
}

export interface AwardPatch {
  hole?: number;
  winnerPlayerId?: string | null;
  note?: string;
}

export type ApiErrorCode =
  | 'group_submitted' // 組が提出済み
  | 'event_final' // 結果確定済み
  | 'incomplete' // 18ホール揃っていない
  | 'invalid_token'
  | 'forbidden'
  | 'login_required'
  | 'network' // 通信できない（あとで再送してよい）
  | 'unknown';

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ApiError';
  }
}

/** 通信の問題で、あとで送り直せば通る可能性があるエラーか */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.code === 'network' || error.code === 'unknown';
  return true;
}

export interface Api {
  readonly mode: 'supabase' | 'demo';

  // --- 幹事のログイン ---
  getOrganizer(): Promise<Organizer | null>;
  onAuthChange(listener: () => void): () => void;
  /** LINE のログイン画面へ移動する */
  startLineLogin(): Promise<void>;
  /** LINE から戻ってきたときの処理 */
  completeLineLogin(params: { code: string; state: string }): Promise<void>;
  signOut(): Promise<void>;

  // --- 幹事の操作 ---
  listMyEvents(): Promise<EventSummary[]>;
  createEvent(input: NewEventInput): Promise<string>;
  getEvent(eventId: string): Promise<EventBundle | null>;
  updateEvent(eventId: string, patch: EventPatch): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  joinAsOrganizer(inviteToken: string): Promise<string>;
  addPlayer(eventId: string, input: { name: string; handicap: number | null; groupNumber: number }): Promise<void>;
  updatePlayer(eventId: string, playerId: string, patch: PlayerPatch): Promise<void>;
  deletePlayer(playerId: string): Promise<void>;
  saveScoresAsOrganizer(eventId: string, entries: ScoreEntry[]): Promise<void>;
  setGroupSubmitted(groupId: string, submitted: boolean): Promise<void>;
  regenerateGroupToken(groupId: string): Promise<void>;
  addAward(eventId: string, kind: AwardInfo['kind'], hole: number): Promise<void>;
  updateAward(awardId: string, patch: AwardPatch): Promise<void>;
  deleteAward(awardId: string): Promise<void>;
  addCustomAward(eventId: string, input: { title: string; rule: CustomAwardRule; rank?: number }): Promise<void>;
  updateCustomAward(awardId: string, patch: CustomAwardPatch): Promise<void>;
  deleteCustomAward(awardId: string): Promise<void>;
  /** 連絡を保存し、通知を受け取る設定の人に送る */
  postAnnouncement(eventId: string, message: string): Promise<void>;

  // --- リンクを持つ人（ログインなし） ---
  getEventView(viewToken: string): Promise<EventBundle | null>;
  getGroupInput(inputToken: string): Promise<GroupBundle | null>;
  saveGroupScores(inputToken: string, entries: ScoreEntry[]): Promise<void>;
  submitGroup(inputToken: string): Promise<void>;
  setAwardWinner(inputToken: string, awardId: string, playerId: string | null, note: string): Promise<void>;

  // --- プッシュ通知 ---
  /** 通知の署名に使う公開鍵。通知を使えない環境（デモなど）は null */
  getPushPublicKey(): Promise<string | null>;
  savePushSubscription(viewToken: string, target: PushTarget, prefs: PushPrefs): Promise<void>;
  deletePushSubscription(viewToken: string, endpoint: string): Promise<void>;
  /** ドラコン・ニアピンの暫定トップが変わったら通知する（変わっていなければ何もしない） */
  notifyAward(awardId: string): Promise<void>;
}
