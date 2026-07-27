import { LanguageDescription } from '@codemirror/language';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import type { Extension } from '@codemirror/state';

/** Markdown 文件扩展名 */
const MARKDOWN_EXTS = new Set(['md', 'mdx', 'markdown', 'txt']);

/** 同步检测是否为 Markdown 文件（用于 UI 决策） */
export function isMarkdownFile(path: string | null): boolean {
  if (!path) return true; // 新文件默认 Markdown
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) return true;
  return MARKDOWN_EXTS.has(ext);
}

/** 异步加载文件对应的 CodeMirror 语言扩展 */
export async function loadLanguageExtension(
  path: string | null,
): Promise<Extension> {
  if (!path) {
    return markdown({ base: markdownLanguage, codeLanguages: languages });
  }

  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext || MARKDOWN_EXTS.has(ext)) {
    return markdown({ base: markdownLanguage, codeLanguages: languages });
  }

  // 尝试匹配语言
  const desc = LanguageDescription.matchFilename(languages, path);
  if (desc) {
    try {
      return await desc.load();
    } catch {
      // 加载失败，回退 Markdown
    }
  }

  // 未匹配到任何语言，回退 Markdown
  return markdown({ base: markdownLanguage, codeLanguages: languages });
}
