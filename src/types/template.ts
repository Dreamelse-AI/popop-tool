import type { BlockRole } from './layout';
import type { CSSProperties } from 'react';

/**
 * 模板定义。决定 LayoutSchema 如何渲染到 3:4 画布。
 *
 * 模板做成纯数据驱动：等用户发来文字排版模板，
 * 把视觉规则填进 TemplateDefinition 即可扩展，不改渲染引擎。
 */

/** 每种语义角色对应的样式。值为画布内的样式（基于 1080*1440 设计稿尺寸）。 */
export type RoleStyleMap = Partial<Record<BlockRole, CSSProperties>>;

export interface TemplateDefinition {
  id: string;
  /** 展示名 */
  name: string;
  /** 一句话描述适用场景 */
  description: string;
  /** 画布背景样式（背景色、渐变、底纹等） */
  canvasStyle: CSSProperties;
  /** 内容区容器样式（内边距、对齐、间距等） */
  contentStyle: CSSProperties;
  /** 各语义角色的文字样式 */
  roleStyles: RoleStyleMap;
  /** 缩略图预览用的强调色，仅用于模板选择列表 */
  swatch: string;
}
