/**
 * IP 延展 prompt 构造器。
 *
 * 设计：图生图模式下，prompt 走本地结构化拼接（不调 LLM 扩写），保证输出紧贴参考角色、
 * 可控、不偏离 IP 形象（与 sticker 同思路）。
 *
 * 完整 prompt = 角色一致性约束（强调照参考图保持同一角色）
 *             + 动作 + 情绪 + 插画类型片段
 *             + 用户自由场景描述。
 *
 * 不描述构图/比例/镜头（由 imageClient 的 appendOutputSpecToPrompt 统一追加输出约束）。
 */

import type { IpExtendConfig } from '@/types/ipExtend';
import {
  ACTION_OPTIONS,
  EMOTION_OPTIONS,
  ILLUSTRATION_OPTIONS,
  findIpOption,
} from '@/data/ipExtendCatalog';

/** 角色一致性前缀：要求严格沿用参考图里的同一角色形象。 */
const CONSISTENCY_PREFIX =
  'Keep the exact same character as in the reference images: same face, same body proportions, ' +
  'same outfit, same color palette and same art style. This is the same IP mascot in a new pose / scene.';

/**
 * 把一条延展配置拼成完整 image prompt。
 * @param config 单条延展配置（已解析为确定 option id + 场景文本）
 * @param ipName IP 名称（可选，写入 prompt 增强语义）
 */
export function buildIpExtendPrompt(config: IpExtendConfig, ipName?: string): string {
  const parts: string[] = [CONSISTENCY_PREFIX];

  const name = ipName?.trim();
  if (name) parts.push(`The character is named "${name}".`);

  const illustration = findIpOption(ILLUSTRATION_OPTIONS, config.illustration);
  if (illustration) {
    parts.push(`Render as ${illustration.promptFragment ?? illustration.name}.`);
  }

  const action = findIpOption(ACTION_OPTIONS, config.action);
  if (action) {
    parts.push(`The character is ${action.promptFragment ?? action.name}.`);
  }

  const emotion = findIpOption(EMOTION_OPTIONS, config.emotion);
  if (emotion) {
    parts.push(`Facial expression: ${emotion.promptFragment ?? emotion.name}.`);
  }

  const scene = config.scene.trim();
  if (scene) {
    parts.push(`Scene / context: ${scene}.`);
  }

  return parts.join(' ');
}

/** 生成一条结果项展示用的简短中文标签（动作 · 情绪 · 类型）。 */
export function describeIpConfig(config: IpExtendConfig): string {
  const labels = [
    findIpOption(ACTION_OPTIONS, config.action)?.label,
    findIpOption(EMOTION_OPTIONS, config.emotion)?.label,
    findIpOption(ILLUSTRATION_OPTIONS, config.illustration)?.label,
  ].filter(Boolean);
  return labels.join(' · ') || 'IP 延展';
}
