/**
 * Atmospheric Motion Background System v1.0 的全部选项数据（纯数据层）。
 *
 * 五层选项 + 固定品牌底座 + 推荐组合预设。
 * promptBuilder 读取这里的 promptFragment 拼装最终 prompt，UI 读取 name/mood 渲染卡片。
 */

import type {
  LayerOption,
  MotionId,
  MediumId,
  LightId,
  ColorId,
  MoodId,
  BackgroundPreset,
  BackgroundSelection,
} from '@/types/background';

/** 品牌视觉底座：所有图片必须继承的固定前缀。 */
export const BRAND_BASE = [
  'atmospheric abstraction',
  'ambient flow',
  'ethereal motion',
  'soft volumetric depth',
  'airy atmosphere',
  'dreamlike diffusion',
  'organic energy field',
  'premium minimalist design',
  'large negative space',
  'high-end mobile app background',
].join(', ');

/** 运动层。 */
export const MOTION_OPTIONS: LayerOption<MotionId>[] = [
  {
    id: 'breeze',
    name: 'Breeze',
    mood: '平静 · 放松 · 舒适',
    promptFragment: 'gentle drift, soft airflow, slow diffusion, breathing motion',
  },
  {
    id: 'flow',
    name: 'Flow',
    mood: '自然 · 亲近 · 温暖',
    promptFragment: 'organic flow, floating motion, smooth transition, ambient movement',
  },
  {
    id: 'wave',
    name: 'Wave',
    mood: '高级 · 未来 · 沉浸',
    promptFragment: 'spatial waves, fluid ribbons, kinetic curves, layered movement',
  },
  {
    id: 'orbit',
    name: 'Orbit',
    mood: '神秘 · 梦境 · 想象力',
    promptFragment: 'orbital flow, spiral motion, swirling energy, centrifugal movement',
  },
  {
    id: 'burst',
    name: 'Burst',
    mood: '兴奋 · 活力 · 刺激',
    promptFragment: 'radiating motion, velocity blur, dynamic streaks, energy expansion',
  },
];

/** 介质层。 */
export const MEDIUM_OPTIONS: LayerOption<MediumId>[] = [
  {
    id: 'air',
    name: 'Air',
    mood: '空气 · 雾 · 空间',
    promptFragment: 'airy atmosphere, volumetric diffusion, ambient field, soft depth',
  },
  {
    id: 'cloud',
    name: 'Cloud',
    mood: '梦幻 · 浪漫 · 柔和',
    promptFragment: 'cloud diffusion, mist layer, dream haze, soft vapor',
  },
  {
    id: 'silk',
    name: 'Silk',
    mood: '高级 · 优雅 · 温柔',
    promptFragment: 'flowing fabric, velvet softness, silk texture, luxury folds',
  },
  {
    id: 'glass',
    name: 'Glass',
    mood: '科技 · 未来 · 高级感',
    promptFragment: 'liquid glass, glassmorphism, translucent surface, crystal flow',
  },
  {
    id: 'light',
    name: 'Light',
    mood: '未来 · 数字 · AI',
    promptFragment: 'luminescent waves, light field, energy beam, pure illumination',
  },
];

/** 光感层。 */
export const LIGHT_OPTIONS: LayerOption<LightId>[] = [
  {
    id: 'softBloom',
    name: 'Soft Bloom',
    mood: '治愈 · 舒缓',
    promptFragment: 'soft bloom, ambient glow, diffused illumination',
  },
  {
    id: 'daylight',
    name: 'Daylight',
    mood: '快乐 · 轻盈',
    promptFragment: 'morning glow, sunlit atmosphere, natural lighting',
  },
  {
    id: 'pearl',
    name: 'Pearl',
    mood: '浪漫 · 梦幻',
    promptFragment: 'pearlescent glow, iridescent highlights, soft shimmer',
  },
  {
    id: 'neon',
    name: 'Neon',
    mood: '潮流 · 未来',
    promptFragment: 'electric glow, neon streaks, futuristic illumination',
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    mood: '紧张 · 刺激',
    promptFragment: 'focused illumination, dramatic highlights, cinematic contrast',
  },
];

