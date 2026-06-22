/**
 * 背景图下载工具。
 *
 * apimart 可能返回直链 url（跨域）或 base64。直链直接用 <a download> 在部分浏览器
 * 会因跨域被当作导航打开而非下载，因此统一先 fetch 成 blob 再触发下载。
 */

/** 触发浏览器下载一个 blob URL 或 dataURL。 */
function triggerDownload(href: string, fileName: string): void {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * 下载生成的背景图。
 * @param src 图片地址（http(s) 直链或 data:base64）
 * @param fileName 下载文件名
 */
export async function downloadImage(src: string, fileName: string): Promise<void> {
  if (src.startsWith('data:')) {
    triggerDownload(src, fileName);
    return;
  }

  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`下载失败（${res.status}）`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, fileName);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // 跨域 fetch 失败时退回直接用原链接（用户可右键另存）
    triggerDownload(src, fileName);
  }
}
