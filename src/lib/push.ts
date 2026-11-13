import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from '@/api/index.ts';
import type { PushPrefs } from '@/api/types.ts';

/**
 * Web プッシュ通知が使えるかどうか
 * - supported: 使える
 * - in-app-browser: LINE などアプリの中のブラウザ（Safari / Chrome で開き直す必要あり）
 * - ios-needs-install: iPhone で、ホーム画面に追加していない
 * - unsupported: 使えない
 */
export type PushSupport = 'supported' | 'in-app-browser' | 'ios-needs-install' | 'unsupported';

export function pushSupport(): PushSupport {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'unsupported';
  const ua = navigator.userAgent;
  if (/\bLine\//i.test(ua) || /FBAN|FBAV|Instagram/i.test(ua)) return 'in-app-browser';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    globalThis.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (ios && !standalone) return 'ios-needs-install';
  const ok = 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
  return ok ? 'supported' : 'unsupported';
}

export function isIos() {
  return Platform.OS === 'web' && /iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent ?? '');
}

/** 通知を表示する Service Worker を登録する（アプリ起動時） */
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || !('serviceWorker' in (globalThis.navigator ?? {}))) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

const prefsKey = (viewToken: string) => `golf-compe/push/${viewToken}`;

/** この端末で、このコンペの通知を受け取る設定にしているか */
export async function loadPushPrefs(viewToken: string): Promise<PushPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(prefsKey(viewToken));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * 通知を受け取る（ボタンを押した直後に呼ぶこと。iPhone は操作の直後でないと許可を出せない）
 */
export async function subscribePush(viewToken: string, prefs: PushPrefs): Promise<void> {
  // 許可のダイアログは、通信より先に出す
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('通知が許可されませんでした。端末の設定から、このアプリの通知を許可してください。');
  }
  const publicKey = await api.getPushPublicKey();
  if (!publicKey) throw new Error('通知の準備ができていません（デモモードでは通知は使えません）。');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('通知の登録に失敗しました。');
  await api.savePushSubscription(viewToken, { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, prefs);
  await AsyncStorage.setItem(prefsKey(viewToken), JSON.stringify(prefs));
}

/** このコンペの通知をやめる（他のコンペの通知はそのまま） */
export async function unsubscribePush(viewToken: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await api.deletePushSubscription(viewToken, subscription.endpoint);
  await AsyncStorage.removeItem(prefsKey(viewToken));
}
