import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompeEvent } from '@/domain/types.ts';

/**
 * 永続化の抽象。今は端末内（Web: localStorage / ネイティブ: AsyncStorage）に保存。
 * 将来、参加者全員でスコアを共有する場合はこのインターフェースを
 * クラウド（Supabase / Firebase など）実装に差し替える。
 */
export interface EventRepository {
  loadAll(): Promise<CompeEvent[]>;
  saveAll(events: CompeEvent[]): Promise<void>;
}

const KEY = 'golf-compe/events/v1';

export const localRepository: EventRepository = {
  async loadAll() {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CompeEvent[];
    } catch {
      return [];
    }
  },
  async saveAll(events) {
    await AsyncStorage.setItem(KEY, JSON.stringify(events));
  },
};
