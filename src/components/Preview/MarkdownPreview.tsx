import { forwardRef, useMemo, useCallback, useState, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import ContextMenu from '../Editor/ContextMenu';
import type { ContextMenuItem } from '../Editor/ContextMenu';
import styles from './MarkdownPreview.module.css';

interface MarkdownPreviewProps {
  content: string;
}

// Configure marked once
marked.setOptions({
  gfm: true,
  breaks: true,
});

function renderMarkdown(content: string): string {
  const renderer = new marked.Renderer();

  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    try {
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
    } catch {
      const escaped = DOMPurify.sanitize(text);
      return `<pre><code class="hljs language-${language}">${escaped}</code></pre>`;
    }
  };

  const rawHtml = marked.parse(content, { renderer }) as string;
  return DOMPurify.sanitize(rawHtml);
}

// 复制文本到剪贴板（兼容非 HTTPS 环境如 Tauri webview）
function copyToClipboard(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    return success;
  } catch {
    return false;
  }
}

const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ content }, ref) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  const contentRef = useRef<HTMLDivElement>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const selection = window.getSelection();
    const hasSelection = selection !== null && selection.toString().trim().length > 0;

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: '复制选中内容',
          shortcut: 'Ctrl+C',
          disabled: !hasSelection,
          action: () => {
            if (hasSelection && selection) {
              copyToClipboard(selection.toString());
            }
          },
        },
        {
          label: '全选',
          shortcut: 'Ctrl+A',
          action: () => {
            const div = contentRef.current;
            if (!div) return;
            const range = document.createRange();
            range.selectNodeContents(div);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          },
        },
        {
          label: '复制全部内容',
          action: () => {
            const div = contentRef.current;
            if (div) {
              copyToClipboard(div.textContent || '');
            }
          },
        },
      ],
    });
  }, []);

  // 阻止预览中的链接点击导致页面跳转
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) {
        const { shell } = window as unknown as { shell?: { open: (url: string) => void } };
        if (shell?.open) {
          shell.open(href);
        }
      }
    }
  }, []);

  if (!content) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📄</div>
        <p>预览将显示在此处</p>
        <p className={styles.emptyHint}>在编辑器中输入 Markdown 即可预览</p>
      </div>
    );
  }

  return (
    <div ref={ref} className={styles.previewContainer}>
      <div
        ref={contentRef}
        className={styles.previewContent}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
});

export default MarkdownPreview;
