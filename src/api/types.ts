import type { HandicapMethod, SpecialAwardKind } from '@/domain/types.ts';

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

/** コンペ全体（幹事画面・閲覧リンク） */
export interface EventBundle {
  event: EventInfo;
  groups: GroupInfo[];
  players: PlayerInfo[];
  scores: ScoreInfo[];
  awards: AwardInfo[];
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
  >
>;

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

  // --- リンクを持つ人（ログインなし） ---
  getEventView(viewToken: string): Promise<EventBundle | null>;
  getGroupInput(inputToken: string): Promise<GroupBundle | null>;
  saveGroupScores(inputToken: string, entries: ScoreEntry[]): Promise<void>;
  submitGroup(inputToken: string): Promise<void>;
  setAwardWinner(inputToken: string, awardId: string, playerId: string | null, note: string): Promise<void>;
}
