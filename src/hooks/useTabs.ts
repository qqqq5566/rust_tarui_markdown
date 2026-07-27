import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { TabState, DocumentStats } from '../types';

// ── Session 持久化 ──────────────────────

interface SessionTab {
  path: string | null;
  content: string;
  isModified: boolean;
  title: string;
}

interface SessionData {
  tabs: SessionTab[];
  activeIndex: number;
}

const SESSION_KEY = 'editor-session';

function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tabs) || data.tabs.length === 0) return null;
    // 验证：如果只有一个空未修改的无路径标签页，视为无会话
    if (
      data.tabs.length === 1
      && !data.tabs[0].path
      && !data.tabs[0].content
      && !data.tabs[0].isModified
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function saveSession(tabs: TabState[], activeId: string) {
  // 如果只有一个空未修改的无路径标签页，不保存（等同于初始状态）
  if (
    tabs.length === 1
    && !tabs[0].path
    && !tabs[0].content
    && !tabs[0].isModified
  ) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  const activeIndex = tabs.findIndex(t => t.id === activeId);
  const data: SessionData = {
    tabs: tabs.map(t => ({
      path: t.path,
      content: t.content,
      isModified: t.isModified,
      title: t.title,
    })),
    activeIndex: activeIndex >= 0 ? activeIndex : 0,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

// ── ID / 工厂 ───────────────────────────

let nextId = 1;
function generateId(): string {
  return `tab-${nextId++}-${Date.now()}`;
}

function createTab(path: string | null, content: string, lastModified: number | null = null): TabState {
  const title = path ? path.split(/[/\\]/).pop() || '未命名' : '未命名';
  return { id: generateId(), path, content, isModified: false, title, lastModified };
}

function computeStats(content: string): DocumentStats {
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const chars = content.length;
  const words = content.length === 0
    ? 0
    : content.trim().split(/\s+/).filter(w => w.length > 0).length;
  return { wordCount: words, charCount: chars, lineCount: lines };
}

// ── Hook ─────────────────────────────────

export function useTabs() {
  // 用 ref 统一初始化，确保 tabs 和 activeId 使用相同的 ID
  const initialRef = useRef<{ tabs: TabState[]; activeId: string } | null>(null);
  if (!initialRef.current) {
    const session = loadSession();
    if (session) {
      // 从 session 恢复时不保留 lastModified，focus 时重新 stat
      const restored = session.tabs.map(tab => ({
        ...createTab(tab.path, tab.content),
        isModified: tab.isModified,
        title: tab.title,
        lastModified: null,
      }));
      const idx = session.activeIndex;
      const aid = (idx >= 0 && idx < restored.length) ? restored[idx].id : restored[0].id;
      initialRef.current = { tabs: restored, activeId: aid };
    } else {
      const defaultTabs = [createTab(null, '')];
      initialRef.current = { tabs: defaultTabs, activeId: defaultTabs[0].id };
    }
  }

  const [tabs, setTabs] = useState<TabState[]>(initialRef.current.tabs);
  const [activeId, setActiveId] = useState<string>(initialRef.current.activeId);

  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeId) || tabs[0],
    [tabs, activeId],
  );

  const stats = useMemo(() => computeStats(activeTab.content), [activeTab.content]);

  // ── 自动同步 session（200ms 防抖） ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSession(tabs, activeId);
    }, 200);
    return () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, [tabs, activeId]);

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

  const openNewTab = useCallback((path: string | null, content: string, lastModified: number | null = null) => {
    const tab = createTab(path, content, lastModified);
    setTabs(prev => [...prev, tab]);
    setActiveId(tab.id);
    return tab;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeId === tabId) {
        const newIdx = Math.min(idx, next.length - 1);
        setActiveId(next[newIdx].id);
      }
      return next;
    });
  }, [activeId]);

  const switchTab = useCallback((tabId: string) => {
    setActiveId(tabId);
  }, []);

  const replaceActiveTab = useCallback((path: string, content: string, lastModified?: number) => {
    const title = path.split(/[/\\]/).pop() || '未命名';
    setTabs(prev => prev.map(t =>
      t.id === activeId
        ? { ...t, path, content, title, isModified: false, lastModified: lastModified ?? null }
        : t,
    ));
  }, [activeId]);

  /** 更新当前活动标签页的文件修改时间 */
  const updateActiveMtime = useCallback((mtime: number) => {
    setTabs(prev => prev.map(t =>
      t.id === activeId ? { ...t, lastModified: mtime } : t,
    ));
  }, [activeId]);

  /** 更新指定标签页的内容 */
  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, isModified: false } : t,
    ));
  }, []);

  /** 更新指定标签页的 mtime */
  const updateTabMtime = useCallback((tabId: string, mtime: number) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, lastModified: mtime } : t,
    ));
  }, []);

  /** 更新指定标签页的路径和标题 */
  const updateTabPath = useCallback((tabId: string, newPath: string) => {
    const title = newPath.split(/[/\\]/).pop() || '未命名';
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, path: newPath, title } : t,
    ));
  }, []);

  /** 显式保存 session，供应用关闭时调用 */
  const persistSession = useCallback(() => {
    saveSession(tabs, activeId);
  }, [tabs, activeId]);

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
    persistSession,
    updateActiveMtime,
    updateTabContent,
    updateTabMtime,
    updateTabPath,
  };
}
