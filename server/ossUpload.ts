/**
 * 封面图上传到阿里云 OSS（服务端，dev 的 vite 中间件与生产 Express 共用）。
 *
 * 安全：OSS 凭证只在服务端进程内，绝不进前端 bundle。
 *
 * 凭证获取（两种模式，优先级从高到低）：
 *   1. 环境变量长期 AK/SK：OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET
 *   2. STS 临时凭证（推荐）：通过 ARCA_ORIGIN + OSS_CREDENTIAL_UID 自动从
 *      /internal/tool/gen_jwt_token + /file/tos_credential 获取，1 小时有效，到期自动续期。
 *
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
  /** 对象 key 的子目录（默认 style-cover/）。如配色库传 'palette/'。 */
  subdir?: string;
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

// ==================== OSS 凭证管理 ====================

interface OssCredentials {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  stsToken?: string;
  prefix: string;
  /** 过期时间（unix ms），长期 AK 为 Infinity。 */
  expiresAt: number;
}

/** 缓存的凭证（含 STS 临时凭证的过期管理）。 */
let cached: OssCredentials | null = null;

/** 尝试从环境变量读取长期 AK/SK（全部配齐才用）。 */
function tryStaticCredentials(): OssCredentials | null {
  const region = process.env.OSS_REGION ?? '';
  const bucket = process.env.OSS_BUCKET ?? '';
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID ?? '';
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET ?? '';
  if (!region || !bucket || !accessKeyId || !accessKeySecret) return null;
  return {
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    prefix: process.env.OSS_PREFIX ?? 'moodpic/',
    expiresAt: Infinity,
  };
}

/** 从 arca API 获取 STS 临时凭证。 */
async function fetchStsCredentials(): Promise<OssCredentials> {
  const apiBase = process.env.ARCA_ORIGIN ?? '';
  const uid = process.env.OSS_CREDENTIAL_UID ?? '';
  if (!apiBase || !uid) {
    throw new CoverUploadError(
      'OSS 未配置：请设置 OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET（长期 AK），' +
        '或设置 ARCA_ORIGIN + OSS_CREDENTIAL_UID（STS 临时凭证）',
      500,
    );
  }

  // 1. 生成 JWT
  const jwtRes = await fetch(`${apiBase}/internal/tool/gen_jwt_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, expires_in: 3600 }),
  });
  const jwtJson = (await jwtRes.json()) as { code: number; msg: string; data?: { jwt_token: string } };
  if (jwtJson.code !== 0 || !jwtJson.data?.jwt_token) {
    throw new CoverUploadError(`生成 JWT 失败: ${jwtJson.msg}`, 500);
  }

  // 2. 获取 STS 凭证
  const credRes = await fetch(`${apiBase}/file/tos_credential`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtJson.data.jwt_token}`,
    },
    body: JSON.stringify({ expires_in: 3600 }),
  });
  const credJson = (await credRes.json()) as {
    code: number;
    msg: string;
    data?: {
      access_key_id: string;
      secret_access_key: string;
      session_token: string;
      bucket: string;
      region: string;
      expires_in: number;
    };
  };
  if (credJson.code !== 0 || !credJson.data) {
    throw new CoverUploadError(`获取 OSS 凭证失败: ${credJson.msg}`, 500);
  }

  const d = credJson.data;
  return {
    region: d.region.startsWith('oss-') ? d.region : `oss-${d.region}`,
    bucket: d.bucket,
    accessKeyId: d.access_key_id,
    accessKeySecret: d.secret_access_key,
    stsToken: d.session_token,
    prefix: process.env.OSS_PREFIX ?? 'moodpic/',
    expiresAt: Date.now() + (d.expires_in - 120) * 1000, // 提前 2 分钟刷新
  };
}

/** 获取可用的 OSS 凭证（优先长期 AK，否则 STS 自动获取/续期）。 */
async function getCredentials(): Promise<OssCredentials> {
  if (cached && Date.now() < cached.expiresAt) return cached;
  cached = tryStaticCredentials() ?? (await fetchStsCredentials());
  return cached;
}

// ==================== 图片解析与上传 ====================

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
  const cred = await getCredentials();
  const { buffer, mime } = parseDataUrl(input.dataUrl);
  const ext = MIME_EXT[mime];
  const subdir = input.subdir ?? 'style-cover/';
  const objectKey = `${cred.prefix}${subdir}${crypto.randomUUID()}.${ext}`;

  const client = new OSS({
    region: cred.region,
    accessKeyId: cred.accessKeyId,
    accessKeySecret: cred.accessKeySecret,
    stsToken: cred.stsToken,
    bucket: cred.bucket,
    secure: true,
  });
  const result = await client.put(objectKey, buffer, {
    mime,
    headers: { 'x-oss-object-acl': 'public-read', 'Cache-Control': 'public, max-age=31536000' },
  });

  return { url: result.url, objectKey };
}
