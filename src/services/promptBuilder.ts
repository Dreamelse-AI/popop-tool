/**
 * Prompt 拼装：把五层选择 + 品牌底座 + 自定义词拼成最终图像生成 prompt。
 *
 * 拼装顺序（与设计文档一致）：
 *   品牌底座 → Motion → Medium → Light → Color → Mood → 自定义补充
 */

import type { BackgroundSelection } from '@/types/background';
import { BRAND_BASE, LAYER_OPTION_MAP } from '@/data/backgroundOptions';

/** 在某一层里按 id 找 promptFragment，找不到返回空串（不应发生，做防御）。 */
function fragmentOf<T extends keyof typeof LAYER_OPTION_MAP>(
  layer: T,
  id: string,
): string {
  const opt = LAYER_OPTION_MAP[layer].find((o) => o.id === id);
  return opt?.promptFragment ?? '';
}

/**
 * 根据五层选择构建最终 prompt。
 * @param selection 五层各选一个
 * @param extraKeywords 用户追加的自定义关键词（可选）
 */
export function buildPrompt(selection: BackgroundSelection, extraKeywords?: string): string {
  const parts = [
    BRAND_BASE,
    fragmentOf('motion', selection.motion),
    fragmentOf('medium', selection.medium),
    fragmentOf('light', selection.light),
    fragmentOf('color', selection.color),
    fragmentOf('mood', selection.mood),
  ];

  const extra = extraKeywords?.trim();
  if (extra) {
    parts.push(extra);
  }

  return parts.filter(Boolean).join(', ');
}
