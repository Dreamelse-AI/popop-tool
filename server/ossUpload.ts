/**
 * 封面图上传到阿里云 OSS（服务端，dev 的 vite 中间件与生产 Express 共用）。
 *
 * 安全：OSS 长期 AccessKey 只在服务端进程环境变量里，绝不进前端 bundle。
 * 前端把图片转 base64 发到 /api/style-cover/upload，服务端解码后用 SDK 直传 OSS，
 * 返回可公开访问的对象 URL（写入画风的 style_icon 字段）。
 *
 * 桶约定（见 .env）：
 *   OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_PREFIX
 * 封面对象 key 形如 <OSS_PREFIX>style-cover/<uuid>.<ext>。
 */

import crypto from 'node:crypto';
import OSS from 'ali-oss';

/** 允许的图片类型 → 扩展名。 */
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** 单图上限 8MB（封面图不需要太大）。 */
const MAX_BYTES = 8 * 1024 * 1024;

export interface UploadCoverInput {
  /** base64 data URI（data:image/png;base64,xxxx）或纯 base64。 */
  dataUrl: string;
}

export interface UploadCoverResult {
  url: string;
  objectKey: string;
}

export class CoverUploadError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'CoverUploadError';
  }
}

/** 读 OSS 配置，缺失则抛错（避免静默上传到错误位置）。 */
function readOssConfig() {
  const region = process.env.OSS_REGION ?? '';
  const bucket = process.env.OSS_BUCKET ?? '';
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID ?? '';
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET ?? '';
  const prefix = process.env.OSS_PREFIX ?? 'moodpic/';
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new CoverUploadError(
      'OSS 未配置：请在服务端环境变量设置 OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET',
      500,
    );
  }
  return { region, bucket, accessKeyId, accessKeySecret, prefix };
}

/** 解析 data URI / 纯 base64，返回 buffer 与 mime。 */
function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl.trim());
  const mime = match ? match[1] : 'image/png';
  const base64 = match ? match[2] : dataUrl.trim();
  if (!MIME_EXT[mime]) {
    throw new CoverUploadError(`不支持的图片类型：${mime}`);
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    throw new CoverUploadError('图片数据解析失败');
  }
  if (buffer.length === 0) throw new CoverUploadError('图片数据为空');
  if (buffer.length > MAX_BYTES) {
    throw new CoverUploadError(`图片过大（上限 ${Math.round(MAX_BYTES / 1024 / 1024)}MB）`);
  }
  return { buffer, mime };
}

/**
 * 把一张封面图上传到 OSS，返回可访问 URL。
 * ACL 用 public-read 确保前端 <img> 可直接显示（桶为私有时此对象单独放开读）。
 */
export async function uploadCoverToOss(input: UploadCoverInput): Promise<UploadCoverResult> {
  const { region, bucket, accessKeyId, accessKeySecret, prefix } = readOssConfig();
  const { buffer, mime } = parseDataUrl(input.dataUrl);
  const ext = MIME_EXT[mime];
  const objectKey = `${prefix}style-cover/${crypto.randomUUID()}.${ext}`;

  const client = new OSS({ region, accessKeyId, accessKeySecret, bucket, secure: true });
  const result = await client.put(objectKey, buffer, {
    mime,
    headers: { 'x-oss-object-acl': 'public-read', 'Cache-Control': 'public, max-age=31536000' },
  });

  return { url: result.url, objectKey };
}
