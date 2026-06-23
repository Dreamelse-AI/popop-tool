import type { EffectParams } from '@/types/layout';
import { clamp, mulberry32, randomBetween, type RenderContext } from './shared';
import { weightForSize } from '../typography';

/** 取整段文字按换行拆成多段（强制分段），去空行。 */
function paragraphs(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return raw.length ? raw : ['字'];
}

/**
 * 按最大宽度对一段文字自动换行（中文逐字断行，英文按词尽量不拆）。
 * 返回换行后的多行字符串。
 */
function wrapParagraph(
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

/** 创建离屏画布。 */
function offscreen(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建离屏画布上下文');
  return { canvas, ctx };
}

/**
 * 泪水模糊：设定字号后文字自动换行居中排版，
 * 再叠加若干径向渐变圆做遮罩，圆内模糊、圆外清晰，像泪水晕开局部。
 */
export function drawTearBlur(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);

  const blurMax = Math.max(1, params.blur * scale);
  const spread = params.spread / 100;
  const pad = params.padding * scale;
  const letterSpacing = params.tearLetterSpacing * scale;
  const blurRadius = params.tearBlurRadius * scale;
  const maxWidth = width - pad * 2;
  const maxHeight = height - pad * 2;
  const lineRatio = params.tearLineSpacing / 100;

  // 在给定字号下测量一行宽度
  const measureAt = (s: string, size: number): number => {
    const weight = weightForSize(size / Math.max(scale, 0.0001), rc.fontKind);
    ctx.save();
    ctx.font = `${weight} ${size}px ${rc.fontFamily}`;
    const chars = [...s];
    const w = chars.reduce(
      (sum, char, index) =>
        sum + ctx.measureText(char).width + (index < chars.length - 1 ? letterSpacing : 0),
      0,
    );
    ctx.restore();
    return w;
  };

  // 字号自适应：从参数字号往下递减，按该字号换行测高，
  // 直到全部行的总高 + 最宽行都落在安全区内，硬保证不溢出
  const startSize = clamp(params.minSize, 12, 200) * scale;
  const minSize = 18 * scale;
  let fontSize = startSize;
  let lines: string[] = [];
  for (let s = Math.floor(startSize); s >= minSize; s--) {
    const cand = paragraphs(text).flatMap((p) =>
      wrapParagraph((str) => measureAt(str, s), p, maxWidth),
    );
    const blockH = (cand.length - 1) * s * lineRatio + s;
    const widest = cand.reduce((m, l) => Math.max(m, measureAt(l, s)), 0);
    if (blockH <= maxHeight && widest <= maxWidth) {
      fontSize = s;
      lines = cand;
      break;
    }
    fontSize = s;
    lines = cand;
  }

  const lineGap = fontSize * lineRatio;
  const weight = weightForSize(fontSize / Math.max(scale, 0.0001), rc.fontKind);
  const font = `${weight} ${fontSize}px ${rc.fontFamily}`;
  const measure = (s: string): number => measureAt(s, fontSize);

  const startY = height / 2 - ((lines.length - 1) * lineGap) / 2;

  // 基础清晰文字层
  const base = offscreen(width, height);
  const bctx = base.ctx;
  const textBounds: Array<{ x: number; y: number; w: number; h: number }> = [];

  const drawSpacedLine = (line: string, startX: number, y: number, alpha = 0.92): void => {
    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.fillStyle = rc.fontColor;
    bctx.font = font;
    bctx.textAlign = 'left';
    bctx.textBaseline = 'middle';
    let x = startX;
    [...line].forEach((char) => {
      bctx.fillText(char, x, y);
      x += bctx.measureText(char).width + letterSpacing;
    });
    bctx.restore();
  };

  lines.forEach((line, lineIndex) => {
    const y = startY + lineIndex * lineGap;
    const measured = measure(line);
    const x0 = width / 2 - measured / 2;
    drawSpacedLine(line, x0, y);
    textBounds.push({ x: x0, y: y - fontSize * 0.6, w: measured, h: fontSize * 1.2 });
  });

  // 文字外接矩形并集，模糊圆只落在文字范围内
  const union = textBounds.reduce(
    (box, b) => ({
      x: Math.min(box.x, b.x),
      y: Math.min(box.y, b.y),
      r: Math.max(box.r, b.x + b.w),
      b: Math.max(box.b, b.y + b.h),
    }),
    { x: width, y: height, r: 0, b: 0 },
  );

  // 遮罩层：若干径向渐变圆
  const circles = Math.max(2, Math.round(2 + spread * 7));
  const mask = offscreen(width, height);
  const mctx = mask.ctx;
  for (let i = 0; i < circles; i++) {
    const cx = randomBetween(rng, union.x, union.r);
    const cy = randomBetween(rng, union.y, union.b);
    const radius = blurRadius * randomBetween(rng, 0.55, 1.25);
    const gradient = mctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.52, 'rgba(0,0,0,0.96)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = gradient;
    mctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // 清晰层：挖掉遮罩区域
  const sharp = offscreen(width, height);
  sharp.ctx.drawImage(base.canvas, 0, 0);
  sharp.ctx.globalCompositeOperation = 'destination-out';
  sharp.ctx.drawImage(mask.canvas, 0, 0);

  // 模糊层：整体模糊后只保留遮罩区域
  const blurLayer = offscreen(width, height);
  blurLayer.ctx.filter = `blur(${blurMax.toFixed(2)}px)`;
  blurLayer.ctx.drawImage(base.canvas, 0, 0);
  blurLayer.ctx.filter = 'none';
  blurLayer.ctx.globalCompositeOperation = 'destination-in';
  blurLayer.ctx.drawImage(mask.canvas, 0, 0);

  ctx.drawImage(sharp.canvas, 0, 0);
  ctx.drawImage(blurLayer.canvas, 0, 0);
}
