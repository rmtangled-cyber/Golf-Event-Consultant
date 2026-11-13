import type { CompeEvent, CustomAward, Player, StandardAwardKey } from './types.ts';
import { HOLE_COUNT } from './types.ts';

export const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

export function holesPlayed(strokes: (number | null)[] | undefined): number {
  return (strokes ?? []).filter((s) => s != null).length;
}

export function isComplete(strokes: (number | null)[] | undefined): boolean {
  return holesPlayed(strokes) === HOLE_COUNT;
}

/**
 * 新ペリア方式のハンデキャップ。
 * HC = (隠しホール合計打数 × 18/隠しホール数 − コースパー) × 0.8
 * - 1ホールの打数はパーの2倍を上限としてカウント
 * - 0 〜 cap の範囲に丸め、小数第1位まで
 */
export function shinPeoriaHandicap(
  strokes: (number | null)[],
  pars: number[],
  hiddenHoles: number[],
  cap: number,
): number {
  if (hiddenHoles.length === 0) return 0;
  const hiddenTotal = hiddenHoles.reduce((acc, hole) => {
    const s = strokes[hole - 1] ?? 0;
    return acc + Math.min(s, pars[hole - 1] * 2);
  }, 0);
  const coursePar = sum(pars);
  const raw = (hiddenTotal * (HOLE_COUNT / hiddenHoles.length) - coursePar) * 0.8;
  return round1(Math.min(Math.max(raw, 0), cap));
}

export function playerHandicap(event: CompeEvent, player: Player): number {
  switch (event.handicapMethod) {
    case 'none':
      return 0;
    case 'fixed':
      return player.handicap ?? 0;
    case 'shin-peoria':
      return shinPeoriaHandicap(
        event.scores[player.id] ?? [],
        event.pars,
        event.hiddenHoles,
        event.handicapCap,
      );
  }
}

export interface LeaderboardRow {
  player: Player;
  thru: number;
  out: number;
  in: number;
  gross: number;
  /** 現時点のパーに対する±（入力済みホールのみ） */
  toPar: number;
  handicap: number | null;
  net: number | null;
  rank: number | null;
}

/**
 * 順位表。18ホール完了者のみ順位付けし、ネット昇順。
 * 同ネットの場合はハンデの少ない方 → グロスの少ない方を上位とする。
 */
export function leaderboard(event: CompeEvent): LeaderboardRow[] {
  const rows: LeaderboardRow[] = event.players.map((player) => {
    const strokes = event.scores[player.id] ?? [];
    const complete = isComplete(strokes);
    const gross = sum(strokes);
    const toPar = strokes.reduce<number>(
      (acc, s, i) => (s == null ? acc : acc + s - event.pars[i]),
      0,
    );
    const handicap = complete || event.handicapMethod !== 'shin-peoria'
      ? playerHandicap(event, player)
      : null;
    return {
      player,
      thru: holesPlayed(strokes),
      out: sum(strokes.slice(0, 9)),
      in: sum(strokes.slice(9, 18)),
      gross,
      toPar,
      handicap,
      net: complete && handicap != null ? round1(gross - handicap) : null,
      rank: null,
    };
  });

  const finished = rows
    .filter((r) => r.net != null)
    .sort(compareRows);
  finished.forEach((row, i) => {
    const prev = finished[i - 1];
    row.rank = prev && compareRows(prev, row) === 0 ? prev.rank : i + 1;
  });

  const unfinished = rows
    .filter((r) => r.net == null)
    .sort((a, b) => b.thru - a.thru || a.toPar - b.toPar);

  return [...finished, ...unfinished];
}

function compareRows(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    (a.net ?? 0) - (b.net ?? 0) ||
    (a.handicap ?? 0) - (b.handicap ?? 0) ||
    a.gross - b.gross
  );
}

export type AwardKey = 'winner' | StandardAwardKey | 'special' | 'custom';

export interface AwardResult {
  key: AwardKey;
  title: string;
  playerName: string;
  detail?: string;
  /** 表彰式で発表する順（小さいほど先） */
  ceremonyOrder: number;
}

const STANDARD_TITLES: Record<StandardAwardKey, string> = {
  second: '準優勝',
  third: '3位',
  booby: 'ブービー賞',
  booby_maker: 'ブービーメーカー',
  best_gross: 'ベストグロス',
};

/** 定番賞の表示切替用（設定画面） */
export const STANDARD_AWARD_OPTIONS = (Object.keys(STANDARD_TITLES) as StandardAwardKey[]).map((key) => ({
  key,
  title: STANDARD_TITLES[key],
}));

// 表彰式の発表順：追加の賞 → ドラコン・ニアピン → ブービーメーカー → ブービー → ベスグロ → 3位 → 準優勝 → 優勝
const CEREMONY_BASE: Record<Exclude<AwardKey, 'custom'>, number> = {
  special: 2000,
  booby_maker: 3000,
  booby: 3100,
  best_gross: 3200,
  third: 3300,
  second: 3400,
  winner: 3500,
};

/**
 * 表彰の一覧（画面表示の順）。
 * 優勝・準優勝・3位・ベスグロ・ブービー・ブービーメーカー・ドラコン・ニアピン・追加の賞。
 */
