/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CompeEvent } from './types.ts';
import { DEFAULT_PARS, awards, ceremonySequence, leaderboard, pickHiddenHoles, resultsCsv, shinPeoriaHandicap } from './scoring.ts';

const HIDDEN = [1, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 17]; // パー合計48

function event(overrides: Partial<CompeEvent> = {}): CompeEvent {
  return {
    id: 'e1',
    name: 'テストコンペ',
    date: '2026-11-12',
    courseName: 'テストCC',
    pars: DEFAULT_PARS,
    handicapMethod: 'shin-peoria',
    hiddenHoles: HIDDEN,
    handicapCap: 36,
    players: [],
    scores: {},
    specialAwards: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

/** 全ホール パー+offset */
const flat = (offset: number) => DEFAULT_PARS.map((p) => p + offset);

test('新ペリア: 全ホールパーならHC0', () => {
  assert.equal(shinPeoriaHandicap(flat(0), DEFAULT_PARS, HIDDEN, 36), 0);
});

test('新ペリア: 全ホールボギーなら (60×1.5−72)×0.8 = 14.4', () => {
  assert.equal(shinPeoriaHandicap(flat(1), DEFAULT_PARS, HIDDEN, 36), 14.4);
});

test('新ペリア: 1ホールの上限はパーの2倍、HCは上限で頭打ち', () => {
  const huge = DEFAULT_PARS.map((p) => p * 5);
  // 隠しホール合計 = 48×2 = 96 → (144−72)×0.8 = 57.6 → 上限36
  assert.equal(shinPeoriaHandicap(huge, DEFAULT_PARS, HIDDEN, 36), 36);
});

test('順位: ネット昇順、未完了者は順位なしで末尾', () => {
  const e = event({
    players: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ],
    scores: {
      a: flat(1), // gross 90, HC 14.4, net 75.6
      b: flat(0), // gross 72, HC 0, net 72
      c: [5, 4, null, ...Array(15).fill(null)],
    },
  });
  const rows = leaderboard(e);
  assert.deepEqual(rows.map((r) => [r.player.id, r.rank, r.net]), [
    ['b', 1, 72],
    ['a', 2, 75.6],
    ['c', null, null],
  ]);
  assert.equal(rows[2].thru, 2);
  assert.equal(rows[2].toPar, 1);
});

test('順位: 同ネットはハンデの少ない方が上位', () => {
  const e = event({
    handicapMethod: 'fixed',
    players: [
      { id: 'a', name: 'A', handicap: 18 },
      { id: 'b', name: 'B', handicap: 0 },
    ],
    scores: { a: flat(1), b: flat(0) }, // net 72 同士
  });
  assert.deepEqual(leaderboard(e).map((r) => r.player.id), ['b', 'a']);
});

test('賞: ブービー・ベスグロ・ドラコン', () => {
  const players = ['A', 'B', 'C', 'D', 'E'].map((name, i) => ({ id: String(i), name, handicap: 0 }));
  const scores = Object.fromEntries(players.map((p, i) => [p.id, flat(i)]));
  const e = event({
    handicapMethod: 'none',
    players,
    scores,
    specialAwards: [{ id: 's', kind: 'drive', hole: 4, winnerPlayerId: '2' }],
  });
  const result = Object.fromEntries(awards(e).map((a) => [a.title, a.playerName]));
  assert.equal(result['優勝'], 'A');
  assert.equal(result['ブービー賞'], 'D');
  assert.equal(result['ブービーメーカー'], 'E');
  assert.equal(result['ベストグロス'], 'A');
  assert.equal(result['ドラコン（4番）'], 'C');
});

test('隠しホール: 12ホール・前後半6ずつ・合計パー48', () => {
  for (let i = 0; i < 50; i++) {
    const holes = pickHiddenHoles(DEFAULT_PARS);
    assert.equal(new Set(holes).size, 12);
    assert.equal(holes.filter((h) => h <= 9).length, 6);
    assert.equal(holes.reduce((acc, h) => acc + DEFAULT_PARS[h - 1], 0), 48);
  }
});

/** A〜G の7人。i 番目の人は全ホール パー+i（A が1位、G が最下位） */
function sevenPlayers(overrides: Partial<CompeEvent> = {}) {
  const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => ({ id: String(i), name, group: 1 + Math.floor(i / 4) }));
  const scores = Object.fromEntries(players.map((p, i) => [p.id, flat(i)]));
  return event({ handicapMethod: 'none', players, scores, ...overrides });
}

test('追加の賞：飛び賞・OB王（同数は全員）・手動', () => {
  const e = sevenPlayers({
    customAwards: [
      { id: 'c1', title: '飛び賞', rule: 'rank', rank: 4 },
      { id: 'c2', title: 'OB王', rule: 'most_penalties' },
      { id: 'c3', title: 'ラッキー賞', rule: 'manual', winnerPlayerId: '2' },
      { id: 'c4', title: '最多パット', rule: 'most_putts' },
    ],
    stats: {
      '0': { putts: 30, penalties: 1 },
      '1': { putts: null, penalties: 3 },
      '5': { putts: null, penalties: 3 },
    },
  });
  const custom = awards(e).filter((a) => a.key === 'custom').map((a) => [a.title, a.playerName, a.detail]);
  assert.deepEqual(custom, [
    ['飛び賞', 'D', '4位'],
    ['OB王', 'B', '3回'],
    ['OB王', 'F', '3回'],
    ['ラッキー賞', 'C', undefined],
    ['最多パット', 'A', '30パット'],
  ]);
});

test('定番賞は非表示にできる（優勝は消せない）', () => {
  const e = sevenPlayers({ hiddenAwards: ['booby', 'booby_maker', 'best_gross'] });
  const titles = awards(e).map((a) => a.title);
  assert.deepEqual(titles, ['優勝', '準優勝', '3位']);
});

test('表彰式の発表順：飛び賞（下位から）→ ドラコン → ブービーメーカー … → 優勝', () => {
  const e = sevenPlayers({
    customAwards: [
      { id: 'c1', title: '飛び賞', rule: 'rank', rank: 4 },
      { id: 'c2', title: '飛び賞', rule: 'rank', rank: 6 },
    ],
    specialAwards: [{ id: 's', kind: 'drive', hole: 4, winnerPlayerId: '3' }],
  });
  assert.deepEqual(
    ceremonySequence(e).map((a) => `${a.title}:${a.playerName}`),
    ['飛び賞:F', '飛び賞:D', 'ドラコン（4番）:D', 'ブービーメーカー:G', 'ブービー賞:F', 'ベストグロス:A', '3位:C', '準優勝:B', '優勝:A'],
  );
});

test('CSV：パー行・全ホール・表彰。カンマを含む名前は引用符で囲む', () => {
  const e = sevenPlayers();
  e.players[0].name = '山田, 太郎';
  const csv = resultsCsv(e);
  const lines = csv.split('\r\n');
  assert.equal(lines[2], ['順位', '名前', '組', ...Array.from({ length: 18 }, (_, i) => i + 1), 'OUT', 'IN', 'グロス', 'HC', 'ネット'].join(','));
  assert.ok(lines[3].startsWith(',パー,,4,4,3,5'));
  assert.ok(lines[4].startsWith('1,"山田, 太郎",1,4,4,3'));
  assert.ok(lines[4].endsWith(',36,36,72,0,72'));
  assert.ok(csv.includes('\r\n優勝,"山田, 太郎",グロス 72\r\n'));
});
