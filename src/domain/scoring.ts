import type { CompeEvent, Player } from './types.ts';
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

export interface AwardResult {
  title: string;
  playerName: string;
  detail?: string;
}

/** 優勝・準優勝・3位・ブービー・ブービーメーカー・ベスグロ・ドラコン・ニアピン */
export function awards(event: CompeEvent): AwardResult[] {
  const ranked = leaderboard(event).filter((r) => r.rank != null);
  const result: AwardResult[] = [];
  const net = (r: LeaderboardRow) => `ネット ${r.net}（グロス ${r.gross} / HC ${r.handicap}）`;

  (['優勝', '準優勝', '3位'] as const).forEach((title, i) => {
    if (ranked[i]) result.push({ title, playerName: ranked[i].player.name, detail: net(ranked[i]) });
  });
  if (ranked.length >= 5) {
    const booby = ranked[ranked.length - 2];
    const maker = ranked[ranked.length - 1];
    result.push({ title: 'ブービー賞', playerName: booby.player.name, detail: net(booby) });
    result.push({ title: 'ブービーメーカー', playerName: maker.player.name, detail: net(maker) });
  }
  if (ranked.length > 0) {
    const best = Math.min(...ranked.map((r) => r.gross));
    ranked
      .filter((r) => r.gross === best)
      .forEach((r) => result.push({ title: 'ベストグロス', playerName: r.player.name, detail: `グロス ${r.gross}` }));
  }
  for (const award of [...event.specialAwards].sort((a, b) => a.hole - b.hole)) {
    const winner = event.players.find((p) => p.id === award.winnerPlayerId);
    if (!winner) continue;
    result.push({
      title: `${award.kind === 'drive' ? 'ドラコン' : 'ニアピン'}（${award.hole}番）`,
      playerName: winner.name,
      detail: award.note || undefined,
    });
  }
  return result;
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