export function awards(event: CompeEvent): AwardResult[] {
  const ranked = leaderboard(event).filter((r) => r.rank != null);
  const hidden = new Set(event.hiddenAwards ?? []);
  const result: AwardResult[] = [];
  const net = (r: LeaderboardRow) =>
    event.handicapMethod === 'none' ? `グロス ${r.gross}` : `ネット ${r.net}（グロス ${r.gross} / HC ${r.handicap}）`;
  const push = (key: Exclude<AwardKey, 'custom'>, title: string, row: LeaderboardRow, detail = net(row)) => {
    if (key !== 'winner' && key !== 'special' && hidden.has(key)) return;
    result.push({ key, title, playerName: row.player.name, detail, ceremonyOrder: CEREMONY_BASE[key] });
  };

  if (ranked[0]) push('winner', '優勝', ranked[0]);
  if (ranked[1]) push('second', STANDARD_TITLES.second, ranked[1]);
  if (ranked[2]) push('third', STANDARD_TITLES.third, ranked[2]);
  if (ranked.length > 0) {
    const best = Math.min(...ranked.map((r) => r.gross));
    ranked.filter((r) => r.gross === best).forEach((r) => push('best_gross', STANDARD_TITLES.best_gross, r, `グロス ${r.gross}`));
  }
  if (ranked.length >= 5) {
    push('booby', STANDARD_TITLES.booby, ranked[ranked.length - 2]);
    push('booby_maker', STANDARD_TITLES.booby_maker, ranked[ranked.length - 1]);
  }

  [...event.specialAwards]
    .sort((a, b) => a.hole - b.hole)
    .forEach((award, i) => {
      const winner = event.players.find((p) => p.id === award.winnerPlayerId);
      if (!winner) return;
      result.push({
        key: 'special',
        title: `${award.kind === 'drive' ? 'ドラコン' : 'ニアピン'}（${award.hole}番）`,
        playerName: winner.name,
        detail: award.note || undefined,
        ceremonyOrder: CEREMONY_BASE.special + i,
      });
    });

  (event.customAwards ?? []).forEach((custom, i) => {
    // 飛び賞は下位から発表する
    const order = custom.rule === 'rank' ? 1000 - (custom.rank ?? 0) : 1000 + i;
    for (const w of customAwardWinners(event, custom, ranked)) {
      result.push({ key: 'custom', title: custom.title, playerName: w.name, detail: w.detail, ceremonyOrder: order });
    }
  });

  return result;
}

function customAwardWinners(
  event: CompeEvent,
  award: CustomAward,
  ranked: LeaderboardRow[],
): { name: string; detail?: string }[] {
  switch (award.rule) {
    case 'rank': {
      const row = award.rank ? ranked[award.rank - 1] : undefined;
      return row ? [{ name: row.player.name, detail: `${award.rank}位` }] : [];
    }
    case 'manual': {
      const p = event.players.find((pl) => pl.id === award.winnerPlayerId);
      return p ? [{ name: p.name }] : [];
    }
    case 'most_penalties':
    case 'most_putts': {
      const field = award.rule === 'most_putts' ? 'putts' : 'penalties';
      const values = ranked
        .map((r) => ({ row: r, value: event.stats?.[r.player.id]?.[field] ?? null }))
        .filter((v): v is { row: LeaderboardRow; value: number } => v.value != null && v.value > 0);
      if (values.length === 0) return [];
      const max = Math.max(...values.map((v) => v.value));
      const unit = field === 'putts' ? 'パット' : '回';
      return values.filter((v) => v.value === max).map((v) => ({ name: v.row.player.name, detail: `${max}${unit}` }));
    }
  }
}

/** 表彰式で発表する順（最後が優勝） */
export function ceremonySequence(event: CompeEvent): AwardResult[] {
  return awards(event)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => x.a.ceremonyOrder - y.a.ceremonyOrder || x.i - y.i)
    .map(({ a }) => a);
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 結果の CSV（Excel で開ける。保存時に BOM を付ける） */
export function resultsCsv(event: CompeEvent): string {
  const holes = Array.from({ length: HOLE_COUNT }, (_, i) => `${i + 1}`);
  const lines: (string | number | null | undefined)[][] = [
    [event.name, event.date, event.courseName],
    [],
    ['順位', '名前', '組', ...holes, 'OUT', 'IN', 'グロス', 'HC', 'ネット'],
    ['', 'パー', '', ...event.pars, sum(event.pars.slice(0, 9)), sum(event.pars.slice(9)), sum(event.pars), '', ''],
  ];
  for (const r of leaderboard(event)) {
    const strokes = event.scores[r.player.id] ?? [];
    lines.push([
      r.rank ?? '',
      r.player.name,
      r.player.group ?? '',
      ...Array.from({ length: HOLE_COUNT }, (_, i) => strokes[i] ?? ''),
      r.thru ? r.out : '',
      r.thru ? r.in : '',
      r.thru ? r.gross : '',
      r.handicap ?? '',
      r.net ?? '',
    ]);
  }
  lines.push([], ['賞', '受賞者', '詳細']);
  for (const a of awards(event)) lines.push([a.title, a.playerName, a.detail ?? '']);
  return lines.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/**
 * 新ペリアの隠しホールを選ぶ。
 * 前半・後半それぞれ「パー3×1・パー5×1・パー4×4」を基本に6ホールずつ抽選し、
 * 構成がそろわないコースはランダムに6ホールを選ぶ。
 */
export function pickHiddenHoles(pars: number[], random: () => number = Math.random): number[] {
  const pickFrom = (holes: number[], n: number) => {
    const pool = [...holes];
    const picked: number[] = [];
    while (picked.length < n && pool.length > 0) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return picked;
  };

  const pickNine = (start: number) => {
    const holes = Array.from({ length: 9 }, (_, i) => start + i);
    const byPar = (par: number) => holes.filter((h) => pars[h - 1] === par);
    const p3 = byPar(3);
    const p4 = byPar(4);
    const p5 = byPar(5);
    if (p3.length >= 1 && p5.length >= 1 && p4.length >= 4) {
      return [...pickFrom(p3, 1), ...pickFrom(p5, 1), ...pickFrom(p4, 4)];
    }
    return pickFrom(holes, 6);
  };

  return [...pickNine(1), ...pickNine(10)].sort((a, b) => a - b);
}
