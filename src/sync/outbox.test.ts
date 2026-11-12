/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/types.ts';
import type { ScoreEntry } from '../api/types.ts';
import { Outbox, applyPending, mergeOutbox } from './outbox.ts';

const entry = (hole: number, strokes: number | null, at: string, playerId = 'p1'): ScoreEntry => ({
  playerId,
  hole,
  strokes,
  putts: null,
  penalties: null,
  updatedAt: at,
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
  };
}

test('mergeOutbox: 同じホールは新しい入力だけ残る', () => {
  const q = mergeOutbox(
    [{ token: 't', entry: entry(1, 5, '2026-01-01T10:00:00Z') }],
    [
      { token: 't', entry: entry(1, 4, '2026-01-01T10:01:00Z') },
      { token: 't', entry: entry(1, 9, '2026-01-01T09:00:00Z') },
      { token: 't', entry: entry(2, 3, '2026-01-01T10:02:00Z') },
    ],
  );
  assert.deepEqual(q.map((i) => [i.entry.hole, i.entry.strokes]), [[1, 4], [2, 3]]);
});

test('applyPending: 未送信の入力を重ね、null は消す。サーバーの方が新しければそちら', () => {
  const server = [
    { playerId: 'p1', hole: 1, strokes: 5, putts: null, penalties: null, updatedAt: '2026-01-01T10:00:00Z' },
    { playerId: 'p1', hole: 2, strokes: 4, putts: null, penalties: null, updatedAt: '2026-01-01T12:00:00Z' },
  ];
  const result = applyPending(server, [
    entry(1, null, '2026-01-01T11:00:00Z'),
    entry(2, 7, '2026-01-01T11:00:00Z'),
    entry(3, 3, '2026-01-01T11:00:00Z'),
  ]);
  assert.deepEqual(
    result.map((s) => [s.hole, s.strokes]).sort(),
    [[2, 4], [3, 3]],
  );
});

test('Outbox: 通信エラーなら貯めたまま、復帰後に送って空になる', async () => {
  let online = false;
  const sent: ScoreEntry[][] = [];
  const storage = memoryStorage();
  const outbox = new Outbox(storage, async (_token, entries) => {
    if (!online) throw new ApiError('network');
    sent.push(entries);
  });
  await outbox.enqueue('t', [entry(1, 5, '2026-01-01T10:00:00Z')]);
  await outbox.flush();
  assert.equal(outbox.state.pending, 1);
  assert.ok(storage.data.get('golf-compe/outbox/v1')?.includes('"strokes":5'), '端末に保存される');

  // アプリを開き直しても残っている
  const reopened = new Outbox(storage, async (_token, entries) => void sent.push(entries));
  await reopened.load();
  assert.equal(reopened.state.pending, 1);

  online = true;
  await reopened.flush();
  assert.equal(reopened.state.pending, 0);
  assert.equal(sent.length, 1);
});

test('Outbox: 提出済みで受け付けられない入力は捨てて知らせる', async () => {
  const outbox = new Outbox(memoryStorage(), async () => {
    throw new ApiError('group_submitted');
  });
  await outbox.enqueue('t', [entry(1, 5, '2026-01-01T10:00:00Z')]);
  await outbox.flush();
  assert.equal(outbox.state.pending, 0);
  assert.deepEqual(outbox.state.rejected, { token: 't', code: 'group_submitted', count: 1 });
});

test('Outbox: 送信中に同じホールを入力し直したら、新しい方は残る', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const outbox = new Outbox(memoryStorage(), async () => gate);
  await outbox.enqueue('t', [entry(1, 5, '2026-01-01T10:00:00Z')]);
  const flushing = outbox.flush();
  await outbox.enqueue('t', [entry(1, 6, '2026-01-01T10:05:00Z')]);
  release();
  await flushing;
  assert.deepEqual(outbox.pendingFor('t').map((e) => e.strokes), [6]);
});
