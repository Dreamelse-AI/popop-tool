import type { PaletteEntry } from '@/types/catalog';

/**
 * 配色库（catalog）。与图片库「二选一」作为背景。
 *
 * 填表说明：每套配色都应是「文字色 vs 背景色对比度达标」的安全组合。
 * - id：唯一标识，模型输出与渲染按此匹配，建议英文小写连字符
 * - name：中文展示名
 * - mood：气质关键词，会拼进 prompt 供模型按文案情绪选用
 * - bgColor：背景色，支持纯色（#16110d）或 CSS 渐变（linear-gradient(...)）
 * - fontColor：文字主色
 * - accent：可选强调色（暂未用于渲染，预留）
 *
 * 下面是占位样例，请按此格式替换/扩充为正式配色库。
 */
export const PALETTE_LIBRARY: PaletteEntry[] = [
  {
    id: 'ink-night',
    name: '墨夜',
    mood: '沉静、内省、夜晚',
    bgColor: '#0e1217',
    fontColor: '#e8eef5',
    accent: '#7fb0d6',
  },
  {
    id: 'warm-dusk',
    name: '暖暮',
    mood: '温暖、怀旧、黄昏',
    bgColor: '#16110d',
    fontColor: '#f4e6d6',
    accent: '#d98a5a',
  },
  {
    id: 'paper-light',
    name: '纸感浅',
    mood: '清新、文艺、日常',
    bgColor: '#f4f1ea',
    fontColor: '#2a2a2a',
    accent: '#9a7b53',
  },
];

export const DEFAULT_PALETTE_ID = PALETTE_LIBRARY[0].id;

export function getPalette(id: string): PaletteEntry {
  return PALETTE_LIBRARY.find((p) => p.id === id) ?? PALETTE_LIBRARY[0];
}
