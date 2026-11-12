import type { EventBundle } from '@/api/types.ts';

export interface OrganizerTabProps {
  bundle: EventBundle;
  /** API を呼び、終わったら読み直す。エラーは画面上部に表示される */
  run: (fn: () => Promise<unknown>) => Promise<void>;
}
