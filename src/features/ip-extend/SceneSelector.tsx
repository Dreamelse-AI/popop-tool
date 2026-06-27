/**
 * 场景选择器：动作 / 情绪 / 插画类型三态多选（复用 ChipGroup）+ 自由场景文本。
 */

import { ChipGroup } from '@/features/visual-asset/ChipGroup';
import { IP_DIMENSIONS } from '@/data/ipExtendCatalog';
import type { IpExtendSelection } from '@/types/ipExtend';

interface SceneSelectorProps {
  selection: IpExtendSelection;
  scene: string;
  onToggle: (dimension: keyof IpExtendSelection, id: string) => void;
  onClear: (dimension: keyof IpExtendSelection) => void;
  onSceneChange: (scene: string) => void;
}

export function SceneSelector({
  selection,
  scene,
  onToggle,
  onClear,
  onSceneChange,
}: SceneSelectorProps) {
  return (
    <div className="flex flex-col gap-5">
      {IP_DIMENSIONS.map((dim) => (
        <ChipGroup
          key={dim.key}
          title={dim.title}
          options={dim.options}
          selected={selection[dim.key]}
          onToggle={(id) => onToggle(dim.key, id)}
          onClear={() => onClear(dim.key)}
        />
      ))}

      <div>
        <div className="pop-label mb-1.5">
          场景描述
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">
            自由补充，如「在咖啡店看书」「下雨天撑伞」（可留空）
          </span>
        </div>
        <textarea
          value={scene}
          onChange={(e) => onSceneChange(e.target.value)}
          rows={2}
          placeholder="描述你想要的场景 / 环境 / 氛围…"
          className="pop-textarea w-full"
        />
      </div>
    </div>
  );
}
