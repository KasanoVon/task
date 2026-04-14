/** 分（整数）を表示文字列に変換 */
export function durStr(min: number): string {
  if (!min || min <= 0) return '0分';
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

/** 旧フォーマット文字列 or 数値 → 分（整数） */
export function parseDurStr(s: string | number): number {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const hm = s.match(/(\d+)時間(?:(\d+)分)?/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const m = s.match(/(\d+)分/);
  if (m) return Number(m[1]);
  const n = parseInt(s);
  return isNaN(n) ? 0 : n;
}
