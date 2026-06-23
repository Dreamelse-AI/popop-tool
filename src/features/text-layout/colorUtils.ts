/**
 * 颜色与背景工具：
 *  - 解析配色库 bgColor（纯色 / '#A → #B' 渐变）
 *  - 在 canvas 上铺纯色或线性渐变背景
 *  - 按图片明暗自动判定黑 / 白文字色
 */

/** 渐变分隔符：配色库统一用 ' → '（兼容 '->'、'~' 容错）。 */
const GRADIENT_SEP = /\s*(?:→|->|~)\s*/;

export interface ParsedBackground {
  kind: 'solid' | 'gradient';
  /** solid 时为单色；gradient 时为 [起色, 止色] */
  colors: string[];
}

/** 解析 bgColor 字符串为纯色或两段渐变。 */
export function parseBackground(bgColor: string): ParsedBackground {
  const parts = bgColor.split(GRADIENT_SEP).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { kind: 'gradient', colors: [parts[0], parts[1]] };
  }
  return { kind: 'solid', colors: [parts[0] ?? '#000000'] };
}

/** 转成 CSS background 值（纯色或 135° 线性渐变），供 DOM 预览用。 */
export function toCssBackground(bgColor: string): string {
  const bg = parseBackground(bgColor);
  if (bg.kind === 'gradient') {
    return `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]})`;
  }
  return bg.colors[0];
}

/** 在 canvas 上铺背景：纯色直接填，渐变按对角线（左上→右下）线性渐变填。 */
export function fillCanvasBackground(
  ctx: CanvasRenderingContext2D,
  bgColor: string,
  width: number,
  height: number,
): void {
  const bg = parseBackground(bgColor);
  if (bg.kind === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, bg.colors[0]);
    grad.addColorStop(1, bg.colors[1]);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bg.colors[0];
  }
  ctx.fillRect(0, 0, width, height);
}

/** #rgb / #rrggbb → {r,g,b}；解析失败返回 null。 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** 相对亮度（sRGB 感知加权，0-255）。 */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 亮度阈值：高于此值判为「亮底」，用黑字；否则白字。 */
const LIGHT_THRESHOLD = 150;

/** 由单个 hex 颜色判文字色（黑/白）。 */
export function fontColorForHex(hex: string): '#111111' | '#FFFFFF' {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  return luminance(rgb.r, rgb.g, rgb.b) > LIGHT_THRESHOLD ? '#111111' : '#FFFFFF';
}

/**
 * 由已加载图片采样平均亮度，自动判定文字色（黑 / 白）。
 * 缩到小图采样以降开销；跨域或采样失败时回退白字。
 */
export function detectFontColor(img: HTMLImageElement): '#111111' | '#FFFFFF' {
  const SAMPLE = 32;
  try {
    const c = document.createElement('canvas');
    c.width = SAMPLE;
    c.height = SAMPLE;
    const ctx = c.getContext('2d');
    if (!ctx) return '#FFFFFF';
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 16) continue;
      total += luminance(data[i], data[i + 1], data[i + 2]);
      count++;
    }
    if (count === 0) return '#FFFFFF';
    return total / count > LIGHT_THRESHOLD ? '#111111' : '#FFFFFF';
  } catch (e) {
    console.warn('detectFontColor.failed', e);
    return '#FFFFFF';
  }
}
