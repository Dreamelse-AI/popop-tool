/**
 * 排版参数模版导出：JSON / CSV / Markdown 三种格式，纯前端触发浏览器下载。
 *
 * - JSON：完整结构，直接喂给代码 / AI 排版引擎（核心格式，保真）。
 * - CSV：每个文本块一行，适合 Excel 横向对比多套模版（含 BOM 兼容中文）。
 * - Markdown：人读参数表，适合贴文档 / 评审。
 *
 * 单条或多条均可导出；多条时打包进一个文件（JSON 为数组，CSV/MD 顺序拼接）。
 */

import type { LayoutParamTemplate, TextBlockParam } from '@/types/layoutParam';

/** 触发浏览器下载一段文本内容。 */
function downloadText(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 带时间戳文件名；单条用模版 id。 */
function buildFileName(templates: LayoutParamTemplate[], ext: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  if (templates.length === 1 && templates[0].id) {
    return `layout-${templates[0].id}.${ext}`;
  }
  return `layout-params-${stamp}.${ext}`;
}

/** 导出 JSON（单条为对象，多条为数组）。 */
export function downloadJson(templates: LayoutParamTemplate[]): void {
  if (templates.length === 0) return;
  const payload = templates.length === 1 ? templates[0] : templates;
  downloadText(
    JSON.stringify(payload, null, 2),
    buildFileName(templates, 'json'),
    'application/json;charset=utf-8;',
  );
}

/** CSV 表头：模版元信息 + 画布 + 单个文本块的所有参数。 */
const CSV_HEADERS = [
  'templateId',
  'templateName',
  'vibe',
  'ratio',
  'refWidth',
  'refHeight',
  'padding',
  'gridColumns',
  'blockGap',
  'scaleRatio',
  'density',
  'alignmentMood',
  'role',
  'fontKind',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'anchor',
  'writingMode',
  'textTransform',
  'maxCharsPerLine',
  'maxLines',
  'rotation',
  'offsetYPercent',
] as const;

/** 转义单个 CSV 字段。 */
function escapeCell(value: string | number): string {
  const v = String(value ?? '');
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 把一个文本块拍平成一行（含所属模版信息）。 */
function blockToRow(t: LayoutParamTemplate, b: TextBlockParam): (string | number)[] {
  return [
    t.id,
    t.name,
    t.vibe,
    t.canvas.ratio,
    t.canvas.referenceWidth,
    t.canvas.referenceHeight,
    t.canvas.padding,
    t.canvas.gridColumns,
    t.canvas.blockGap,
    t.rhythm.scaleRatio,
    t.rhythm.density,
    t.rhythm.alignmentMood,
    b.role,
    b.fontKind,
    b.fontSize,
    b.fontWeight,
    b.lineHeight,
    b.letterSpacing,
    b.textAlign,
    b.anchor,
    b.writingMode,
    b.textTransform,
    b.maxCharsPerLine,
    b.maxLines,
    b.rotation,
    b.offsetYPercent ?? '',
  ];
}

/** 导出 CSV（每个文本块一行，含 BOM 兼容 Excel 中文）。 */
export function downloadCsv(templates: LayoutParamTemplate[]): void {
  if (templates.length === 0) return;
  const lines = [CSV_HEADERS.join(',')];
  for (const t of templates) {
    for (const b of t.blocks) {
      lines.push(blockToRow(t, b).map(escapeCell).join(','));
    }
  }
  downloadText(`\uFEFF${lines.join('\r\n')}`, buildFileName(templates, 'csv'), 'text/csv;charset=utf-8;');
}

/** 单套模版转 Markdown 段落。 */
function templateToMarkdown(t: LayoutParamTemplate): string {
  const head = [
    `## ${t.name}`,
    '',
    `- **id**: \`${t.id}\``,
    `- **气质**: ${t.vibe}`,
    `- **画布**: ${t.canvas.ratio} · ${t.canvas.referenceWidth}×${t.canvas.referenceHeight}px · 边距 ${t.canvas.padding}px · ${t.canvas.gridColumns} 栏 · 块间距 ${t.canvas.blockGap}px`,
    `- **节奏**: 字阶 ${t.rhythm.scaleRatio} · 密度 ${t.rhythm.density} · 对齐 ${t.rhythm.alignmentMood}`,
    '',
    '| 角色 | 字体 | 字号 | 字重 | 行高 | 字距 | 对齐 | 锚点 | 方向 | 变换 | 单行字数 | 最大行 | 旋转 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const rows = t.blocks.map(
    (b) =>
      `| ${b.role} | ${b.fontKind} | ${b.fontSize} | ${b.fontWeight} | ${b.lineHeight} | ${b.letterSpacing} | ${b.textAlign} | ${b.anchor} | ${b.writingMode} | ${b.textTransform} | ${b.maxCharsPerLine} | ${b.maxLines} | ${b.rotation}° |`,
  );
  return [...head, ...rows, ''].join('\n');
}

/** 导出 Markdown 参数表。 */
export function downloadMarkdown(templates: LayoutParamTemplate[]): void {
  if (templates.length === 0) return;
  const body = templates.map(templateToMarkdown).join('\n');
  const doc = `# 排版参数表\n\n> 共 ${templates.length} 套模版 · 仅含排版规则，不含文字内容与背景色\n\n${body}`;
  downloadText(doc, buildFileName(templates, 'md'), 'text/markdown;charset=utf-8;');
}
