import { useEffect, useState } from 'react';
import { api } from '@/api/index.ts';
import type { Organizer } from '@/api/index.ts';

/** ログイン中の幹事（未ログインなら null、確認中は undefined） */
export function useOrganizer() {
  const [organizer, setOrganizer] = useState<Organizer | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => void api.getOrganizer().then(setOrganizer);
    refresh();
    return api.onAuthChange(refresh);
  }, []);
  return organizer;
}
