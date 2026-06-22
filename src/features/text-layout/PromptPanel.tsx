import { useMemo, useState } from 'react';
import type { EffectMode, EffectParams } from '@/types/layout';
import type { Background, GenerationOutput } from '@/types/catalog';
import { buildStylePromptSection } from '@/services/buildPrompt';

interface PromptPanelProps {
  mode: EffectMode;
  params: EffectParams;
  background: Background;
  /** 当前输入文案（作为示例 JSON 里的 text） */
  text: string;
}

/**
 * 生产链路面板：把骨架里「拼接生成」相关的内容显性化到界面。
 *  - 风格提示词片段（拼进内容生成 prompt 的上下文）+ 一键复制
 *  - 当前选择对应的 GenerationOutput 示例 JSON（模型应输出的样子）
 */
export function PromptPanel({ mode, params, background, text }: PromptPanelProps) {
  const [copied, setCopied] = useState<'prompt' | 'json' | null>(null);

  const promptSection = useMemo(() => buildStylePromptSection(), []);

  const sampleOutput = useMemo<GenerationOutput>(() => {
    const out: GenerationOutput = {
      text: text.trim() || '（此处为模型生成的文案）',
      effectId: mode,
      background,
    };
    if (mode === 'imageFill' && params.fillShape !== 'image') {
      out.shapeId = params.fillShape;
    }
    return out;
  }, [mode, params.fillShape, background, text]);

  const sampleJson = useMemo(() => JSON.stringify(sampleOutput, null, 2), [sampleOutput]);

  const copy = async (kind: 'prompt' | 'json', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error('clipboard.write.failed', e);
      alert('复制失败，请手动选择文本复制');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">风格提示词片段</span>
          <button
            type="button"
            onClick={() => copy('prompt', promptSection)}
            className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-900"
          >
            {copied === 'prompt' ? '已复制' : '复制'}
          </button>
        </div>
        <p className="mb-2 text-xs text-neutral-400">
          拼进你的内容生成 prompt（通常放在任务说明之后、输出要求之前）。库一更新这里自动同步。
        </p>
        <pre className="max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 whitespace-pre-wrap">
          {promptSection}
        </pre>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">当前选择的输出示例</span>
          <button
            type="button"
            onClick={() => copy('json', sampleJson)}
            className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-900"
          >
            {copied === 'json' ? '已复制' : '复制'}
          </button>
        </div>
        <p className="mb-2 text-xs text-neutral-400">
          模型应输出的 JSON 结构（只含离散选择，不含数值参数；字号/模糊等由系统按区间随机）。
        </p>
        <pre className="overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 whitespace-pre-wrap">
          {sampleJson}
        </pre>
      </div>
    </div>
  );
}
