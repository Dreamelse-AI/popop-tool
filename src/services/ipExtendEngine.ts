/**
 * IP 延展引擎：把场景三态选择 + 数量 → 随机展开成 N 条确定的延展配置。
 *
 * 三态语义（与 visualAsset 一致）：
 *   []        → 该维度全随机
 *   ['x']     → 锁定为 x
 *   ['x','y'] → 在选中里随机
 *
 * 尽量去重：同一组合（action+emotion+illustration）不重复产出；
 * 当可组合空间小于请求数量时，允许重复以凑满 count（出图仍有参考图随机性）。
 */

import type { IpExtendConfig, IpExtendSelection } from '@/types/ipExtend';
import {
  ACTION_OPTIONS,
  EMOTION_OPTIONS,
  ILLUSTRATION_OPTIONS,
} from '@/data/ipExtendCatalog';

/** 从候选池里取一个：空选择=全域随机，否则在选中里随机。 */
function pickOne(selected: string[], pool: string[]): string {
  const domain = selected.length > 0 ? selected : pool;
  if (domain.length === 0) return '';
  return domain[Math.floor(Math.random() * domain.length)];
}

/**
 * 展开成 count 条延展配置。
 * @param selection 场景三态选择
 * @param count 目标数量
 * @param scene 用户自由场景文本（所有条目共享）
 */
export function generateIpConfigs(
  selection: IpExtendSelection,
  count: number,
  scene: string,
): IpExtendConfig[] {
  const actionPool = ACTION_OPTIONS.map((o) => o.id);
  const emotionPool = EMOTION_OPTIONS.map((o) => o.id);
  const illustrationPool = ILLUSTRATION_OPTIONS.map((o) => o.id);

  const out: IpExtendConfig[] = [];
  const seen = new Set<string>();
  const trimmedScene = scene.trim();

  // 限制尝试次数，避免组合空间过小时死循环
  const maxAttempts = count * 12;
  let attempts = 0;

  while (out.length < count && attempts < maxAttempts) {
    attempts++;
    const config: IpExtendConfig = {
      action: pickOne(selection.action, actionPool),
      emotion: pickOne(selection.emotion, emotionPool),
      illustration: pickOne(selection.illustration, illustrationPool),
      scene: trimmedScene,
    };
    const key = `${config.action}|${config.emotion}|${config.illustration}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(config);
  }

  // 组合空间不足以去重凑满时，允许重复补齐
  while (out.length < count) {
    out.push({
      action: pickOne(selection.action, actionPool),
      emotion: pickOne(selection.emotion, emotionPool),
      illustration: pickOne(selection.illustration, illustrationPool),
      scene: trimmedScene,
    });
  }

  return out;
}
