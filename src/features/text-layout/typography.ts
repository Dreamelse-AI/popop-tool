/**
 * 排版字体系统（单一事实源）。
 *
 * 借鉴自 guizang social-card skill 的「越大越细」(the larger, the lighter) 原则：
 *   - 字号越大，字重越轻（大标题 300-500，正文 400，小字才 500-700）
 *   - 小字（kicker/meta）配等宽字体 + 加宽字距
 *
 * 注意：这是参数口径与设计原则的迁移，非代码拷贝。
 */

/** 字体气质：衬线（抒情/杂志感）/ 无衬线（数据/现代感）。 */
export type FontKind = 'serif' | 'sans';

/** 字体栈：按气质选用，需与 index.css 中加载的字族对应。 */
export const FONT_STACKS: Record<FontKind, string> = {
  serif: '"Noto Serif SC", "Songti SC", "STSong", serif',
  sans: '"Noto Sans SC", "PingFang SC", "Inter", sans-serif',
};

/** 等宽字体栈：用于 kicker / meta / 页码等小字标签。 */
export const MONO_STACK = '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace';

/** 西文衬线（副标/引文斜体）。 */
export const SERIF_EN_STACK = '"Playfair Display", "Noto Serif SC", serif';

/**
 * 「越大越细」字重曲线：按字号返回建议字重。
 * 字号基于 1080×810 画布（未乘 scale）。
 *
 * @param size   字号(px)
 * @param kind   字体气质（sans 比 serif 整体再轻一档，呼应瑞士国际主义大字超细）
 */
export function weightForSize(size: number, kind: FontKind = 'serif'): number {
  // 分档阈值参考 components.md 字号表
  const table: Array<{ min: number; serif: number; sans: number }> = [
    { min: 120, serif: 500, sans: 200 }, // display / hero
    { min: 80, serif: 500, sans: 300 }, // 区块标题
    { min: 48, serif: 500, sans: 400 }, // 中标题
    { min: 28, serif: 400, sans: 400 }, // 正文 / lead
    { min: 0, serif: 500, sans: 600 }, // 小字（kicker/meta/label）反而更重
  ];
  const row = table.find((r) => size >= r.min) ?? table[table.length - 1];
  return kind === 'sans' ? row.sans : row.serif;
}

/**
 * 中文标题字号分档：按字符数 + 行数给出建议字号（防溢出）。
 * 口径参考 components.md「Chinese Title Length Bands」。基于 1080 宽画布。
 *
 * @param charsPerLine 单行最多字符数
 * @param lines        行数
 * @param kind         字体气质（sans 体系整体更大）
 */
export function titleSizeForChinese(
  charsPerLine: number,
  lines: number,
  kind: FontKind = 'serif',
): number {
  if (lines >= 3) return kind === 'sans' ? 132 : 72;
  if (lines === 2) return charsPerLine >= 9 ? (kind === 'sans' ? 152 : 84) : kind === 'sans' ? 180 : 96;
  // 单行
  if (charsPerLine <= 6) return kind === 'sans' ? 240 : 132;
  if (charsPerLine <= 10) return kind === 'sans' ? 200 : 108;
  return kind === 'sans' ? 180 : 96;
}

/** 小字（kicker/meta）建议字距(em)：小字加宽，呼应 mono 标签气质。 */
export const KICKER_TRACKING_EM = 0.2;

/** 移动端最小可读字号(px，基于 1080 宽)：正文不得低于此值。 */
export const MIN_READABLE_BODY = 28;
