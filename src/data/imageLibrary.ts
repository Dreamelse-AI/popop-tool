import type { ImageEntry } from '@/types/catalog';

/**
 * 图片库（catalog）。与配色库「二选一」作为背景。
 *
 * 数据来源：本工具站「视觉资产生产引擎」的产出图，通过 tags 关联检索
 * （情绪 / 主题等标签与引擎产出对齐）。
 *
 * 字段说明：
 * - id：唯一标识，模型输出与渲染按此匹配
 * - name：中文展示名
 * - mood：气质关键词，拼进 prompt 供模型按文案情绪选用
 * - tags：关联标签，用于和视觉资产引擎产出对齐检索
 * - url：背景图地址（引擎产出，永久 URL）
 * - fontColor：可选。不填则运行时按图片明暗自动判黑/白（见 detectFontColor）
 * - overlay：可选，图上叠加遮罩色（半透明），进一步保证文字可读
 *
 * 现状：视觉资产引擎产出图尚未落库（图库接口与后端确认中，见 docs/moodpic-storage-plan.md），
 * 暂为空数组。留空时背景选择回退到配色库。引擎落库后按上述结构填充即可。
 */
export const IMAGE_LIBRARY: ImageEntry[] = [
  // {
  //   id: 'misty-mountain',
  //   name: '雾山',
  //   mood: '空灵、悠远、自然',
  //   tags: ['自然', '远方', '沉静'],
  //   url: 'https://.../moodpic/xxx.webp',
  //   // fontColor 省略 → 运行时按图片明暗自动判黑/白
  //   overlay: 'rgba(0,0,0,0.30)',
  // },
];

export function getImage(id: string): ImageEntry | undefined {
  return IMAGE_LIBRARY.find((i) => i.id === id);
}

/** 按标签检索图片（任一标签命中即返回），供视觉资产引擎关联使用。 */
export function getImagesByTag(tag: string): ImageEntry[] {
  return IMAGE_LIBRARY.filter((i) => i.tags.includes(tag));
}
