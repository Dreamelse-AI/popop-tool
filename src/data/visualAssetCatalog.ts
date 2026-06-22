/**
 * Visual Asset Production Engine v1 的全部目录数据（纯数据层）。
 *
 * Emotion / Type / 三套 DNA schema / 全局 Style。
 * 生成引擎、UI、prompt 拼装都读这里。新增选项只改本文件。
 *
 * promptFragment 缺省时由引擎/扩写器回退用 name（小写）。
 */

import type { AssetOption, DnaSchema, AssetType } from '@/types/visualAsset';

/** 简易构造：用 name 派生 id（小写连字符），label/fragment 可选。 */
function opt(name: string, label?: string, promptFragment?: string): AssetOption {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    label,
    promptFragment: promptFragment ?? name.toLowerCase(),
  };
}

// [EMOTION]
/** 情绪：Daily 20 + Plot Expansion 5，共 25。带中文标签。 */
export const EMOTION_OPTIONS: AssetOption[] = [
  // Daily
  opt('relaxed', '放松'),
  opt('healing', '治愈'),
  opt('focused', '专注'),
  opt('pure', '纯净'),
  opt('romantic', '浪漫'),
  opt('affectionate', '深情'),
  opt('tender', '温柔'),
  opt('joyful', '愉悦'),
  opt('youthful', '青春'),
  opt('free', '自由'),
  opt('passionate', '热烈'),
  opt('hopeful', '希望'),
  opt('confident', '自信'),
  opt('elegant', '优雅'),
  opt('nostalgic', '怀旧'),
  opt('solitary', '孤独'),
  opt('melancholic', '忧郁'),
  opt('mysterious', '神秘'),
  opt('futuristic', '未来'),
  opt('intense', '强烈'),
  // Plot Expansion
  opt('tense', '紧张'),
  opt('dramatic', '戏剧'),
  opt('adventurous', '冒险'),
  opt('bold', '大胆'),
  opt('fantasy', '奇幻'),
];
// [TYPE]
/** 图像类型。 */
export const TYPE_OPTIONS: AssetOption[] = [
  opt('Abstract', '抽象', 'abstract composition'),
  opt('Landscape', '风景', 'landscape scene'),
  opt('Environment', '环境', 'environment scene'),
];
// [STYLE]
/** 当前阶段单一全局 style pack，prompt 展开后注入。 */
export const GLOBAL_STYLE: AssetOption = opt(
  'Premium Atmospheric',
  '高级氛围',
  'premium minimalist design, atmospheric, soft volumetric depth, large negative space, high-end aesthetic',
);
// [DNA_ABSTRACT]
const ABSTRACT_SCHEMA: DnaSchema = {
  type: 'abstract',
  fields: [
    {
      key: 'motion',
      name: 'Motion 运动',
      options: [
        opt('Flow'), opt('Breeze'), opt('Wave'), opt('Orbit'), opt('Drift'),
        opt('Burst'), opt('Ripple'), opt('Spiral'), opt('Float'), opt('Pulse'),
      ],
    },
    {
      key: 'medium',
      name: 'Medium 介质',
      options: [
        opt('Air'), opt('Cloud'), opt('Mist'), opt('Smoke'), opt('Silk'),
        opt('Fabric'), opt('Water'), opt('Liquid'), opt('Glass'), opt('Crystal'),
        opt('Pearl'), opt('Metal'), opt('Chrome'), opt('Particle'), opt('Light'),
      ],
    },
    {
      key: 'light',
      name: 'Light 光感',
      options: [
        opt('Soft Bloom'), opt('Bloom'), opt('Daylight'), opt('Golden Hour'),
        opt('Moonlight'), opt('Pearl Glow'), opt('Ambient Glow'), opt('Neon'),
        opt('Spotlight'), opt('Volumetric Light'), opt('Backlight'), opt('Diffused Light'),
      ],
    },
    {
      key: 'color',
      name: 'Color 色彩',
      options: [
        opt('Mint'), opt('Forest'), opt('Champagne'), opt('Lavender'), opt('Sakura'),
        opt('Rose'), opt('Ocean'), opt('Sky'), opt('Cyan'), opt('Sunset'), opt('Coral'),
        opt('Peach'), opt('Midnight'), opt('Indigo'), opt('Violet'), opt('Chrome'),
        opt('Silver'), opt('Graphite'), opt('Ivory'), opt('Cream'), opt('Pearl White'),
      ],
    },
    {
      key: 'blur',
      name: 'Blur 模糊',
      options: [
        opt('Ultra Soft'), opt('Soft'), opt('Gentle'), opt('Medium'),
        opt('Strong'), opt('Extreme'),
      ],
    },
    {
      key: 'density',
      name: 'Density 密度',
      options: [
        opt('Ultra Airy'), opt('Airy'), opt('Balanced'), opt('Layered'),
        opt('Rich'), opt('Dense'), opt('Immersive'),
      ],
    },
  ],
};
// [DNA_LANDSCAPE]
const LANDSCAPE_SCHEMA: DnaSchema = {
  type: 'landscape',
  fields: [
    {
      key: 'terrain',
      name: 'Terrain 地貌',
      options: [
        opt('Ocean'), opt('Beach'), opt('Coastline'), opt('Cliff Coast'), opt('Lake'),
        opt('Mountain Lake'), opt('River'), opt('Stream'), opt('Waterfall'), opt('Wetland'),
        opt('Hot Spring'), opt('Mountain'), opt('Snow Mountain'), opt('Rocky Peak'),
        opt('Volcano'), opt('Valley'), opt('Canyon'), opt('Cliff'), opt('Forest'),
        opt('Pine Forest'), opt('Birch Forest'), opt('Maple Forest'), opt('Bamboo Forest'),
        opt('Rainforest'), opt('Grassland'), opt('Meadow'), opt('Wildflower Field'),
        opt('Prairie'), opt('Desert'), opt('Dune'), opt('Salt Lake'), opt('Rock Field'),
        opt('Cloud Sea'), opt('Starfield'), opt('Milky Way'), opt('Aurora'), opt('Island'),
        opt('Glacier'), opt('Ice Field'),
      ],
    },
    {
      key: 'time',
      name: 'Time 时间',
      options: [
        opt('Sunrise'), opt('Morning'), opt('Noon'), opt('Afternoon'), opt('Golden Hour'),
        opt('Sunset'), opt('Dusk'), opt('Blue Hour'), opt('Night'), opt('Midnight'),
      ],
    },
    {
      key: 'scale',
      name: 'Scale 尺度',
      options: [
        opt('Intimate'), opt('Close'), opt('Balanced'), opt('Wide'),
        opt('Epic'), opt('Grand'), opt('Infinite'),
      ],
    },
    {
      key: 'weather',
      name: 'Weather 天气（可选）',
      optional: true,
      options: [
        opt('Clear'), opt('Sunny'), opt('Cloudy'), opt('Breezy'), opt('Windy'),
        opt('Fog'), opt('Mist'), opt('Rain'), opt('Drizzle'), opt('Storm'),
        opt('Thunderstorm'), opt('Snow'), opt('Blizzard'), opt('Aurora'),
      ],
    },
    {
      key: 'season',
      name: 'Season 季节（可选）',
      optional: true,
      options: [opt('Spring'), opt('Summer'), opt('Autumn'), opt('Winter')],
    },
  ],
};
// [DNA_ENVIRONMENT]
const ENVIRONMENT_SCHEMA: DnaSchema = {
  type: 'environment',
  fields: [
    {
      key: 'location',
      name: 'Location 场所',
      options: [
        opt('Cafe'), opt('Coffee Shop'), opt('Tea House'), opt('Restaurant'),
        opt('Fine Dining'), opt('Dessert Shop'), opt('Bar'), opt('Rooftop Bar'),
        opt('Street'), opt('Crosswalk'), opt('Square'), opt('Shopping Mall'),
        opt('Office Building'), opt('Subway Station'), opt('Train Station'), opt('Airport'),
        opt('Rooftop'), opt('Observation Deck'), opt('Bridge'), opt('Alley'),
        opt('Cinema'), opt('Live House'), opt('Concert Hall'), opt('Music Festival'),
        opt('Arcade'), opt('KTV'), opt('Gallery'), opt('Museum'), opt('Bedroom'),
        opt('Living Room'), opt('Kitchen'), opt('Dining Room'), opt('Balcony'),
        opt('Study Room'), opt('Home Office'), opt('Library'), opt('Bookstore'),
        opt('Campus'), opt('Classroom'), opt('Hotel'), opt('Resort'), opt('Camp Site'),
        opt('Aquarium'), opt('Greenhouse'), opt('Church'), opt('Temple'),
      ],
    },
    {
      key: 'state',
      name: 'State 状态',
      options: [
        opt('Empty'), opt('Quiet'), opt('Cozy'), opt('Relaxed'), opt('Intimate'),
        opt('Social'), opt('Lively'), opt('Busy'), opt('Crowded'),
      ],
    },
    {
      key: 'crowd',
      name: 'Crowd 人群',
      options: [
        opt('None'), opt('Single Person'), opt('Couple'), opt('Small Group'),
        opt('Friends'), opt('Family'), opt('Many People'), opt('Crowded'),
      ],
    },
    {
      key: 'light',
      name: 'Light 光线',
      options: [
        opt('Soft Daylight'), opt('Warm Daylight'), opt('Golden Hour'), opt('Sunset Glow'),
        opt('Night Light'), opt('Neon Light'), opt('Candle Light'), opt('Window Light'),
        opt('Rainy Window Light'),
      ],
    },
    {
      key: 'season',
      name: 'Season 季节（可选）',
      optional: true,
      options: [opt('Spring'), opt('Summer'), opt('Autumn'), opt('Winter')],
    },
  ],
};
// [SCHEMA_MAP]
/** Type → DNA schema 映射。 */
export const DNA_SCHEMAS: Record<AssetType, DnaSchema> = {
  abstract: ABSTRACT_SCHEMA,
  landscape: LANDSCAPE_SCHEMA,
  environment: ENVIRONMENT_SCHEMA,
};

/** 当前第一版启用的 Type（先跑通 Abstract）。其余 schema 数据已就绪，放开即可用。 */
export const ENABLED_TYPES: AssetType[] = ['abstract'];

/** 按 id 在某组选项里取元信息。 */
export function findOption(options: AssetOption[], id: string): AssetOption | undefined {
  return options.find((o) => o.id === id);
}
