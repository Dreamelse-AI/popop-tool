/**
 * 情绪配色库：服务端文件存储。
 *
 * 「永久存储在网站上，不是本地浏览器」的落地实现：
 *   - 元数据落 .data/palettes.json（单文件 JSON，原子写）
 *   - 原图落 .data/palette-images/<id>.<ext>（base64 解码后写盘）
 *   - 容器部署时把 .data 挂成持久卷即可跨重启保留
 *
 * 不引入数据库，规模（设计师手动整理的配色表）下 JSON 足够，且零外部依赖。
 * 写操作用串行队列 + 临时文件 rename，避免并发写半截文件。
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** 一套配色方案：底色 + 字色 + 情绪词。 */
export interface PaletteScheme {
  bgColor: string;
  fontColor: string;
  mood: string;
}

/** 一条配色记录（与前端 PaletteEntry 对齐，camelCase，路由层不转换）。 */
export interface PaletteRecord {
  /** 英文连字符 id，同时作为原图文件名 */
  id: string;
  name: string;
  /** 两套配色方案（互换底/字，情绪词可不同） */
  schemes: PaletteScheme[];
  /** 从原图提取的主色板（hex 数组） */
  colors: string[];
  /** 原图访问路径（同源 /api/palette/image/<id>.<ext>） */
  imageUrl: string;
  /** 原图落盘文件名 <id>.<ext> */
  imageFile: string;
  /** 创建时间 ISO 字符串 */
  createdAt: string;
}

/** 数据根目录：默认仓库根 .data，可用 PALETTE_DATA_DIR 覆盖（容器持久卷）。 */
const DATA_DIR = process.env.PALETTE_DATA_DIR
  ? path.resolve(process.env.PALETTE_DATA_DIR)
  : path.resolve(process.cwd(), '.data');
const IMAGES_DIR = path.join(DATA_DIR, 'palette-images');
const DB_FILE = path.join(DATA_DIR, 'palettes.json');

/** 串行写队列：把所有写操作排队，避免并发 rename 互相覆盖。 */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = writeChain.then(task, task);
  // 吞掉链上的拒绝，避免一次失败污染后续任务；调用方仍能拿到自己的结果/异常
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureDirs(): Promise<void> {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'EACCES' || err.code === 'EROFS' || err.code === 'EPERM') {
      throw new PaletteError(
        `数据目录不可写（${DATA_DIR}）：请确认容器已挂可写持久卷，或设置 PALETTE_DATA_DIR 指向可写目录`,
      );
    }
    throw e;
  }
}

/** 读取全部记录（按创建时间倒序）。文件不存在视为空库。 */
export async function readAll(): Promise<PaletteRecord[]> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const list = JSON.parse(raw) as unknown[];
    if (!Array.isArray(list)) return [];
    return list.map(migrateRecord);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

/**
 * 旧记录兼容：早期是扁平 { mood, bgColor, fontColor }，新版是 schemes[]。
 * 读到旧结构时就地转成单方案 + 自动补一套互换方案，保证前端只处理 schemes[]。
 */
function migrateRecord(raw: unknown): PaletteRecord {
  const r = raw as Record<string, unknown> & {
    schemes?: PaletteScheme[];
    bgColor?: string;
    fontColor?: string;
    mood?: string;
  };
  if (Array.isArray(r.schemes) && r.schemes.length > 0) {
    return r as unknown as PaletteRecord;
  }
  const bg = typeof r.bgColor === 'string' ? r.bgColor : '#ffffff';
  const fg = typeof r.fontColor === 'string' ? r.fontColor : '#0b0b0b';
  const mood = typeof r.mood === 'string' ? r.mood : '';
  const schemes: PaletteScheme[] = [
    { bgColor: bg, fontColor: fg, mood },
    { bgColor: fg, fontColor: bg, mood },
  ];
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    schemes,
    colors: Array.isArray(r.colors) ? (r.colors as string[]) : [],
    imageUrl: String(r.imageUrl ?? ''),
    imageFile: String(r.imageFile ?? ''),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
  };
}

/** 原子写整库：先写临时文件再 rename。 */
async function writeAll(list: PaletteRecord[]): Promise<void> {
  await ensureDirs();
  const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

/** mime → 文件扩展名（仅允许常见图片格式）。 */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** 解析 data URL，返回 buffer 与扩展名；非法返回 null。 */
function parseDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = EXT_BY_MIME[mime];
  if (!ext) return null;
  try {
    return { buffer: Buffer.from(m[2], 'base64'), ext };
  } catch {
    return null;
  }
}

/** 保存入参（前端已在 canvas 端完成主色提取与命名）。 */
export interface SaveInput {
  id: string;
  name: string;
  schemes: PaletteScheme[];
  colors: string[];
  /** 原图 base64 data URL */
  imageDataUrl: string;
}

/** id 合法性：小写英文 + 数字 + 连字符，1-64 字符。 */
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class PaletteError extends Error {}

/**
 * 新增一条记录：落原图 + 落元数据。
 * id 重复直接报错（让前端换 id 或前端先生成唯一 id）。
 */
export async function createRecord(input: SaveInput): Promise<PaletteRecord> {
  if (!ID_RE.test(input.id)) {
    throw new PaletteError('id 不合法：仅允许小写英文、数字、连字符');
  }
  const parsed = parseDataUrl(input.imageDataUrl);
  if (!parsed) throw new PaletteError('图片格式不支持（仅 png/jpg/webp/gif）');

  return enqueue(async () => {
    const list = await readAll();
    if (list.some((r) => r.id === input.id)) {
      throw new PaletteError(`id「${input.id}」已存在，请换一个`);
    }
    await ensureDirs();
    const imageFile = `${input.id}.${parsed.ext}`;
    await fs.writeFile(path.join(IMAGES_DIR, imageFile), parsed.buffer);

    const record: PaletteRecord = {
      id: input.id,
      name: input.name,
      schemes: input.schemes,
      colors: input.colors,
      imageFile,
      imageUrl: `/api/palette/image/${imageFile}`,
      createdAt: new Date().toISOString(),
    };
    await writeAll([record, ...list]);
    return record;
  });
}

/** 删除一条：删元数据 + 删原图文件（文件缺失忽略）。 */
export async function deleteRecord(id: string): Promise<void> {
  return enqueue(async () => {
    const list = await readAll();
    const target = list.find((r) => r.id === id);
    if (!target) return;
    await writeAll(list.filter((r) => r.id !== id));
    try {
      await fs.unlink(path.join(IMAGES_DIR, target.imageFile));
    } catch {
      // 文件已不在，忽略
    }
  });
}

/** 取原图绝对路径（路由层据此回传文件）；做基本的路径穿越防护。 */
export function resolveImagePath(fileName: string): string | null {
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return null;
  }
  return path.join(IMAGES_DIR, fileName);
}
