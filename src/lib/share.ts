import { Platform } from 'react-native';

/**
 * ファイルを共有シート（LINE・写真に保存など）で渡す。共有シートが使えなければダウンロードする。
 * Web 版のみ。アプリ版は今後対応。
 */
export async function shareOrDownload(blob: Blob, fileName: string, title: string): Promise<'shared' | 'downloaded'> {
  if (Platform.OS !== 'web') throw new Error('アプリ版では未対応です。Web版から保存してください。');
  const nav = globalThis.navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const file = new File([blob], fileName, { type: blob.type });
  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      // キャンセルされたら何もしない
      if ((e as Error)?.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

/** Excel で文字化けしないよう BOM 付き UTF-8 にする */
export function csvBlob(csv: string): Blob {
  return new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
}

/** ファイル名に使えない文字を除く */
export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'compe';
}
