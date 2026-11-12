import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

/** アプリ内のパスを、他の人に送れる URL にする */
export function absoluteUrl(path: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return Linking.createURL(path);
}

/** LINE の「送信先を選ぶ」画面を開く */
export function shareToLine(text: string) {
  return Linking.openURL(`https://line.me/R/share?text=${encodeURIComponent(text)}`);
}

/** クリップボードにコピー。できない環境では共有シートを出す */
export async function copyText(text: string): Promise<'copied' | 'shared'> {
  const clipboard = (globalThis as any).navigator?.clipboard;
  if (Platform.OS === 'web' && clipboard?.writeText) {
    await clipboard.writeText(text);
    return 'copied';
  }
  await Share.share({ message: text });
  return 'shared';
}
