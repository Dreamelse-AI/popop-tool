import type { ImageEntry } from '@/types/catalog';

/**
 * 图片库（catalog）。与配色库「二选一」作为背景。
 * 图片来自工具站的氛围图工具产出。
 *
 * 填表说明：
 * - id：唯一标识，模型输出与渲染按此匹配
 * - name：中文展示名
 * - mood：气质关键词，拼进 prompt 供模型按文案情绪选用
 * - url：背景图地址（可为站内路径或完整 URL）
 * - fontColor：压在此图上推荐的文字色（须保证可读）
 * - overlay：可选，图上叠加的遮罩色（半透明，进一步保证文字可读），
 *            如 'rgba(0,0,0,0.35)'；不填则不加遮罩
 *
 * 下面是占位样例（url 为示意，需替换为真实图）。先留空亦可，
 * 留空时背景选择会回退到配色库。
 */
export const IMAGE_LIBRARY: ImageEntry[] = [
  // {
  //   id: 'misty-mountain',
  //   name: '雾山',
  //   mood: '空灵、悠远、自然',
  //   url: '/bg/misty-mountain.jpg',
  //   fontColor: '#ffffff',
  //   overlay: 'rgba(0,0,0,0.35)',
  // },
];

export function getImage(id: string): ImageEntry | undefined {
  return IMAGE_LIBRARY.find((i) => i.id === id);
}
