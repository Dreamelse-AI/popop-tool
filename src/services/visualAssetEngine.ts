/**
 * Visual Asset 生成引擎：把三态选择展开成 N 条结构化配置。
 *
 * 三态规则（每个维度）：
 *   []        → 全域随机
 *   ['x']     → 锁定
 *   ['x','y'] → 在选中里随机
 *
 * 流程（每条配置独立）：
 *   1. 先定 type（决定 DNA schema）
 *   2. 按该 schema 逐字段随机/锁定；可选字段未选则不加入
 *   3. emotion 同理；subject 固定 None；style 用全局
 *   4. 去重（规则 6）：可能组合不足 N 时自然降级，尽力产出不重复的若干条
 */

import type {
  VisualAssetSelection,
  AssetConfig,
  AssetType,
  DnaField,
} from '@/types/visualAsset';
import {
  EMOTION_OPTIONS,
  SUBJECT_OPTIONS,
  NO_STYLE_ID,
  DNA_SCHEMAS,
  ENABLED_TYPES,
} from '@/data/visualAssetCatalog';

/** 从数组随机取一个。 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 解析单个维度的三态选择为一个确定值的 id。
 * @param selected 用户选中的 id 数组（三态）
 * @param allIds 该维度全部可选 id（用于全域随机）
 * @returns 选中的单个 id；若无可选项返回 null
 */
function resolveOne(selected: string[], allIds: string[]): string | null {
  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return pick(selected);
  if (allIds.length > 0) return pick(allIds);
  return null;
}

/** 生成单条配置。styleIds 为当前可用的自定义 style id 列表（可空）。 */
function buildOneConfig(
  selection: VisualAssetSelection,
  styleIds: string[],
): AssetConfig | null {
  // 1. type：用户选中的优先，否则在已启用 type 里随机
  const typePool = selection.type.length > 0 ? selection.type : ENABLED_TYPES;
  const type = resolveOne(selection.type, typePool) as AssetType | null;
  if (!type) return null;

  // 2. emotion
  const emotionIds = EMOTION_OPTIONS.map((o) => o.id);
  const emotion = resolveOne(selection.emotion, emotionIds);
  if (!emotion) return null;

  // 3. subject（三态；不选→含 None 的全域随机）
  const subjectIds = SUBJECT_OPTIONS.map((o) => o.id);
  const subject = resolveOne(selection.subject, subjectIds) ?? 'none';

  // 4. style（三态；不选→全部已存 style pack 随机；一个都没存→无风格占位）
  const style = resolveOne(selection.style, styleIds) ?? NO_STYLE_ID;

  // 5. DNA：按该 type 的 schema 逐字段
  const schema = DNA_SCHEMAS[type];
  const dna: Record<string, string> = {};
  for (const field of schema.fields) {
    const sel = selection.dna[field.key] ?? [];
    if (isOptionalAndUnselected(field, sel)) continue; // 可选字段未选 → 跳过
    const fieldIds = field.options.map((o) => o.id);
    const value = resolveOne(sel, fieldIds);
    if (value) dna[field.key] = value;
  }

  return { emotion, subject, type, style, dna };
}

/** 可选字段且用户未选 → 不加入（符合规则 8 "sparingly"）。 */
function isOptionalAndUnselected(field: DnaField, selected: string[]): boolean {
  return Boolean(field.optional) && selected.length === 0;
}

/** 稳定序列化一条配置用于去重。 */
function configKey(c: AssetConfig): string {
  const dnaKeys = Object.keys(c.dna)
    .sort()
    .map((k) => `${k}=${c.dna[k]}`)
    .join('&');
  return `${c.type}|${c.emotion}|${c.subject}|${c.style}|${dnaKeys}`;
}

/**
 * 生成 N 条不重复的结构化配置。
 * @param selection 三态选择
 * @param count 目标条数
 * @param styleIds 当前可用的自定义 style id 列表（来自 customStyleStore）
 * 若约束空间小于 N，尽力产出（达到上限的尝试次数后返回已有的）。
 */
export function generateConfigs(
  selection: VisualAssetSelection,
  count: number,
  styleIds: string[] = [],
): AssetConfig[] {
  const out: AssetConfig[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 20; // 防止约束极小时死循环
  let attempts = 0;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const cfg = buildOneConfig(selection, styleIds);
    if (!cfg) break;
    const key = configKey(cfg);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cfg);
  }

  return out;
}
