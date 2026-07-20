import { useEffect, useRef, useCallback } from 'react';
import { stat } from '@tauri-apps/plugin-fs';

interface UseFileWatcherOptions {
  tabs: Array<{ path: string; tabId: string; lastModified: number | null }>;
  onExternalChange: (path: string, tabId: string) => void;
}

/**
 * 检测文件外部修改（轮询 + 页面可见性优化）
 *
 * - 页面可见时：每 2 秒 stat 对比 mtime
 * - 页面隐藏时（切到其他程序）：暂停轮询，零开销
 * - 页面恢复可见时：立即检测一次
 * - window.focus 时：立即检测一次（双保险）
 *
 * stat() 仅读取文件元数据（不读内容），单次 <1ms，开销极低
 */
export function useFileWatcher({ tabs, onExternalChange }: UseFileWatcherOptions) {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const onExternalChangeRef = useRef(onExternalChange);
  onExternalChangeRef.current = onExternalChange;

  // 避免对同一文件重复弹窗
  const alertedRef = useRef<Set<string>>(new Set());

  const check = useCallback(async () => {
    const currentTabs = tabsRef.current;
    for (const tab of currentTabs) {
      try {
        const info = await stat(tab.path);
        if (!info.mtime) continue;
        const mtime = info.mtime.getTime();

        if (tab.lastModified === null) continue; // 补录由 App.tsx focus handler 负责

        if (mtime !== tab.lastModified) {
          if (!alertedRef.current.has(tab.path)) {
            alertedRef.current.add(tab.path);
            onExternalChangeRef.current(tab.path, tab.tabId);
          }
        } else {
          alertedRef.current.delete(tab.path); // 已恢复一致，允许下次再提示
        }
      } catch { /* 文件可能被删除 */ }
    }
  }, []);

  // 路径变化时补录 mtime 不在此处处理（由 App.tsx 负责）
  const pathsKey = tabs.map(t => t.path).sort().join('|');

  useEffect(() => {
    if (tabs.length === 0) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const startPolling = () => {
      if (cancelled || interval !== null) return;
      interval = setInterval(() => { if (!cancelled) check(); }, 2000);
    };

    const stopPolling = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    // 页面可见性管理
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        check();        // 恢复可见时立即检测
        startPolling();
      }
    };

    // 窗口聚焦时立即检测
    const handleFocus = () => {
      if (!document.hidden) check();
    };

    // 初始状态
    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pathsKey, check]);
}
