import { awards, leaderboard } from '@/domain/scoring.ts';
import type { CompeEvent } from '@/domain/types.ts';

/**
 * 結果をスマホの縦長画像（PNG）にする。LINE のトークに貼りやすい幅 1080px。
 * Web 版のみ（canvas を使う）。
 */
export async function renderResultImage(event: CompeEvent): Promise<Blob> {
  const W = 1080;
  const PAD = 64;
  const font = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif';
  const color = {
    green: '#1B6B3A',
    greenDark: '#124D29',
    soft: '#E5F2EA',
    gold: '#B8860B',
    goldBg: '#FBF6E6',
    text: '#1C1F1D',
    muted: '#6B746E',
    line: '#DCE2DE',
    white: '#FFFFFF',
  };

  const results = awards(event);
  const rows = leaderboard(event).filter((r) => r.rank != null);
  const showNet = event.handicapMethod !== 'none';

  const HEADER = 260;
  const AWARD_ROW = 76;
  const TABLE_ROW = 64;
  const H =
    HEADER + 56 + 60 + results.length * AWARD_ROW + 56 + 60 + TABLE_ROW + rows.length * TABLE_ROW + 120;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const text = (s: string, x: number, y: number, size: number, fill: string, weight = 400, align: CanvasTextAlign = 'left') => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = fill;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  };
  /** 幅に収まらない名前は末尾を「…」にする */
  const fit = (s: string, size: number, weight: number, max: number) => {
    ctx.font = `${weight} ${size}px ${font}`;
    if (ctx.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
  };

  ctx.fillStyle = color.white;
  ctx.fillRect(0, 0, W, H);

  // 見出し
  ctx.fillStyle = color.green;
  ctx.fillRect(0, 0, W, HEADER);
  text('⛳ 結果発表', PAD, 70, 34, '#CFE6D7', 700);
  text(fit(event.name, 60, 800, W - PAD * 2), PAD, 140, 60, color.white, 800);
  text([event.date, event.courseName].filter(Boolean).join('　'), PAD, 210, 32, '#CFE6D7', 500);

  let y = HEADER + 56;

  // 表彰
  text('表彰', PAD, y + 20, 40, color.greenDark, 800);
  y += 60;
  results.forEach((a, i) => {
    const top = a.key === 'winner';
    if (top) {
      ctx.fillStyle = color.goldBg;
      ctx.fillRect(PAD - 16, y, W - (PAD - 16) * 2, AWARD_ROW);
    }
    const cy = y + AWARD_ROW / 2;
    text(fit(a.title, 30, 700, 300), PAD, cy, 30, top ? color.gold : color.green, 700);
    text(fit(a.playerName, 38, 800, 330), PAD + 320, cy, 38, color.text, 800);
    // 画像では「ネット 72（グロス…）」の括弧の前だけを出す（詳細は順位表にある）
    const detail = a.detail?.split('（')[0];
    if (detail) text(fit(detail, 26, 500, W - PAD - (PAD + 680)), W - PAD, cy, 26, color.muted, 500, 'right');
    if (i < results.length - 1) {
      ctx.fillStyle = color.line;
      ctx.fillRect(PAD, y + AWARD_ROW - 1, W - PAD * 2, 2);
    }
    y += AWARD_ROW;
  });

  // 順位表
  y += 56;
  text('順位', PAD, y + 20, 40, color.greenDark, 800);
  y += 60;
  const cols = showNet
    ? [
        { label: '順位', x: PAD + 40, align: 'center' as const },
        { label: '名前', x: PAD + 110, align: 'left' as const },
        { label: 'グロス', x: W - PAD - 330, align: 'right' as const },
        { label: 'HC', x: W - PAD - 180, align: 'right' as const },
        { label: 'ネット', x: W - PAD, align: 'right' as const },
      ]
    : [
        { label: '順位', x: PAD + 40, align: 'center' as const },
        { label: '名前', x: PAD + 110, align: 'left' as const },
        { label: 'OUT', x: W - PAD - 330, align: 'right' as const },
        { label: 'IN', x: W - PAD - 180, align: 'right' as const },
        { label: 'グロス', x: W - PAD, align: 'right' as const },
      ];
  ctx.fillStyle = color.soft;
  ctx.fillRect(PAD - 16, y, W - (PAD - 16) * 2, TABLE_ROW);
  cols.forEach((c) => text(c.label, c.x, y + TABLE_ROW / 2, 26, color.greenDark, 700, c.align));
  y += TABLE_ROW;
  rows.forEach((r) => {
    const cy = y + TABLE_ROW / 2;
    const values = showNet
      ? [String(r.rank), r.player.name, String(r.gross), String(r.handicap ?? ''), String(r.net ?? '')]
      : [String(r.rank), r.player.name, String(r.out), String(r.in), String(r.gross)];
    const top3 = (r.rank ?? 99) <= 3;
    values.forEach((v, i) => {
      const c = cols[i];
      const isName = i === 1;
      const last = i === values.length - 1;
      text(
        isName ? fit(v, 32, 700, W - PAD - 360 - c.x - 40) : v,
        c.x,
        cy,
        32,
        i === 0 && top3 ? color.gold : last ? color.green : color.text,
        i === 0 || last || isName ? 800 : 500,
        c.align,
      );
    });
    ctx.fillStyle = color.line;
    ctx.fillRect(PAD, y + TABLE_ROW - 1, W - PAD * 2, 2);
    y += TABLE_ROW;
  });

  text('ゴルフコンペ', W / 2, H - 50, 24, color.muted, 500, 'center');

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png'),
  );
}
