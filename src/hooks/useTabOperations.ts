import { useCallback } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { TabState } from '../types';

interface UseTabOperationsOptions {
  tabs: TabState[];
  activeId: string;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  openNewTab: (path: string | null, content: string, lastModified?: number | null) => TabState;
}

export function useTabOperations({
  tabs,
  activeId,
  switchTab,
  closeTab,
  openNewTab,
}: UseTabOperationsOptions) {
  const handleCloseTab = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isModified) {
      const ok = await confirm(
        `"${tab.title}" 有未保存的更改，确定关闭吗？`,
        { title: '关闭标签页', kind: 'warning' },
      );
      if (!ok) return;
    }
    closeTab(tabId);
  }, [tabs, closeTab]);

  const handleCloseOthers = useCallback(async (tabId: string) => {
    const others = tabs.filter(t => t.id !== tabId);
    const hasModified = others.some(t => t.isModified);
    if (hasModified) {
      const ok = await confirm(
        '有其他未保存的标签页，确定关闭吗？',
        { title: '关闭其他标签页', kind: 'warning' },
      );
      if (!ok) return;
    }
    if (activeId !== tabId) switchTab(tabId);
    others.forEach(t => closeTab(t.id));
  }, [tabs, activeId, switchTab, closeTab]);

  const handleCloseRight = useCallback(async (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    const right = tabs.slice(idx + 1);
    const hasModified = right.some(t => t.isModified);
    if (hasModified) {
      const ok = await confirm(
        '右侧有未保存的标签页，确定关闭吗？',
        { title: '关闭右侧标签页', kind: 'warning' },
      );
      if (!ok) return;
    }
    right.forEach(t => closeTab(t.id));
  }, [tabs, closeTab]);

  const handleCloseLeft = useCallback(async (tabId: string) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    const left = tabs.slice(0, idx);
    const hasModified = left.some(t => t.isModified);
    if (hasModified) {
      const ok = await confirm(
        '左侧有未保存的标签页，确定关闭吗？',
        { title: '关闭左侧标签页', kind: 'warning' },
      );
      if (!ok) return;
    }
    left.forEach(t => closeTab(t.id));
  }, [tabs, closeTab]);

  const handleCloseAll = useCallback(async () => {
    const modified = tabs.filter(t => t.isModified);
    if (modified.length > 0) {
      const names = modified.map(t => t.title).join(', ');
      const ok = await confirm(
        `以下标签页有未保存的更改：${names}，确定关闭全部吗？`,
        { title: '关闭全部标签页', kind: 'warning' },
      );
      if (!ok) return;
    }
    openNewTab(null, '');
    tabs.forEach(t => closeTab(t.id));
  }, [tabs, openNewTab, closeTab]);

  return {
    handleCloseTab,
    handleCloseOthers,
    handleCloseRight,
    handleCloseLeft,
    handleCloseAll,
  };
}
