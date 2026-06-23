/**
 * 表情包九宫格 prompt 构造器。
 *
 * 把用户写的提示词（含风格/文案）包装成「保持人物一致 + 3×3 九宫格 + 纯色背景」的
 * 完整出图指令。纯色背景是为了后续色键抠图（见 stickerMatting）。
 */

import type { ColorKeyOptions, MattingMode, StickerEmotion } from '@/types/sticker';

/** rgb 转便于 prompt 描述的英文颜色短语。 */
function describeBg(color: { r: number; g: number; b: number }): string {
  const { r, g, b } = color;
  if (g > 200 && r < 80 && b < 80) return 'pure chroma-key green (#00FF00)';
  if (r > 200 && g < 80 && b < 80) return 'pure red';
  if (b > 200 && r < 80 && g < 80) return 'pure blue';
  if (r > 230 && g > 230 && b > 230) return 'pure white';
  return `solid background color rgb(${r}, ${g}, ${b})`;
}

/**
 * 构造九宫格表情包 prompt。
 * @param userPrompt 用户写的提示词正文（风格/文案/表情描述）
 * @param emotions 九宫格各格的情绪（按行优先顺序）
 * @param matting 抠图模式（colorKey 时追加纯色背景要求）
 * @param colorKey 色键参数（决定背景色描述）
 */
export function buildStickerPrompt(
  userPrompt: string,
  emotions: StickerEmotion[],
  matting: MattingMode,
  colorKey: ColorKeyOptions,
): string {
  const lines = [
    'Create a single image containing a 3x3 grid (9 cells) of expression stickers of the SAME character.',
    'Keep the character identity, outfit, and art style strictly consistent across all 9 cells, matching the provided reference image.',
    'Arrange the cells neatly in 3 rows and 3 columns with equal cell sizes and clear separation, no overlap between cells.',
  ];

  if (emotions.length > 0) {
    const list = emotions
      .map((e, i) => `cell ${i + 1}: ${e.en}`)
      .join('; ');
    lines.push(
      `Each cell shows the character with a distinct expression, in reading order (left to right, top to bottom): ${list}.`,
    );
  } else {
    lines.push('Each cell shows the character with a different facial expression / emotion / pose.');
  }

  if (matting === 'colorKey') {
    lines.push(
      `Use a flat ${describeBg(colorKey.bgColor)} background filling every cell uniformly, no gradients, no shadows on the background, so the background can be removed by chroma keying.`,
    );
  }

  lines.push(`Sticker theme and style: ${userPrompt.trim()}`);

  return lines.join(' ');
}
