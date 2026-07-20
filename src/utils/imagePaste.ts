import { writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';

/** 生成时间戳文件名 */
export function timestampFileName(ext = 'png'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `image-${ts}.${ext}`;
}

/** 确保目录存在 */
async function ensureDir(dir: string): Promise<void> {
  try {
    const dirExists = await exists(dir);
    if (!dirExists) {
      await mkdir(dir);
    }
  } catch { /* ignore */ }
}

/**
 * 从剪贴板读取图片数据（Web API，返回 PNG/JPEG 原始字节）
 * 未找到图片返回 null
 */
export async function readImageFromClipboard(): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      // 优先 PNG
      for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
        if (item.types.includes(type)) {
          const blob = await item.getType(type);
          const buf = await blob.arrayBuffer();
          return { data: new Uint8Array(buf), mime: type };
        }
      }
      // fallback: any image/*
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const buf = await blob.arrayBuffer();
          return { data: new Uint8Array(buf), mime: type };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 保存图片到 assets 目录
 * @returns markdown 引用字符串
 */
export async function saveImageToAssets(
  imageData: Uint8Array,
  filePath: string,
  ext = 'png',
): Promise<string> {
  const parentDir = await dirname(filePath);
  const assetsDir = await join(parentDir, 'assets');
  await ensureDir(assetsDir);

  const fileName = timestampFileName(ext);
  const fullPath = await join(assetsDir, fileName);
  await writeFile(fullPath, imageData);

  return `![${fileName}](assets/${fileName})`;
}

/** Uint8Array → Base64 */
export function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/** 图片数据 → base64 data URI */
export function imageToBase64Markdown(data: Uint8Array, mime: string): string {
  const b64 = uint8ToBase64(data);
  return `![image](data:${mime};base64,${b64})`;
}

/** 从 mime type 提取扩展名 */
export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
  };
  return map[mime] || 'png';
}

/**
 * 扫描 markdown 中的 base64 图片，迁移到 assets 目录
 * 返回更新后的 markdown
 */
export async function migrateBase64Images(
  content: string,
  filePath: string,
): Promise<string> {
  const base64Regex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,([^)\s]+))\)/g;
  const replacements: Array<{ oldStr: string; newStr: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = base64Regex.exec(content)) !== null) {
    const [fullMatch, alt, , b64data] = match;
    try {
      const binaryStr = atob(b64data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const parentDir = await dirname(filePath);
      const assetsDir = await join(parentDir, 'assets');
      await ensureDir(assetsDir);

      const fileName = timestampFileName();
      const fullPath = await join(assetsDir, fileName);
      await writeFile(fullPath, bytes);

      replacements.push({ oldStr: fullMatch, newStr: `![${alt}](assets/${fileName})` });
    } catch { /* decode failed, keep base64 */ }
  }

  let result = content;
  for (const { oldStr, newStr } of replacements) {
    result = result.replace(oldStr, newStr);
  }
  return result;
}
