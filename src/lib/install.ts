import { Platform } from 'react-native';

/**
 * 「ホーム画面に追加」の案内が必要な環境
 * - in-app: LINE などアプリの中のブラウザ（まずブラウザで開き直す）
 * - ios / android: スマホのブラウザで、まだホーム画面から開いていない
 * - null: 案内不要（PC、すでにホーム画面のアイコンから開いている）
 */
export type InstallMode = 'in-app' | 'ios' | 'android' | null;

export function isStandalone() {
  if (Platform.OS !== 'web') return true;
  return globalThis.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function installMode(): InstallMode {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || isStandalone()) return null;
  const ua = navigator.userAgent;
  if (/\bLine\//i.test(ua) || /FBAN|FBAV|Instagram/i.test(ua)) return 'in-app';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

export function isIosDevice() {
  return Platform.OS === 'web' && /iPhone|iPad|iPod/.test(globalThis.navigator?.userAgent ?? '');
}

/**
 * LINE で送るリンク。末尾に openExternalBrowser=1 を付けると、
 * LINE の中ではなく Safari / Chrome で開く（ホーム画面に追加・通知のため）
 */
export function withExternalBrowser(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}openExternalBrowser=1`;
}

// Android の Chrome は「ホーム画面に追加」をボタン1つで出せる（イベントを取っておく）
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: InstallPromptEvent | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

export function canPromptInstall() {
  return !!deferredPrompt;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}
