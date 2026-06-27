/**
 * IP 延展工具的预设维度数据（动作 / 情绪 / 插画类型）。
 *
 * 纯数据层：每个 option 带英文 promptFragment（注入图生图 prompt）+ 中文 label（UI 展示）。
 * 三态选择与随机展开见 services/ipExtendEngine.ts。
 */

import type { AssetOption } from '@/types/visualAsset';

/** 动作 / 姿态。 */
export const ACTION_OPTIONS: AssetOption[] = [
  { id: 'wave', name: 'waving hello', label: '挥手打招呼', promptFragment: 'waving hello with one hand raised' },
  { id: 'thumbs-up', name: 'thumbs up', label: '点赞', promptFragment: 'giving an enthusiastic thumbs up' },
  { id: 'running', name: 'running', label: '奔跑', promptFragment: 'running energetically, mid-stride' },
  { id: 'jumping', name: 'jumping', label: '跳跃', promptFragment: 'jumping joyfully into the air' },
  { id: 'sitting', name: 'sitting', label: '坐着', promptFragment: 'sitting down in a relaxed pose' },
  { id: 'lying', name: 'lying down', label: '躺着', promptFragment: 'lying down lazily, resting' },
  { id: 'thinking', name: 'thinking', label: '思考', promptFragment: 'thinking with a hand on the chin' },
  { id: 'reading', name: 'reading', label: '看书', promptFragment: 'reading a book attentively' },
  { id: 'eating', name: 'eating', label: '吃东西', promptFragment: 'happily eating a snack' },
  { id: 'sleeping', name: 'sleeping', label: '睡觉', promptFragment: 'sleeping peacefully, eyes closed' },
  { id: 'dancing', name: 'dancing', label: '跳舞', promptFragment: 'dancing cheerfully' },
  { id: 'hugging', name: 'hugging', label: '拥抱', promptFragment: 'opening arms for a warm hug' },
  { id: 'working', name: 'working', label: '工作', promptFragment: 'working focused at a desk with a laptop' },
  { id: 'celebrating', name: 'celebrating', label: '庆祝', promptFragment: 'celebrating with confetti and raised arms' },
];

/** 情绪 / 表情。 */
export const EMOTION_OPTIONS: AssetOption[] = [
  { id: 'happy', name: 'happy', label: '开心', promptFragment: 'a bright, happy smile' },
  { id: 'excited', name: 'excited', label: '兴奋', promptFragment: 'an excited, thrilled expression' },
  { id: 'shy', name: 'shy', label: '害羞', promptFragment: 'a shy, blushing expression' },
  { id: 'sad', name: 'sad', label: '难过', promptFragment: 'a sad, teary expression' },
  { id: 'angry', name: 'angry', label: '生气', promptFragment: 'a pouty, angry expression' },
  { id: 'surprised', name: 'surprised', label: '惊讶', promptFragment: 'a surprised, wide-eyed expression' },
  { id: 'crying', name: 'crying', label: '大哭', promptFragment: 'crying with comically big tears' },
  { id: 'love', name: 'in love', label: '心动', promptFragment: 'an adoring expression with heart-shaped eyes' },
  { id: 'sleepy', name: 'sleepy', label: '困倦', promptFragment: 'a sleepy, drowsy expression' },
  { id: 'confused', name: 'confused', label: '困惑', promptFragment: 'a confused, puzzled expression' },
  { id: 'proud', name: 'proud', label: '得意', promptFragment: 'a proud, smug expression' },
  { id: 'calm', name: 'calm', label: '平静', promptFragment: 'a calm, content expression' },
];

/** 插画类型 / 出图形态。 */
export const ILLUSTRATION_OPTIONS: AssetOption[] = [
  { id: 'full-body', name: 'full-body illustration', label: '全身立绘', promptFragment: 'a clean full-body character illustration' },
  { id: 'half-body', name: 'half-body portrait', label: '半身像', promptFragment: 'a half-body portrait illustration' },
  { id: 'chibi', name: 'chibi style', label: 'Q版', promptFragment: 'a cute chibi / super-deformed style version' },
  { id: 'sticker', name: 'sticker', label: '贴纸表情', promptFragment: 'a die-cut sticker style with a clean solid background' },
  { id: 'scene', name: 'scene illustration', label: '场景插画', promptFragment: 'a complete scene illustration with detailed background' },
  { id: 'icon', name: 'avatar icon', label: '头像图标', promptFragment: 'a circular avatar icon, head and shoulders' },
  { id: 'emoji', name: 'emoji', label: '小表情', promptFragment: 'a small simple emoji-style expression' },
  { id: 'poster', name: 'poster', label: '海报主视觉', promptFragment: 'a poster key-visual composition' },
];

/** 维度 key 与展示标题。 */
export const IP_DIMENSIONS = [
  { key: 'action', title: '动作 Action', options: ACTION_OPTIONS },
  { key: 'emotion', title: '情绪 Emotion', options: EMOTION_OPTIONS },
  { key: 'illustration', title: '插画类型 Type', options: ILLUSTRATION_OPTIONS },
] as const;

/** 在某维度的选项里按 id 查找。 */
export function findIpOption(options: AssetOption[], id: string): AssetOption | undefined {
  return options.find((o) => o.id === id);
}
