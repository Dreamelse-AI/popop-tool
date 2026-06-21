/**
 * 特效渲染共享工具：随机数、数值处理、文本拆分。
 * 移植自参考实现，去掉 DOM 依赖，做成纯函数供各 effect 复用。
 */

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

/** 渲染上下文：所有 effect 共享的画布与参数封装。 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** 字体粗细（CSS font-weight） */
  fontWeight: string;
  /** 整体缩放：预览为 1，导出高清时 >1，effect 内尺寸需乘它 */
  scale: number;
}

/** 在画布上绘制单个字符（带旋转、透明度、模糊）。 */
export function drawChar(
  rc: RenderContext,
  char: string,
  x: number,
  y: number,
  size: number,
  fontFamily: string,
  fontColor: string,
  angle = 0,
  alpha = 1,
  blur = 0,
): void {
  const { ctx } = rc;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : 'none';
  ctx.fillStyle = fontColor;
  ctx.font = `${rc.fontWeight} ${Math.max(4, size)}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, 0, 0);
  ctx.restore();
}
