import type { ScoreEntry, ScoreInfo } from '../api/types.ts';
import { ApiError, isRetryable } from '../api/types.ts';

/**
 * 未送信のスコア入力（電波が弱いコース向け）。
 * 入力はまず端末に貯め、送信に成功したものから消す。
 * 同じ人・同じホールの入力は新しいものだけを残す。
 */
export interface OutboxItem {
  token: string;
  entry: ScoreEntry;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const keyOf = (item: OutboxItem) => `${item.token}|${item.entry.playerId}|${item.entry.hole}`;

/** 同じキーは updatedAt が新しい方を残す */
export function mergeOutbox(queue: OutboxItem[], incoming: OutboxItem[]): OutboxItem[] {
  const map = new Map(queue.map((item) => [keyOf(item), item]));
  for (const item of incoming) {
    const existing = map.get(keyOf(item));
    if (!existing || existing.entry.updatedAt <= item.entry.updatedAt) map.set(keyOf(item), item);
  }
  return [...map.values()];
}

/** サーバーのスコアに未送信の入力を重ねて、画面に出す値を作る */
export function applyPending(scores: ScoreInfo[], pending: ScoreEntry[]): ScoreInfo[] {
  const map = new Map(scores.map((s) => [`${s.playerId}|${s.hole}`, s]));
  for (const e of pending) {
    const key = `${e.playerId}|${e.hole}`;
    const current = map.get(key);
    if (current && current.updatedAt > e.updatedAt) continue;
    if (e.strokes == null) map.delete(key);
    else
      map.set(key, {
        playerId: e.playerId,
        hole: e.hole,
        strokes: e.strokes,
        putts: e.putts,
        penalties: e.penalties,
        updatedAt: e.updatedAt,
      });
  }
  return [...map.values()];
}

export type SendFn = (token: string, entries: ScoreEntry[]) => Promise<void>;

export interface OutboxState {
  pending: number;
  /** 直近の送信が通信エラーで失敗した（電波待ち）。送れている間は false */
  failing: boolean;
  /** 送れずに捨てた入力（提出済み・結果確定など）。画面で知らせる */
  rejected: { token: string; code: string; count: number } | null;
}

export class Outbox {
  private queue: OutboxItem[] = [];
  private loaded = false;
  private flushing: Promise<void> | null = null;
  private listeners = new Set<(state: OutboxState) => void>();
  private rejected: OutboxState['rejected'] = null;
  private failing = false;

  private storage: KeyValueStorage;
  private send: SendFn;
  private storageKey: string;

  constructor(storage: KeyValueStorage, send: SendFn, storageKey = 'golf-compe/outbox/v1') {
    this.storage = storage;
    this.send = send;
    this.storageKey = storageKey;
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await this.storage.getItem(this.storageKey);
      const saved: OutboxItem[] = raw ? JSON.parse(raw) : [];
      this.queue = mergeOutbox(saved, this.queue);
    } catch {
      // 壊れたデータは捨てる
    }
    this.loaded = true;
    this.emit();
  }

  pendingFor(token: string): ScoreEntry[] {
    return this.queue.filter((i) => i.token === token).map((i) => i.entry);
  }

  get state(): OutboxState {
    return { pending: this.queue.length, failing: this.failing && this.queue.length > 0, rejected: this.rejected };
  }

  subscribe(listener: (state: OutboxState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clearRejected() {
    this.rejected = null;
    this.emit();
  }

  async enqueue(token: string, entries: ScoreEntry[]) {
    await this.load();
    this.queue = mergeOutbox(this.queue, entries.map((entry) => ({ token, entry })));
    await this.persist();
    this.emit();
    void this.flush();
  }

  /** 貯まっている入力を送る。同時に1つしか走らない */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush() {
    await this.load();
    const tokens = [...new Set(this.queue.map((i) => i.token))];
    for (const token of tokens) {
      const batch = this.queue.filter((i) => i.token === token);
      if (batch.length === 0) continue;
      try {
        await this.send(token, batch.map((i) => i.entry));
        this.failing = false;
        this.removeSent(batch);
      } catch (error) {
        if (isRetryable(error)) {
          // 電波が戻ったら送り直す
          this.failing = true;
          this.emit();
          continue;
        }
        // 提出済み・結果確定などで受け付けられない入力は捨てて知らせる
        this.rejected = {
          token,
          code: error instanceof ApiError ? error.code : 'unknown',
          count: batch.length,
        };
        this.removeSent(batch);
      }
      await this.persist();
      this.emit();
    }
  }

  /** 送信中に同じホールが入力し直されていたら、そちらは残す */
  private removeSent(sent: OutboxItem[]) {
    const sentAt = new Map(sent.map((i) => [keyOf(i), i.entry.updatedAt]));
    this.queue = this.queue.filter((i) => sentAt.get(keyOf(i)) !== i.entry.updatedAt);
  }

  private async persist() {
    try {
      await this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch {
      // 保存できなくてもメモリ上の送信は続ける
    }
  }

  private emit() {
    const state = this.state;
    this.listeners.forEach((l) => l(state));
  }
}
