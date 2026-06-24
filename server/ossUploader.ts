/**
 * MoodPic 服务端写链路：拉 apimart 临时直链 → 传阿里云 OSS → 登记 arca /moodpic/save。
 *
 * 为什么放服务端（参考 popop-rn scripts/cdn/upload.mjs 的 ali-oss 上传，但挪到后端）：
 *   1. OSS 长期 AccessKey 只在服务端进程，绝不进前端 bundle（避免 F12 泄露）。
 *   2. 服务端拉 apimart 图字节没有浏览器 CORS 限制。
 *
 * 配置全部来自环境变量（.env / K8s Secret），缺 key 时优雅降级：返回原始直链不落库，
 * 不阻断出图主流程（前端仍能看到图，只是没永久化）。
 */

import OSS from 'ali-oss';
import { randomUUID } from 'node:crypto';

export interface OssConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  /** 对象前缀，如 'moodpic/' */
  prefix: string;
}

/** 从环境变量读取 OSS 配置；任一必填项缺失返回 null（视为未启用）。 */
export function readOssConfig(): OssConfig | null {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID ?? '';
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET ?? '';
  const bucket = process.env.OSS_BUCKET ?? '';
  const region = process.env.OSS_REGION ?? 'oss-ap-northeast-1';
  const prefix = process.env.OSS_PREFIX ?? 'moodpic/';
  if (!accessKeyId || !accessKeySecret || !bucket) return null;
  return { region, bucket, accessKeyId, accessKeySecret, prefix };
}

/** 上传结果：OSS 对象信息（对齐 arca TOSObject 语义）。 */
export interface UploadedObject {
  bucketName: string;
  objectKey: string;
  /** 对象公网/内网直链（私有桶下不可直接渲染，仅登记用） */
  url: string;
}

let cachedClient: OSS | null = null;
let cachedKey = '';

/** 复用 OSS 客户端（配置不变则不重建）。 */
function getClient(cfg: OssConfig): OSS {
  const key = `${cfg.region}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new OSS({
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
  });
  cachedKey = key;
  return cachedClient;
}

/** 从 content-type 或 URL 推断文件扩展名，默认 png。 */
function guessExt(contentType: string | null, url: string): string {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  const m = url.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * 拉取远程图片字节并上传到 OSS。
 * @returns 上传后的对象信息
 */
export async function fetchAndUpload(
  cfg: OssConfig,
  sourceUrl: string,
): Promise<UploadedObject> {
  const resp = await fetch(sourceUrl);
  if (!resp.ok) {
    throw new Error(`拉取源图失败（${resp.status}）`);
  }
  const contentType = resp.headers.get('content-type');
  const buf = Buffer.from(await resp.arrayBuffer());
  const ext = guessExt(contentType, sourceUrl);
  const objectKey = `${cfg.prefix}${randomUUID()}.${ext}`;

  const client = getClient(cfg);
  const result = await client.put(objectKey, buf, {
    mime: contentType ?? `image/${ext}`,
  });

  return {
    bucketName: cfg.bucket,
    objectKey,
    url: result.url ?? '',
  };
}
