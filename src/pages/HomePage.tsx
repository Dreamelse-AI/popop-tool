import { Link } from 'react-router-dom';
import { PopopMascot } from '@/components/PopopMascot';

interface ToolEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  status: 'available' | 'planned';
  /** 角标短标签，如 AIGC / 排版 */
  tag: string;
}

/** 工具站工具清单。后续新工具往这里加。 */
const TOOLS: ToolEntry[] = [
  {
    id: 'text-layout',
    name: '文字自动化排版',
    description: '输入文字，套用雨落/弹幕/泪水/图片填充等特效，产出 4:3 文字图片。',
    path: '/tools/text-layout',
    status: 'available',
    tag: '排版',
  },
  {
    id: 'background',
    name: '氛围背景图生成器',
    description:
      '组合 Motion/Medium/Light/Color/Mood 五层，生成统一品牌语言的抽象氛围背景图。',
    path: '/tools/background',
    status: 'available',
    tag: 'AIGC',
  },
  {
    id: 'visual-asset',
    name: '视觉资产生产引擎',
    description:
      'Emotion × Type × DNA 三态组合（锁定/多选随机/全随机），批量生成视觉资产，可接扩写模型。',
    path: '/tools/visual-asset',
    status: 'available',
    tag: 'AIGC',
  },
  {
    id: 'sticker',
    name: '表情包生成器',
    description:
      '上传人物形象，一次出图生成 3×3 九宫格表情，自动切成 9 张并去背景。调用最少、成本最低。',
    path: '/tools/sticker',
    status: 'available',
    tag: 'AIGC',
  },
  {
    id: 'style-prompt',
    name: '画风生图工具',
    description:
      '管理画风库（增改删 + 封面图），用画风 + 人物等提示词测试出图（单张/多张），满意的存为新画风。',
    path: '/tools/style-prompt',
    status: 'available',
    tag: 'AIGC',
  },
  {
    id: 'palette',
    name: '配色情绪库',
    description:
      '拖入图片自动识别主色配色，AI 给出命名与适用情绪氛围场景，永久存储在服务器，可表格管理与删除。',
    path: '/tools/palette',
    status: 'available',
    tag: '配色',
  },
  {
    id: 'batch-name-image',
    name: '批量名字生图',
    description:
      '左侧输入多个基础元素（空行分隔）+ 题材类型 + 风格 + 比例，整理扩写后批量出图，右侧单张/批量保存删除。',
    path: '/tools/batch-name-image',
    status: 'available',
    tag: 'AIGC',
  },
];

export function HomePage() {
  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <section className="relative mb-8 overflow-hidden rounded-pop-xl border-2 border-ink bg-cream-soft px-7 py-8 shadow-sticker">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            POPOP 生产链路工具站
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
            产品内容的管线与可视化工具集。文字排版、氛围背景、视觉资产、表情包，
            一套统一的品牌语言把零散的内容生产流程串起来。
          </p>
          <PopopMascot
            variant="color"
            size={220}
            className="pointer-events-none absolute -right-10 top-5 hidden -rotate-6 opacity-95 sm:block"
          />
        </section>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              to={tool.path}
              className="group flex flex-col rounded-pop-lg border-2 border-ink bg-paper p-5 shadow-sticker transition hover:-translate-y-0.5 hover:bg-cream-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-extrabold text-ink">{tool.name}</h2>
                {tool.status === 'planned' ? (
                  <span className="pop-tag">规划中</span>
                ) : (
                  <span className="pop-tag-cream">{tool.tag}</span>
                )}
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{tool.description}</p>
              <span className="font-display mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink-3 transition group-hover:text-ink">
                打开 →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
