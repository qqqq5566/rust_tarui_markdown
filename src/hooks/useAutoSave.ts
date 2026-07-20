import { useEffect, useRef } from 'react';
import type { EditorSettings } from './useSettings';

/**
 * 自动保存钩子
 *
 * 防抖模式：每次 content 变化时重置定时器。
 * 定时器到期且 isModified 为 true 时触发保存。
 * 无路径的文件（新文件）跳过，不触发保存。
 */
export function useAutoSave(
  content: string,
  path: string | null,
  isModified: boolean,
  settings: EditorSettings,
  saveFile: (content: string, path: string | null) => Promise<boolean>,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedContentRef = useRef<string | null>(null);

  // 外部保存后同步记录，避免自动保存重复触发
  if (!isModified) {
    savedContentRef.current = content;
  }

  useEffect(() => {
    // 清除旧定时器
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 不需要自动保存的情况
    if (!settings.autoSave) return;
    if (!isModified) return;
    if (!path) return; // 新文件跳过
    if (!content) return;

    // 启动新定时器
    const ms = settings.autoSaveInterval * 1000;
    timerRef.current = setTimeout(() => {
      // 定时器到期时再次检查：内容自上次保存后是否有变化
      if (savedContentRef.current === content) return;
      savedContentRef.current = content;
      saveFile(content, path);
    }, ms);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, path, isModified, settings.autoSave, settings.autoSaveInterval, saveFile]);
}
