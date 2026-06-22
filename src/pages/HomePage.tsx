import { Link } from 'react-router-dom';

interface ToolEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  status: 'available' | 'planned';
}

/** 工具站工具清单。后续新工具往这里加。 */
const TOOLS: ToolEntry[] = [
  {
    id: 'text-layout',
    name: '文字自动化排版',
    description: '输入文字，套用雨落/弹幕/泪水/图片填充等特效，产出 4:3 文字图片。',
    path: '/tools/text-layout',
    status: 'available',
  },
  {
    id: 'background',
    name: '氛围背景图生成器',
    description:
      '组合 Motion/Medium/Light/Color/Mood 五层，生成统一品牌语言的抽象氛围背景图。',
    path: '/tools/background',
    status: 'available',
  },
];

export function HomePage() {
  return (
    <div className="min-h-full bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-neutral-900">POPOP 生产链路工具站</h1>
        <p className="mt-1 text-sm text-neutral-500">产品内容的管线与可视化工具集</p>
      </header>

      <main className="mx-auto max-w-5xl p-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.id}
              to={tool.path}
              className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-neutral-900 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">{tool.name}</h2>
                {tool.status === 'planned' && (
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-400">
                    规划中
                  </span>
                )}
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">
                {tool.description}
              </p>
              <span className="mt-4 text-sm font-medium text-neutral-400 group-hover:text-neutral-900">
                打开 →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
