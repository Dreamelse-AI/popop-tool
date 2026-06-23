import type { PaletteEntry } from '@/types/catalog';

/**
 * 配色库（catalog）。与图片库「二选一」作为背景。来源：情绪配色库（已审对比度）。
 *
 * - id：唯一标识，模型输出与渲染按此匹配
 * - category：大类，仅 UI 分组用
 * - mood：情绪词，拼进 prompt 供模型按文案情绪选用
 * - bgColor：纯色 '#FAFAF9' 或两段渐变 '#A → #B'（渲染时由 toCssBackground 转 CSS 线性渐变）
 * - fontColor：文字主色（与 bgColor 对比度达标）
 * - accent：强调色（暂未用于渲染，预留）
 */
export const PALETTE_LIBRARY: PaletteEntry[] = [
  // 深夜 / 孤独系
  { id: 'ink-night', category: '深夜 / 孤独系', name: '墨夜', mood: '孤独、哲思、深夜', bgColor: '#0F172A → #1E293B', fontColor: '#F8FAFC', accent: '#60A5FA' },
  { id: 'moonlight', category: '深夜 / 孤独系', name: '月光', mood: '思念、安静', bgColor: '#1E1B4B → #312E81', fontColor: '#F9FAFB', accent: '#C4B5FD' },
  { id: 'starfield', category: '深夜 / 孤独系', name: '星野', mood: '浪漫、宇宙感', bgColor: '#020617 → #0F172A', fontColor: '#FFFFFF', accent: '#A78BFA' },
  { id: 'rainy-night', category: '深夜 / 孤独系', name: '雨夜', mood: '遗憾、怀念', bgColor: '#111827 → #374151', fontColor: '#F3F4F6', accent: '#93C5FD' },

  // 温暖治愈系
  { id: 'warm-dusk', category: '温暖治愈系', name: '暖暮', mood: '温暖、陪伴', bgColor: '#FB923C → #F59E0B', fontColor: '#FFFFFF', accent: '#FDE68A' },
  { id: 'sunset-glow', category: '温暖治愈系', name: '落日余晖', mood: '回忆、怀旧', bgColor: '#F97316 → #EC4899', fontColor: '#FFFFFF', accent: '#FCD34D' },
  { id: 'soft-cocoa', category: '温暖治愈系', name: '可可暖棕', mood: '安全感、舒适', bgColor: '#7C5C4B → #A47551', fontColor: '#FFF8F0', accent: '#FFD6A5' },
  { id: 'candlelight', category: '温暖治愈系', name: '烛光', mood: '温柔、细腻', bgColor: '#F59E0B → #FB923C', fontColor: '#FFFFFF', accent: '#FEF3C7' },

  // 清新日常系
  { id: 'paper-light', category: '清新日常系', name: '纸感浅', mood: '文艺、日常', bgColor: '#FAFAF9', fontColor: '#18181B', accent: '#A8A29E' },
  { id: 'mint-air', category: '清新日常系', name: '薄荷空气', mood: '清爽、放松', bgColor: '#D1FAE5 → #A7F3D0', fontColor: '#064E3B', accent: '#34D399' },
  { id: 'morning-dew', category: '清新日常系', name: '晨露', mood: '希望、新开始', bgColor: '#E0F2FE → #F0F9FF', fontColor: '#0F172A', accent: '#38BDF8' },
  { id: 'tea-time', category: '清新日常系', name: '午后茶', mood: '慢生活', bgColor: '#F5F5DC → #FFF8DC', fontColor: '#44403C', accent: '#D6A77A' },

  // 少女浪漫系
  { id: 'sakura', category: '少女浪漫系', name: '樱花', mood: '爱意、心动', bgColor: '#FBCFE8 → #F9A8D4', fontColor: '#831843', accent: '#EC4899' },
  { id: 'rose-dream', category: '少女浪漫系', name: '玫瑰梦', mood: '浪漫、温柔', bgColor: '#FDA4AF → #FB7185', fontColor: '#FFFFFF', accent: '#F43F5E' },
  { id: 'lavender-mist', category: '少女浪漫系', name: '薰衣草雾', mood: '梦幻、轻盈', bgColor: '#DDD6FE → #C4B5FD', fontColor: '#312E81', accent: '#8B5CF6' },
  { id: 'peach-cloud', category: '少女浪漫系', name: '蜜桃云', mood: '可爱、轻松', bgColor: '#FED7AA → #FECACA', fontColor: '#7C2D12', accent: '#FB7185' },

  // 活力快乐系
  { id: 'sunshine', category: '活力快乐系', name: '阳光', mood: '快乐、积极', bgColor: '#FDE047 → #FACC15', fontColor: '#422006', accent: '#F97316' },
  { id: 'citrus-pop', category: '活力快乐系', name: '柑橘', mood: '年轻、元气', bgColor: '#FB923C → #FDE047', fontColor: '#7C2D12', accent: '#EA580C' },
  { id: 'ocean-breeze', category: '活力快乐系', name: '海风', mood: '自由、旅行', bgColor: '#38BDF8 → #0EA5E9', fontColor: '#FFFFFF', accent: '#22D3EE' },
  { id: 'summer-sky', category: '活力快乐系', name: '夏日晴空', mood: '轻快、开放', bgColor: '#60A5FA → #93C5FD', fontColor: '#FFFFFF', accent: '#2563EB' },

  // 成长思考系
  { id: 'forest-path', category: '成长思考系', name: '林间', mood: '成长、探索', bgColor: '#14532D → #166534', fontColor: '#ECFDF5', accent: '#4ADE80' },
  { id: 'mountain-mist', category: '成长思考系', name: '山岚', mood: '沉稳、远方', bgColor: '#475569 → #64748B', fontColor: '#F8FAFC', accent: '#94A3B8' },
  { id: 'earth-tone', category: '成长思考系', name: '大地', mood: '真实、厚重', bgColor: '#8B7355 → #A68A64', fontColor: '#FFFDF7', accent: '#D4A373' },
  { id: 'horizon', category: '成长思考系', name: '地平线', mood: '希望、未来', bgColor: '#2563EB → #7C3AED', fontColor: '#FFFFFF', accent: '#A5B4FC' },

  // 高级感 / 科技感
  { id: 'graphite', category: '高级感 / 科技感', name: '石墨', mood: '极简、高级', bgColor: '#18181B → #27272A', fontColor: '#FAFAFA', accent: '#A1A1AA' },
  { id: 'aurora-tech', category: '高级感 / 科技感', name: '极光科技', mood: 'AI、未来感', bgColor: '#0F172A → #164E63', fontColor: '#F8FAFC', accent: '#22D3EE' },
  { id: 'platinum', category: '高级感 / 科技感', name: '铂金', mood: '奢华、克制', bgColor: '#D4D4D8 → #A1A1AA', fontColor: '#18181B', accent: '#52525B' },
  { id: 'cyber-blue', category: '高级感 / 科技感', name: '赛博蓝', mood: '数字感、创新', bgColor: '#1E3A8A → #2563EB', fontColor: '#FFFFFF', accent: '#38BDF8' },
];

export const DEFAULT_PALETTE_ID = PALETTE_LIBRARY[0].id;

export function getPalette(id: string): PaletteEntry {
  return PALETTE_LIBRARY.find((p) => p.id === id) ?? PALETTE_LIBRARY[0];
}

/** 配色按 category 分组（保持 PALETTE_LIBRARY 内的原始顺序），供 UI 分组展示。 */
export function getPalettesByCategory(): { category: string; palettes: PaletteEntry[] }[] {
  const groups: { category: string; palettes: PaletteEntry[] }[] = [];
  for (const p of PALETTE_LIBRARY) {
    let group = groups.find((g) => g.category === p.category);
    if (!group) {
      group = { category: p.category, palettes: [] };
      groups.push(group);
    }
    group.palettes.push(p);
  }
  return groups;
}
