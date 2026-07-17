import { useEffect, useRef } from 'react';

/**
 * 编辑区 ↔ 预览区 双向滚动同步
 *
 * 使用滚动比例映射法：ratio = scrollTop / (scrollHeight - clientHeight)
 * isSyncing 互斥标志防止 A 滚动 → B 跟随 → B 的 scroll 事件触发 → A 再跟随的回环
 */
export function useScrollSync(
  getEditorScroller: () => HTMLElement | null | undefined,
  previewScrollRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const syncing = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const editorScroller = getEditorScroller();
    const previewEl = previewScrollRef.current;
    if (!editorScroller || !previewEl) return;

    const syncEditorToPreview = () => {
      if (syncing.current) return;
      syncing.current = true;

      const maxScroll = editorScroller.scrollHeight - editorScroller.clientHeight;
      const ratio = maxScroll > 0 ? editorScroller.scrollTop / maxScroll : 0;
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = ratio * previewMax;

      // scrollTop 赋值触发的 scroll 事件是异步的，用 rAF 延迟复位
      // 确保回弹的 scroll 事件能被 syncing 拦截
      requestAnimationFrame(() => {
        syncing.current = false;
      });
    };

    const syncPreviewToEditor = () => {
      if (syncing.current) return;
      syncing.current = true;

      const maxScroll = previewEl.scrollHeight - previewEl.clientHeight;
      const ratio = maxScroll > 0 ? previewEl.scrollTop / maxScroll : 0;
      const editorMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = ratio * editorMax;

      requestAnimationFrame(() => {
        syncing.current = false;
      });
    };

    editorScroller.addEventListener('scroll', syncEditorToPreview, { passive: true });
    previewEl.addEventListener('scroll', syncPreviewToEditor, { passive: true });

    return () => {
      editorScroller.removeEventListener('scroll', syncEditorToPreview);
      previewEl.removeEventListener('scroll', syncPreviewToEditor);
    };
  }, [getEditorScroller, previewScrollRef, enabled]);
}
