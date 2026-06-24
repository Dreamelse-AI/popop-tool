/**
 * 表情包九宫格 prompt 构造器。
 *
 * 把用户写的提示词（含风格/文案）包装成「保持人物一致 + 3×3 九宫格 + 便于抠图的简洁背景」
 * 的完整出图指令。去背景由浏览器端 ML 分割完成（见 stickerMatting），不依赖特定背景色，
 * 故只要求「简洁、与主体对比分明的纯色背景」即可，不再加白描边/纯黑底。
 */

import type { MattingMode, StickerEmotion } from '@/types/sticker';

/**
 * 构造九宫格表情包 prompt。
 * @param userPrompt 用户写的提示词正文（风格/文案/表情描述）
 * @param emotions 九宫格各格的情绪（按行优先顺序）
 * @param matting 抠图模式（colorKey 时追加便于抠图的背景要求）
 */
export function buildStickerPrompt(
  userPrompt: string,
  emotions: StickerEmotion[],
  matting: MattingMode,
): string {
  const lines = [
    'Create a single square (1:1) image containing a 3x3 grid (9 cells) of expression stickers of the SAME character.',
    'Keep the character identity, outfit, and art style strictly consistent across all 9 cells, matching the provided reference image.',
    'Divide the canvas evenly into 3 rows and 3 columns of equal square cells, with clear separation and no overlap between cells.',
    'In every cell, place the character centered with generous margin / padding around it, so each cell can be safely center-cropped to a 1:1 square without cutting off the character.',
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
      'Use a clean, flat, uniform light solid-color background with clear contrast against the character, no gradients, no shadows, no extra decorations, so the subject can be cleanly cut out.',
    );
  }

  lines.push(`Sticker theme and style: ${userPrompt.trim()}`);

  return lines.join(' ');
}
