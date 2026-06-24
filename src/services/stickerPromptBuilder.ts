/**
 * 表情包九宫格 prompt 构造器。
 *
 * 完整 prompt 由三部分拼装：
 *   骨架字段（来自 promptTemplateStore，可逐字段改/恢复默认）
 *   + 情绪段（来自 emotionStore，按九宫格顺序逐格注入）
 *   + 主题/风格段（用户主输入框）。
 *
 * 去背景由浏览器端 ML 分割完成（见 stickerMatting），不依赖特定背景色。
 */

import type { MattingMode, StickerEmotion } from '@/types/sticker';
import {
  DEFAULT_FIELDS,
  FIELD_ORDER,
  type PromptFieldKey,
} from '@/features/sticker/promptTemplateStore';

/** 把情绪列表拼成一句逐格说明。 */
function emotionLine(emotions: StickerEmotion[]): string {
  if (emotions.length === 0) {
    return 'Each cell shows the character with a different facial expression / emotion / pose.';
  }
  const list = emotions.map((e, i) => `cell ${i + 1}: ${e.en}`).join('; ');
  return `Each cell shows the character with a distinct expression, in reading order (left to right, top to bottom): ${list}.`;
}

/**
 * 构造九宫格表情包 prompt。
 * @param userPrompt 用户写的主题/风格段
 * @param emotions 九宫格各格的情绪（按行优先顺序）
 * @param matting 抠图模式（colorKey 时才注入 background 字段）
 * @param fields 骨架字段（缺省用默认值，便于纯函数测试/预览）
 */
export function buildStickerPrompt(
  userPrompt: string,
  emotions: StickerEmotion[],
  matting: MattingMode,
  fields: Record<PromptFieldKey, string> = DEFAULT_FIELDS,
): string {
  const lines: string[] = [];

  for (const key of FIELD_ORDER) {
    // background 字段仅在抠图模式下注入
    if (key === 'background' && matting !== 'colorKey') continue;
    const text = (fields[key] ?? DEFAULT_FIELDS[key]).trim();
    if (!text) continue;
    if (key === 'crop') {
      // crop 之后紧跟情绪说明，语义更连贯
      lines.push(text);
      lines.push(emotionLine(emotions));
    } else {
      lines.push(text);
    }
  }

  lines.push(`Sticker theme and style: ${userPrompt.trim()}`);
  return lines.join(' ');
}
