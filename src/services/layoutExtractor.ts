import type { ExtractLayoutInput, LayoutBlock, LayoutSchema } from '@/types/layout';
import { MAX_INPUT_LENGTH } from '@/types/layout';
import { DEFAULT_TEMPLATE_ID } from '@/data/templates';
// import { postLocal } from './apiClient'; // 后端接入后启用

/** 是否使用后端模型抽取。后端就绪后置 true（或读环境变量）。 */
const USE_BACKEND = false;

let blockSeq = 0;
function nextId(prefix: string): string {
  blockSeq += 1;
  return `${prefix}-${blockSeq}`;
}

/**
 * 结构抽取：输入文字 → LayoutSchema。
 *
 * 当前为 mock 规则实现，仅做"框架格式"抽取，不调用模型生产内容。
 * 后端接上后切到 extractLayoutFromBackend，调用方不变。
 */
export async function extractLayout(input: ExtractLayoutInput): Promise<LayoutSchema> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('输入文字为空');
  }
  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(`输入超过 ${MAX_INPUT_LENGTH} 字上限`);
  }

  if (USE_BACKEND) {
    return extractLayoutFromBackend(input);
  }
  return extractLayoutMock(input);
}

/**
 * 后端模型抽取（占位）。后端就绪后实现并把 USE_BACKEND 置 true。
 * 约定后端返回的 JSON 直接符合 LayoutSchema（source: 'model'）。
 */
async function extractLayoutFromBackend(_input: ExtractLayoutInput): Promise<LayoutSchema> {
  // return postLocal<ExtractLayoutInput, LayoutSchema>('/layout/extract', _input);
  throw new Error('后端抽取尚未接入');
}

/**
 * Mock 规则抽取：基于段落/标点的启发式拆分，仅用于跑通链路与预览。
 * 真正的语义判定后续交给后端模型。
 */
function extractLayoutMock(input: ExtractLayoutInput): LayoutSchema {
  blockSeq = 0;
  const text = input.text.trim();

  // 按空行/换行拆段
  const rawParts = text
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: LayoutBlock[] = [];

  rawParts.forEach((part, index) => {
    // 第一段且较短 → 视为标题
    if (index === 0 && part.length <= 18 && rawParts.length > 1) {
      blocks.push({ id: nextId('block'), role: 'title', text: part, emphasis: true });
      return;
    }

    // 以列表符号开头的连续行 → 列表
    if (/^[\-•·*]\s?/.test(part) || /^\d+[.、)]/.test(part)) {
      const items = part
        .split(/\n/)
        .map((l) => l.replace(/^[\-•·*]\s?/, '').replace(/^\d+[.、)]\s?/, '').trim())
        .filter(Boolean);
      blocks.push({ id: nextId('block'), role: 'list', items });
      return;
    }

    // 引号包裹 → 引用
    if (/^[“"'「『].*[”"'」』]$/.test(part)) {
      blocks.push({ id: nextId('block'), role: 'quote', text: part });
      return;
    }

    // 末段且短 → 落款
    if (index === rawParts.length - 1 && part.length <= 12 && rawParts.length > 2) {
      blocks.push({ id: nextId('block'), role: 'caption', text: part });
      return;
    }

    blocks.push({ id: nextId('block'), role: 'paragraph', text: part });
  });

  // 只有一段且无标题时，把首句抽成副标题以丰富层次
  if (blocks.length === 1 && blocks[0].role === 'paragraph' && blocks[0].text) {
    const body = blocks[0].text;
    const firstSentence = body.match(/^[^。！？!?\n]{1,24}[。！？!?]?/)?.[0]?.trim();
    if (firstSentence && firstSentence.length < body.length) {
      const rest = body.slice(firstSentence.length).trim();
      blocks.splice(
        0,
        1,
        { id: nextId('block'), role: 'subtitle', text: firstSentence },
        ...(rest ? [{ id: nextId('block'), role: 'paragraph' as const, text: rest }] : []),
      );
    }
  }

  return {
    blocks,
    recommendedTemplateId: input.preferredTemplateId ?? DEFAULT_TEMPLATE_ID,
    mood: 'calm',
    source: 'mock',
  };
}
