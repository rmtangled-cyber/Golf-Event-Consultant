import AsyncStorage from '@react-native-async-storage/async-storage';
import { Outbox } from '@/sync/outbox.ts';
import { DemoApi } from './demoApi.ts';
import { SupabaseApi } from './supabaseApi.ts';
import type { Api } from './types.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const lineChannelId = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID ?? '';

/** Supabase の設定があれば本番用、なければこの端末だけで動くデモ */
export const api: Api = url && anonKey ? new SupabaseApi(url, anonKey, lineChannelId) : new DemoApi();

/** 組代表の入力を端末に貯めて送る（電波が弱いコース向け） */
export const outbox = new Outbox(AsyncStorage, (token, entries) => api.saveGroupScores(token, entries));

export * from './types.ts';
