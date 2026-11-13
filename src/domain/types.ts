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

/** 定番賞のうち、表示を切り替えられるもの（優勝は常に表示） */
export type StandardAwardKey = 'second' | 'third' | 'booby' | 'booby_maker' | 'best_gross';

/** 幹事が追加する賞 */
export type CustomAwardRule =
  | 'rank' // N位（飛び賞）
  | 'most_penalties' // OB・罰打が最多（OB王）
  | 'most_putts' // パット最多
  | 'manual'; // 幹事が受賞者を選ぶ

export interface CustomAward {
  id: string;
  title: string;
  rule: CustomAwardRule;
  rank?: number;
  winnerPlayerId?: string;
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
  /** 幹事が追加した賞 */
  customAwards?: CustomAward[];
  /** 表示しない定番賞 */
  hiddenAwards?: StandardAwardKey[];
  /** 入力されたパット数・OB/罰打の合計（入力がなければ null） */
  stats?: Record<string, { putts: number | null; penalties: number | null }>;
  createdAt: string;
  updatedAt: string;
}

export const HOLE_COUNT = 18;
