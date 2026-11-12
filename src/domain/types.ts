/** ハンデキャップ計算方式 */
export type HandicapMethod =
  | 'shin-peoria' // 新ペリア（隠しホール12）
  | 'fixed' // 各自の申告ハンデ
  | 'none'; // ハンデなし（グロスのみ）

export interface Player {
  id: string;
  name: string;
  /** 申告ハンデ（method が fixed のとき使用） */
  handicap?: number;
  /** 組番号（1始まり） */
  group?: number;
}

export type SpecialAwardKind = 'drive' | 'pin';

/** ドラコン・ニアピン */
export interface SpecialAward {
  id: string;
  kind: SpecialAwardKind;
  hole: number; // 1-18
  winnerPlayerId?: string;
  /** ニアピン距離など自由記述 */
  note?: string;
}

export interface CompeEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  courseName: string;
  /** 各ホールのパー（18要素） */
  pars: number[];
  handicapMethod: HandicapMethod;
  /** 新ペリアの隠しホール（1始まり、12個） */
  hiddenHoles: number[];
  /** ハンデ上限 */
  handicapCap: number;
  players: Player[];
  /** scores[playerId][holeIndex] = 打数（未入力は null） */
  scores: Record<string, (number | null)[]>;
  specialAwards: SpecialAward[];
  createdAt: string;
  updatedAt: string;
}

export const HOLE_COUNT = 18;