/** 色彩层。 */
export const COLOR_OPTIONS: LayerOption<ColorId>[] = [
  {
    id: 'calmMint',
    name: 'Calm Mint',
    mood: '放松 · 疗愈',
    promptFragment: 'sage green, mint, cream white',
  },
  {
    id: 'dreamLavender',
    name: 'Dream Lavender',
    mood: '浪漫 · 梦幻',
    promptFragment: 'lavender, pearl pink, ivory white',
  },
  {
    id: 'oceanBlue',
    name: 'Ocean Blue',
    mood: '科技 · 高级',
    promptFragment: 'deep blue, cyan, silver',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    mood: '开心 · 活力',
    promptFragment: 'coral, orange, gold',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mood: '神秘 · 沉浸',
    promptFragment: 'navy, purple, charcoal black',
  },
];

/** 情绪层。 */
export const MOOD_OPTIONS: LayerOption<MoodId>[] = [
  {
    id: 'relaxed',
    name: 'Relaxed',
    mood: '平静 · 舒适',
    promptFragment: 'calm, comfortable, peaceful, chill atmosphere',
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    mood: '空灵 · 浪漫',
    promptFragment: 'dreamy, ethereal, romantic, soft fantasy',
  },
  {
    id: 'premium',
    name: 'Premium',
    mood: '奢华 · 自信',
    promptFragment: 'luxury, premium, confident, high-end',
  },
  {
    id: 'energetic',
    name: 'Energetic',
    mood: '鲜活 · 愉悦',
    promptFragment: 'vibrant, uplifting, joyful, dynamic',
  },
  {
    id: 'nostalgic',
    name: 'Nostalgic',
    mood: '感性 · 怀旧',
    promptFragment: 'nostalgic, sentimental, soft memories, lonely atmosphere',
  },
];

/** 推荐组合预设。 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'relaxed-lazy',
    name: '放松慵懒',
    description: 'Breeze + Air + Soft Bloom + Calm Mint + Relaxed',
    selection: {
      motion: 'breeze',
      medium: 'air',
      light: 'softBloom',
      color: 'calmMint',
      mood: 'relaxed',
    },
  },
  {
    id: 'dreamy-romantic',
    name: '梦幻浪漫',
    description: 'Flow + Cloud + Pearl + Dream Lavender + Dreamy',
    selection: {
      motion: 'flow',
      medium: 'cloud',
      light: 'pearl',
      color: 'dreamLavender',
      mood: 'dreamy',
    },
  },
  {
    id: 'tech-premium',
    name: '科技高级',
    description: 'Wave + Glass + Neon + Ocean Blue + Premium',
    selection: {
      motion: 'wave',
      medium: 'glass',
      light: 'neon',
      color: 'oceanBlue',
      mood: 'premium',
    },
  },
  {
    id: 'apple-intelligence',
    name: 'Apple Intelligence 风格',
    description: 'Wave + Air + Soft Bloom + Calm Mint + Premium',
    selection: {
      motion: 'wave',
      medium: 'air',
      light: 'softBloom',
      color: 'calmMint',
      mood: 'premium',
    },
  },
];

/** 默认选择：放松慵懒。 */
export const DEFAULT_SELECTION: BackgroundSelection = BACKGROUND_PRESETS[0].selection;

/** 各层选项查找表，按 id 取 promptFragment / name 用。 */
export const LAYER_OPTION_MAP = {
  motion: MOTION_OPTIONS,
  medium: MEDIUM_OPTIONS,
  light: LIGHT_OPTIONS,
  color: COLOR_OPTIONS,
  mood: MOOD_OPTIONS,
} as const;
