import type { TemplateDefinition } from '@/types/template';

/**
 * 内置文字排版模板。
 *
 * 样式数值基于 1080 * 1440 的设计画布（导出尺寸），渲染时整体按比例缩放。
 * 等用户发来更多排版模板，按此结构追加即可，渲染引擎无需改动。
 */

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'minimal-light',
    name: '极简浅色',
    description: '大量留白，居中标题，适合金句、短文。',
    swatch: '#1a1a1a',
    canvasStyle: {
      background: '#f7f5f0',
      color: '#1a1a1a',
    },
    contentStyle: {
      padding: '120px 110px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '40px',
    },
    roleStyles: {
      title: { fontSize: '76px', fontWeight: 700, lineHeight: 1.2, letterSpacing: '2px' },
      subtitle: { fontSize: '40px', fontWeight: 500, lineHeight: 1.4, color: '#666' },
      paragraph: { fontSize: '38px', fontWeight: 400, lineHeight: 1.8 },
      list: { fontSize: '38px', fontWeight: 400, lineHeight: 1.8 },
      quote: {
        fontSize: '46px',
        fontWeight: 500,
        lineHeight: 1.6,
        fontStyle: 'italic',
        borderLeft: '6px solid #1a1a1a',
        paddingLeft: '32px',
      },
      caption: { fontSize: '32px', fontWeight: 400, color: '#999', textAlign: 'right' },
    },
  },
  {
    id: 'serious-dark',
    name: '沉稳深色',
    description: '深色背景，左对齐，适合观点、声明类内容。',
    swatch: '#e8c07d',
    canvasStyle: {
      background: '#16181d',
      color: '#f0ece3',
    },
    contentStyle: {
      padding: '130px 100px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      gap: '36px',
    },
    roleStyles: {
      title: { fontSize: '82px', fontWeight: 800, lineHeight: 1.15, color: '#e8c07d' },
      subtitle: { fontSize: '38px', fontWeight: 500, lineHeight: 1.4, color: '#b8b2a6' },
      paragraph: { fontSize: '36px', fontWeight: 400, lineHeight: 1.9 },
      list: { fontSize: '36px', fontWeight: 400, lineHeight: 1.9 },
      quote: { fontSize: '44px', fontWeight: 600, lineHeight: 1.6, color: '#e8c07d' },
      caption: { fontSize: '30px', fontWeight: 400, color: '#7a766c' },
    },
  },
  {
    id: 'warm-card',
    name: '暖色卡片',
    description: '暖调渐变，居中，适合温暖、抒情类短文。',
    swatch: '#d96c4a',
    canvasStyle: {
      background: 'linear-gradient(160deg, #fff4e6 0%, #ffe3cc 100%)',
      color: '#5a3a2e',
    },
    contentStyle: {
      padding: '110px 100px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '38px',
      textAlign: 'center',
    },
    roleStyles: {
      title: { fontSize: '72px', fontWeight: 700, lineHeight: 1.25, color: '#d96c4a' },
      subtitle: { fontSize: '38px', fontWeight: 500, lineHeight: 1.5 },
      paragraph: { fontSize: '37px', fontWeight: 400, lineHeight: 1.85 },
      list: { fontSize: '37px', fontWeight: 400, lineHeight: 1.85, textAlign: 'left' },
      quote: { fontSize: '44px', fontWeight: 500, lineHeight: 1.6, fontStyle: 'italic' },
      caption: { fontSize: '30px', fontWeight: 400, color: '#a87a5a' },
    },
  },
];

export const DEFAULT_TEMPLATE_ID = TEMPLATES[0].id;

export function getTemplateById(id: string): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
