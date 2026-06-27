/**
 * 情绪配色库——把识别结果导出为 CSV 色值表并触发浏览器下载。
 *
 * 纯前端方案：不依赖任何服务器存储，字段与页面表格展示一致：
 *   id / 主色板 / 方案A(名字·底色·字色·情绪) / 方案B(同上)
 */

import type { PaletteDraft } from '@/types/palette';

/** CSV 表头（与页面展示字段一一对应）。 */
const HEADERS = [
  'id',
  'colors',
  'A_name',
  'A_bgColor',
  'A_fontColor',
  'A_mood',
  'B_name',
  'B_bgColor',
  'B_fontColor',
  'B_mood',
] as const;

/** 转义单个 CSV 字段：含逗号/引号/换行时用双引号包裹并转义内部引号。 */
function escapeCell(value: string): string {
  const v = value ?? '';
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** 把一条草稿拍平成一行 CSV 字段数组。 */
function draftToRow(draft: PaletteDraft): string[] {
  const a = draft.schemes[0];
  const b = draft.schemes[1];
  return [
    draft.id,
    draft.colors.join(' '),
    a?.name ?? '',
    a?.bgColor ?? '',
    a?.fontColor ?? '',
    a?.mood ?? '',
    b?.name ?? '',
    b?.bgColor ?? '',
    b?.fontColor ?? '',
    b?.mood ?? '',
  ];
}

/** 把多条草稿拼成 CSV 文本（含 BOM，保证 Excel 正确识别 UTF-8 中文）。 */
export function buildCsv(drafts: PaletteDraft[]): string {
  const lines = [HEADERS.join(',')];
  for (const draft of drafts) {
    lines.push(draftToRow(draft).map(escapeCell).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

/** 生成带时间戳的文件名，单条时用 id 命名。 */
function buildFileName(drafts: PaletteDraft[]): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-');
  if (drafts.length === 1 && drafts[0].id) {
    return `palette-${drafts[0].id}.csv`;
  }
  return `palette-${stamp}.csv`;
}

/**
 * 把若干条草稿导出为 CSV 文件并触发下载。
 * @param drafts 待导出的草稿（单条或多条）
 */
export function downloadPaletteCsv(drafts: PaletteDraft[]): void {
  if (drafts.length === 0) return;
  const csv = buildCsv(drafts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildFileName(drafts);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
