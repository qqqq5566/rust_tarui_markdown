import { useState, useCallback, useMemo } from 'react';
import type { TabState, DocumentStats } from '../types';

let nextId = 1;
function generateId(): string {
  return `tab-${nextId++}-${Date.now()}`;
}

function createTab(path: string | null, content: string): TabState {
  const title = path ? path.split(/[/\\]/).pop() || '未命名' : '未命名';
  return { id: generateId(), path, content, isModified: false, title };
}

function computeStats(content: string): DocumentStats {
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const chars = content.length;
  const words = content.length === 0
    ? 0
    : content.trim().split(/\s+/).filter(w => w.length > 0).length;
  return { wordCount: words, charCount: chars, lineCount: lines };
}

export function useTabs() {
  const [tabs, setTabs] = useState<TabState[]>([createTab(null, '')]);
  const [activeId, setActiveId] = useState<string>(tabs[0].id);

  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeId) || tabs[0],
    [tabs, activeId],
  );

  const stats = useMemo(() => computeStats(activeTab.content), [activeTab.content]);

  const updateActiveContent = useCallback((content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === activeId ? { ...t, content, isModified: true } : t,
    ));
  }, [activeId]);

  const updateActivePath = useCallback((path: string) => {
    const title = path.split(/[/\\]/).pop() || '未命名';
    setTabs(prev => prev.map(t =>
      t.id === activeId ? { ...t, path, title } : t,
    ));
  }, [activeId]);

  const markActiveClean = useCallback(() => {
    setTabs(prev => prev.map(t =>
      t.id === activeId ? { ...t, isModified: false } : t,
    ));
  }, [activeId]);

  const openNewTab = useCallback((path: string | null, content: string) => {
    const tab = createTab(path, content);
    setTabs(prev => [...prev, tab]);
    setActiveId(tab.id);
    return tab;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev; // 至少保留一个 tab
      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeId === tabId) {
        // 切换到相邻 tab
        const newIdx = Math.min(idx, next.length - 1);
        setActiveId(next[newIdx].id);
      }
      return next;
    });
  }, [activeId]);

  const switchTab = useCallback((tabId: string) => {
    setActiveId(tabId);
  }, []);

  // Replace active tab content (for file open)
  const replaceActiveTab = useCallback((path: string, content: string) => {
    const title = path.split(/[/\\]/).pop() || '未命名';
    setTabs(prev => prev.map(t =>
      t.id === activeId
        ? { ...t, path, content, title, isModified: false }
        : t,
    ));
  }, [activeId]);

  return {
    tabs,
    activeTab,
    activeId,
    stats,
    updateActiveContent,
    updateActivePath,
    markActiveClean,
    openNewTab,
    closeTab,
    switchTab,
    replaceActiveTab,
  };
}
