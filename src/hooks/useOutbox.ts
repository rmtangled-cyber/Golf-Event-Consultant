import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { outbox } from '@/api/index.ts';
import type { OutboxState } from '@/sync/outbox.ts';

const RETRY_MS = 10_000;

/** 未送信の入力の件数を見張り、定期的に送り直す */
export function useOutbox() {
  const [state, setState] = useState<OutboxState>(outbox.state);
  useEffect(() => {
    const unsubscribe = outbox.subscribe(setState);
    void outbox.load().then(() => outbox.flush());
    const timer = setInterval(() => void outbox.flush(), RETRY_MS);
    const onOnline = () => void outbox.flush();
    if (Platform.OS === 'web') globalThis.addEventListener?.('online', onOnline);
    return () => {
      unsubscribe();
      clearInterval(timer);
      if (Platform.OS === 'web') globalThis.removeEventListener?.('online', onOnline);
    };
  }, []);
  return state;
}
