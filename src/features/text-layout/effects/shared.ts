/**
 * 特效渲染共享工具：随机数、数值处理、文本拆分。
 * 移植自参考实现，去掉 DOM 依赖，做成纯函数供各 effect 复用。
 */

import { weightForSize, type FontKind } from '../typography';

/** 可复现随机数生成器：相同 seed 产出相同序列。 */
export function mulberry32(seed: number): () => number {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** 把一行文字拆成单字数组，规整空白字符。 */
function lineChars(line: string): string[] {
  return line
    .replace(/\r/g, '')
    .replace(/[\t\f\v\u00a0]+/g, ' ')
    .split('');
}

/** 把整段文字按换行拆成多行，每行是单字数组（过滤纯空行）。 */
export function textLines(text: string): string[][] {
  const lines = text
    .split(/\n+/)
    .map(lineChars)
    .filter((line) => line.some((char) => char !== ' '));
  return lines.length ? lines : [['字']];
}

/** 把整段文字拍平成单字数组（用于不分行的模式）。 */
export function flatChars(text: string): string[] {
  return textLines(text).flat();
}

/** 取整段文字按换行拆成多段（强制分段），去空行。 */
export function paragraphs(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return raw.length ? raw : ['字'];
}

/**
 * 按最大宽度对一段文字自动换行（中文逐字断行，英文/数字尽量整体）。
 * @param measure 给定字符串返回像素宽度
 */
export function wrapByWidth(
  measure: (s: string) => number,
  paragraph: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of paragraph) {
    const tentative = current + char;
    if (current && measure(tentative) > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = tentative;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [paragraph];
}

/** 自适应排版结果：在可用区域内能放下全部文字的最大字号 + 换行。 */
export interface FittedText {
  /** 选定字号(px，已是最终绘制字号，不需再乘 scale) */
  size: number;
  /** 按该字号换行后的所有行 */
  lines: string[];
  /** 行高(px) = size * lineHeightRatio */
  lineHeight: number;
  /** 文本块总高度(px) */
  blockHeight: number;
}

/**
 * 在给定可用宽高内，自动求出能放下整段文字的最大字号（硬保证不溢出）。
 * 从 maxSize 往下递减，按每个候选字号做换行并算总高，直到宽和高都不超界。
 *
 * @param ctx            画布上下文（用于测量）
 * @param paragraphs     已分好的段落（每段会各自换行，段间不合并）
 * @param maxWidth       可用宽度(px)
 * @param maxHeight      可用高度(px)
 * @param family         字体族
 * @param kindWeight     给定字号返回字重的函数（配合「越大越细」）
 * @param opts           lineHeightRatio 行高系数、min/max 字号上下限、letterRatio 字间距相对字号比例
 */
export function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  paragraphsList: string[],
  maxWidth: number,
  maxHeight: number,
  family: string,
  kindWeight: (size: number) => number,
  opts: { lineHeightRatio: number; min: number; max: number; letterRatio?: number },
): FittedText {
  const { lineHeightRatio, min, max, letterRatio = 0 } = opts;

  const layoutAt = (size: number): { lines: string[]; blockHeight: number; fits: boolean } => {
    const weight = kindWeight(size);
    const ls = size * letterRatio;
    const measure = (s: string): number =>
      measureLine(ctx, s, { size, weight, family, color: '#000', letterSpacing: ls });
    // 任一单字宽度已超出可用宽 → 该字号宽度不达标
    const lines = paragraphsList.flatMap((p) => wrapByWidth(measure, p, maxWidth));
    const widest = lines.reduce((m, l) => Math.max(m, measure(l)), 0);
    const blockHeight = lines.length * size * lineHeightRatio;
    return { lines, blockHeight, fits: blockHeight <= maxHeight && widest <= maxWidth };
  };

  // 从大到小整数递减，取第一个能放下的字号
  for (let size = Math.floor(max); size >= min; size--) {
    const r = layoutAt(size);
    if (r.fits) {
      return { size, lines: r.lines, lineHeight: size * lineHeightRatio, blockHeight: r.blockHeight };
    }
  }
  // 到下限仍放不下：用下限字号兜底（极端长文案，至少不崩）
  const r = layoutAt(min);
  return { size: min, lines: r.lines, lineHeight: min * lineHeightRatio, blockHeight: r.blockHeight };
}

/** 渲染上下文：所有 effect 共享的画布与风格封装。 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** 字体族（CSS font-family） */
  fontFamily: string;
  /** 字体气质：serif / sans（决定「越大越细」字重曲线） */
  fontKind: FontKind;
  /** 文字颜色 */
  fontColor: string;
  /** 强调色（kicker / 发丝线 / 页码点缀） */
  accent: string;
  /** 字体粗细（CSS font-weight），缺省时各 effect 可按字号用 weightForSize 推导 */
  fontWeight: string;
  /** 整体缩放：预览为 1，导出高清时 >1，effect 内尺寸需乘它 */
  scale: number;
}

/** 在画布上绘制单个字符（带旋转、透明度、模糊）。颜色/字体取自 RenderContext。
 * weight 不传时按字号自动应用「越大越细」曲线。 */
export function drawChar(
  rc: RenderContext,
  char: string,
  x: number,
  y: number,
  size: number,
  angle = 0,
  alpha = 1,
  blur = 0,
  weight?: number,
): void {
  const { ctx } = rc;
  // size 已乘 scale；字重曲线按未缩放字号判断，故除回 scale
  const w = weight ?? weightForSize(size / Math.max(rc.scale, 0.0001), rc.fontKind);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : 'none';
  ctx.fillStyle = rc.fontColor;
  ctx.font = `${w} ${Math.max(4, size)}px ${rc.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 0);
  ctx.restore();
}

/** 文本绘制选项（用于标题/正文/kicker 等成行文字）。 */
export interface TextStyle {
  size: number;
  weight: number;
  family: string;
  color: string;
  /** 字间距(px)，默认 0 */
  letterSpacing?: number;
  /** 透明度，默认 1 */
  alpha?: number;
  /** 是否大写（拉丁/数字 kicker 用），默认 false */
  uppercase?: boolean;
}

/** 测量一行文字宽度（含字间距）。 */
export function measureLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
): number {
  const ls = style.letterSpacing ?? 0;
  ctx.save();
  ctx.font = `${style.weight} ${style.size}px ${style.family}`;
  const chars = [...(style.uppercase ? text.toUpperCase() : text)];
  const w = chars.reduce(
    (sum, ch, i) => sum + ctx.measureText(ch).width + (i < chars.length - 1 ? ls : 0),
    0,
  );
  ctx.restore();
  return w;
}

/**
 * 绘制一行文字，支持左/中/右对齐与字间距。返回该行实际宽度。
 * x 语义随 align：left=起点，center=中心，right=终点。基线 middle。
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const content = style.uppercase ? text.toUpperCase() : text;
  const ls = style.letterSpacing ?? 0;
  const total = measureLine(ctx, content, style);
  let startX = x;
  if (align === 'center') startX = x - total / 2;
  else if (align === 'right') startX = x - total;

  ctx.save();
  ctx.globalAlpha = style.alpha ?? 1;
  ctx.fillStyle = style.color;
  ctx.font = `${style.weight} ${style.size}px ${style.family}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let cx = startX;
  for (const ch of content) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + ls;
  }
  ctx.restore();
  return total;
}

/** 画一条发丝线（hairline）。 */
export function drawHairline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  thickness = 1,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y - thickness / 2, w, thickness);
  ctx.restore();
}
