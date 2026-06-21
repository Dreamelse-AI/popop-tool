import type { EffectParams } from '@/types/layout';
import { clamp, mulberry32, randomBetween, type RenderContext } from './shared';

/** 取整段文字按换行拆成多行字符串（保留原顺序，去空行）。 */
function sourceLines(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (raw.length) return raw;
  const t = text.replace(/\s+/g, '').trim();
  return t ? [t] : ['字'];
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
 * 泪水模糊：文字正常居中排版，再叠加若干径向渐变圆做遮罩，
 * 圆内模糊、圆外清晰，像泪水晕开局部。
 */
export function drawTearBlur(rc: RenderContext, text: string, params: EffectParams): void {
  const { ctx, width, height, scale } = rc;
  const rng = mulberry32(params.seed);
  const lines = sourceLines(text);

  const minSize = Math.min(params.minSize, params.maxSize) * scale;
  const maxSize = Math.max(params.minSize, params.maxSize) * scale;
  const blurMax = Math.max(1, params.blur * scale);
  const spread = params.spread / 100;
  const pad = params.padding * scale;
  const baseSize = clamp((minSize + maxSize) * 0.55, 18 * scale, 160 * scale);
  const letterSpacing = params.tearLetterSpacing * scale;
  const lineGap = baseSize * (params.tearLineSpacing / 100);
  const startY = height / 2 - ((lines.length - 1) * lineGap) / 2;
  const blurRadius = params.tearBlurRadius * scale;
  const font = `${rc.fontWeight} ${baseSize}px ${params.fontFamily}`;

  // 基础清晰文字层
  const base = offscreen(width, height);
  const bctx = base.ctx;
  const textBounds: Array<{ x: number; y: number; w: number; h: number }> = [];

  const measureLine = (line: string): number => {
    ctx.save();
    ctx.font = font;
    const chars = [...line];
    const w = chars.reduce(
      (sum, char, index) =>
        sum + ctx.measureText(char).width + (index < chars.length - 1 ? letterSpacing : 0),
      0,
    );
    ctx.restore();
    return w;
  };

  const drawSpacedLine = (
    targetCtx: CanvasRenderingContext2D,
    line: string,
    startX: number,
    y: number,
    alpha = 1,
  ): void => {
    targetCtx.save();
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = params.fontColor;
    targetCtx.font = font;
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'middle';
    let x = startX;
    [...line].forEach((char) => {
      targetCtx.fillText(char, x, y);
      x += targetCtx.measureText(char).width + letterSpacing;
    });
    targetCtx.restore();
  };

  lines.forEach((line, lineIndex) => {
    const y = startY + lineIndex * lineGap;
    const measured = measureLine(line);
    const maxWidth = width - pad * 2;
    const lineScale = measured > maxWidth ? maxWidth / measured : 1;
    const x0 = width / 2 - (measured * lineScale) / 2;
    bctx.save();
    bctx.translate(x0, y);
    bctx.scale(lineScale, lineScale);
    drawSpacedLine(bctx, line, 0, 0, 0.92);
    bctx.restore();
    textBounds.push({
      x: x0,
      y: y - baseSize * lineScale * 0.6,
      w: measured * lineScale,
      h: baseSize * lineScale * 1.2,
    });
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
