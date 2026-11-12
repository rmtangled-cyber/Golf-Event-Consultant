import type { HandicapMethod } from './types.ts';

export const HANDICAP_OPTIONS: { value: HandicapMethod; label: string }[] = [
  { value: 'shin-peoria', label: '新ペリア' },
  { value: 'fixed', label: '申告ハンデ' },
  { value: 'none', label: 'なし' },
];
