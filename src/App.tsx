import { useState, useCallback, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/plugin-dialog';
import { stat, readTextFile } from '@tauri-apps/plugin-fs';
import { useFileWatcher } from './hooks/useFileWatcher';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useTabs } from './hooks/useTabs';
import { useFolder } from './hooks/useFolder';
import { useTabOperations } from './hooks/useTabOperations';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { useScrollSync } from './hooks/useScrollSync';
import { useSettings } from './hooks/useSettings';
import { useAutoSave } from './hooks/useAutoSave';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import type { MarkdownEditorAPI } from './components/Editor/MarkdownEditor';
import SearchDialog from './components/Search/SearchDialog';
import MarkdownPreview from './components/Preview/MarkdownPreview';
import FileExplorerPanel from './components/FileExplorer/FileExplorerPanel';
import Toolbar from './components/Toolbar/Toolbar';
import TabBar from './components/TabBar/TabBar';
import StatusBar from './components/StatusBar/StatusBar';

import type { EditorMode } from './types';
import { isMarkdownFile } from './utils/languageLoader';
import styles from './App.module.css';

export default function App() {
  const [mode, setMode] = useState<EditorMode>('edit');

  const {
    tabs, activeTab, activeId, stats,
    updateActiveContent, updateActivePath, markActiveClean,
    openNewTab, closeTab, switchTab, replaceActiveTab,
    persistSession,
    updateTabContent, updateTabMtime, updateActiveMtime, updateTabPath,
  } = useTabs();
  const { toggleTheme, isDark } = useTheme();
  const editorRef = useRef<MarkdownEditorAPI>(null);

  // ── 标签页切换时保存/恢复滚动位置 ──
  const scrollCache = useRef<Record<string, number>>({});
  const previewScrollCache = useRef<Record<string, number>>({});

  const handleSwitchTab = useCallback((tabId: string) => {
    // 保存当前编辑器和预览的滚动位置
    const view = editorRef.current?.getView();
    if (view && activeId) {
      scrollCache.current[activeId] = view.scrollDOM.scrollTop;
    }
    if (previewScrollRef.current && activeId) {
      previewScrollCache.current[activeId] = previewScrollRef.current.scrollTop;
    }
    switchTab(tabId);
  }, [activeId, switchTab]);

  // 切换标签页后恢复编辑器滚动位置
  useEffect(() => {
    const saved = scrollCache.current[activeId];
    if (saved === undefined) return;
    // 等 CodeMirror 完成内部布局后再设置滚动位置
    const timer = setTimeout(() => {
      const view = editorRef.current?.getView();
      if (view) {
        view.requestMeasure({
          read() { /* no-op */ },
          write() {
            view.scrollDOM.scrollTop = saved;
          },
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeId]);

  // 切换标签页后恢复预览滚动位置
  useEffect(() => {
    const saved = previewScrollCache.current[activeId];
    if (saved === undefined) return;
    const id = requestAnimationFrame(() => {
      if (previewScrollRef.current) {
        previewScrollRef.current.scrollTop = saved;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [activeId]);

  // ── 自定义搜索对话框状态 ──
  const [searchDialog, setSearchDialog] = useState<{
    open: boolean;
    mode: 'find' | 'replace';
  }>({ open: false, mode: 'find' });

  /** 打开搜索对话框，如果在纯预览模式则自动切换到分屏 */
  const openSearchDialog = useCallback((dialogMode: 'find' | 'replace') => {
    setMode(prev => (prev === 'preview' ? 'split' : prev));
    setSearchDialog({ open: true, mode: dialogMode });
  }, []);

  // ── 设置 & 自动保存 ──
  const { settings, updateSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = useCallback(() => setSettingsOpen(prev => !prev), []);

  // ── 编辑区 ↔ 预览区 滚动同步 ──
  const previewScrollRef = useRef<HTMLDivElement>(null);
  useScrollSync(
    () => editorRef.current?.getView()?.scrollDOM,
    previewScrollRef,
    mode === 'split',
  );

  // ── 文件夹功能 ──
  const {
    folderPath,
    fileTree,
    expandedPaths,
    loadingPaths,
    sidebarVisible,
    handleOpenFolder,
    handleToggleFolder,
    handleOpenFileFromTree,
    handleCloseFolder,
    handleRefreshTree,
    handleDeleteFile,
    handleRenameFile,
    handleNewFile,
    handleNewFolder,
  } = useFolder({
    tabs,
    activeTab,
    switchTab,
    replaceActiveTab,
    openNewTab,
    closeTab,
    updateTabPath,
  });
  const handleFileOpened = useCallback(
    async (newContent: string, path: string) => {
      // 检查文件是否已在其他标签页中打开
      const existing = tabs.find(t => t.path === path);
      if (existing) {
        switchTab(existing.id);
        return;
      }

      // 获取文件 mtime
      let mtime: number | undefined;
      try {
        const info = await stat(path);
        if (info.mtime) mtime = info.mtime.getTime();
      } catch { /* ignore */ }

      // If current tab is empty & unmodified, replace it
      const tab = activeTab;
      if (!tab.isModified && tab.content === '' && !tab.path) {
        replaceActiveTab(path, newContent, mtime);
      } else {
        openNewTab(path, newContent, mtime ?? null);
      }
    },
    [tabs, activeTab, switchTab, replaceActiveTab, openNewTab, updateActiveMtime],
  );

  const handleFileSaved = useCallback(
    async (path: string) => {
      updateActivePath(path);
      markActiveClean();
      // 保存后更新 mtime
      try {
        const info = await stat(path);
        if (info.mtime) updateActiveMtime(info.mtime.getTime());
      } catch { /* ignore */ }
    },
    [updateActivePath, markActiveClean, updateActiveMtime],
  );

  const { openFile, saveFile, saveFileAs, error: fileError, clearError: clearFileError } = useFileOperations({
    onFileOpened: handleFileOpened,
    onFileSaved: handleFileSaved,
  });

  // 文件操作错误自动消失
  useEffect(() => {
    if (!fileError) return;
    const timer = setTimeout(clearFileError, 5000);
    return () => clearTimeout(timer);
  }, [fileError, clearFileError]);

  // ── 自动保存 ──
  useAutoSave(
    activeTab.content,
    activeTab.path,
    activeTab.isModified,
    settings,
    saveFile,
  );

  // Update window title
  useEffect(() => {
    const filename = activeTab.title;
    const modified = activeTab.isModified ? ' •' : '';
    document.title = `${filename}${modified} - Rust Markdown 编辑器`;
  }, [activeTab.title, activeTab.isModified]);

  // 切换标签页时关闭搜索对话框（因为 EditorView 引用变化了）
  useEffect(() => {
    setSearchDialog(prev => prev.open ? { open: false, mode: 'find' } : prev);
  }, [activeId]);

  // Window close — check all tabs
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // 避免闭包陷阱：persistSession 随 tabs/activeId 变化，用 ref 保持最新引用
  const persistRef = useRef(persistSession);
  persistRef.current = persistSession;

  useEffect(() => {
    const p = listen('close-requested', async () => {
      const hasUnsaved = tabsRef.current.some(t => t.isModified);
      if (hasUnsaved) {
        const ok = await confirm(
          '有未保存的更改，确定不保存就关闭吗？',
          { title: '未保存的更改', kind: 'warning' },
        );
        if (ok) {
          // 关闭前保存会话，下次启动恢复
          persistRef.current();
          await emit('confirm-close');
        }
      } else {
        persistRef.current();
        await emit('confirm-close');
      }
    });
    return () => { p.then(fn => fn()); };
  }, []);

  // ── OS 级文件监控：检测外部修改 ──
  const handleExternalChange = useCallback(async (path: string, tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const ok = await confirm(
      `"${tab.title}" 已被外部程序修改，是否重新加载？`,
      { title: '文件已更改', kind: 'warning' },
    );
    if (!ok) {
      // 拒绝后更新 mtime，下次仍能检测
      try {
        const info = await stat(path);
        if (info.mtime) updateTabMtime(tabId, info.mtime.getTime());
      } catch { /* ignore */ }
      return;
    }

    // 重新加载
    try {
      const content = await readTextFile(path);
      updateTabContent(tabId, content);
      const info = await stat(path);
      if (info.mtime) updateTabMtime(tabId, info.mtime.getTime());
    } catch {
      // 读取失败
    }
  }, [tabs, updateTabContent, updateTabMtime]);

  // 构建 watcher 所需的 tab 列表（仅包括有路径的）
  const watchedTabs = tabs
    .filter(t => t.path !== null)
    .map(t => ({ path: t.path!, tabId: t.id, lastModified: t.lastModified }));

  useFileWatcher({
    tabs: watchedTabs,
    onExternalChange: handleExternalChange,
  });

  // ── 窗口聚焦时补录 session 恢复的 mtime ──
  const focusHandlersRef = useRef({ updateTabMtime });
  focusHandlersRef.current = { updateTabMtime };

  const tabsWithNullMtimeRef = useRef(tabs);
  tabsWithNullMtimeRef.current = tabs;

  useEffect(() => {
    const handleFocus = async () => {
      const { updateTabMtime } = focusHandlersRef.current;
      for (const tab of tabsWithNullMtimeRef.current) {
        if (!tab.path || tab.lastModified !== null) continue;
        try {
          const info = await stat(tab.path);
          if (info.mtime) updateTabMtime(tab.id, info.mtime.getTime());
        } catch { /* ignore */ }
      }
    };
    // 首次挂载时立即补录（窗口已聚焦，不会触发 focus 事件）
    handleFocus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Global keyboard shortcuts
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const t = activeTabRef.current;

      if (ctrl && e.key === 'n') {
        e.preventDefault();
        openNewTab(null, '');
      }
      if (ctrl && e.key === 'o') {
        e.preventDefault();
        openFile();
      }
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        await saveFile(t.content, t.path);
      }
      if (ctrl && e.key === 's' && e.shiftKey) {
        e.preventDefault();
        await saveFileAs(t.content);
      }
      if (ctrl && e.key === 'w') {
        e.preventDefault();
        if (tabsRef.current.length <= 1) return; // 最后一个 tab 不关闭
        if (t.isModified) {
          const ok = await confirm(
            `"${t.title}" 有未保存的更改，确定关闭吗？`,
            { title: '关闭标签页', kind: 'warning' },
          );
          if (!ok) return;
        }
        closeTab(activeId);
      }
      // Ctrl+F → 打开搜索对话框
      if (ctrl && e.key === 'f') {
        e.preventDefault();
        openSearchDialog('find');
      }
      // Ctrl+H → 打开替换对话框
      if (ctrl && e.key === 'h') {
        e.preventDefault();
        openSearchDialog('replace');
      }
      // F3 → 查找下一个（委托给 SearchDialog 内部处理）
      // Shift+F3 → 查找上一个（委托给 SearchDialog 内部处理）
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setMode(prev => {
          const modes: EditorMode[] = ['edit', 'preview', 'split'];
          const idx = modes.indexOf(prev);
          return modes[(idx + 1) % modes.length];
        });
      }
      if (ctrl && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeId, openNewTab, openFile, saveFile, saveFileAs, closeTab, toggleTheme, openSearchDialog]);

  // Toolbar handlers
  const handleNew = useCallback(() => {
    openNewTab(null, '');
  }, [openNewTab]);

  const handleOpen = useCallback(() => {
    openFile();
  }, [openFile]);

  const handleSave = useCallback(async () => {
    await saveFile(activeTab.content, activeTab.path);
  }, [activeTab, saveFile]);

  const handleSaveAs = useCallback(async () => {
    await saveFileAs(activeTab.content);
  }, [activeTab, saveFileAs]);

  // ── 标签页操作 ──
  const {
    handleCloseTab,
    handleCloseOthers,
    handleCloseRight,
    handleCloseLeft,
    handleCloseAll,
  } = useTabOperations({ tabs, activeId, switchTab, closeTab, openNewTab });

  const currentIsMarkdown = isMarkdownFile(activeTab.path);

  const cycleMode = useCallback(() => {
    if (!currentIsMarkdown) return;
    setMode(prev => {
      const modes: EditorMode[] = ['edit', 'preview', 'split'];
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, [currentIsMarkdown]);

  // ── 侧边栏拖拽调整宽度 ──
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const sidebarResizing = useRef(false);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(180, Math.min(500, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      sidebarResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const showEditor = mode === 'edit' || mode === 'split';
  const showPreview = currentIsMarkdown && (mode === 'preview' || mode === 'split');

  // ── Layout: 构建侧边栏和编辑器区域 ──
  const sidebar = sidebarVisible && folderPath ? (
    <>
      <div style={{ width: sidebarWidth, flexShrink: 0, height: '100%' }}>
        <FileExplorerPanel
          folderPath={folderPath}
          fileTree={fileTree}
          expandedPaths={expandedPaths}
          loadingPaths={loadingPaths}
          selectedPath={activeTab.path}
          onToggleFolder={handleToggleFolder}
          onOpenFile={handleOpenFileFromTree}
          onCloseFolder={handleCloseFolder}
          onRefresh={handleRefreshTree}
          onDelete={handleDeleteFile}
          onRename={handleRenameFile}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
        />
      </div>
      <div
        className={styles.resizeHandle}
        onMouseDown={handleSidebarResizeStart}
        style={{ cursor: 'col-resize' }}
      />
    </>
  ) : null;

  return (
    <div className={`${styles.app} ${isDark ? styles.dark : styles.light}`}>
      <Toolbar
        onNew={handleNew}
        onOpen={handleOpen}
        onOpenFolder={handleOpenFolder}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onBold={() => editorRef.current?.toggleBold()}
        onItalic={() => editorRef.current?.toggleItalic()}
        onStrikethrough={() => editorRef.current?.toggleStrikethrough()}
        onHeading={() => editorRef.current?.toggleHeading()}
        onCodeBlock={() => editorRef.current?.toggleCodeBlock()}
        onInlineCode={() => editorRef.current?.toggleInlineCode()}
        onUnorderedList={() => editorRef.current?.toggleUnorderedList()}
        onOrderedList={() => editorRef.current?.toggleOrderedList()}
        onBlockquote={() => editorRef.current?.toggleBlockquote()}
        onLink={() => editorRef.current?.toggleLink()}
        onImage={() => editorRef.current?.toggleImage()}
        onSearch={() => openSearchDialog('find')}
        onReplace={() => openSearchDialog('replace')}
        onToggleTheme={toggleTheme}
        onToggleMode={cycleMode}
        currentMode={mode}
        isDark={isDark}
        isMarkdown={currentIsMarkdown}
        currentFilePath={activeTab.path}
        settings={settings}
        onUpdateSettings={updateSettings}
        settingsOpen={settingsOpen}
        onToggleSettings={toggleSettings}
      />

      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSwitch={handleSwitchTab}
        onClose={handleCloseTab}
        onCloseOthers={handleCloseOthers}
        onCloseRight={handleCloseRight}
        onCloseLeft={handleCloseLeft}
        onCloseAll={handleCloseAll}
      />

      <div className={styles.contentArea}>
        {sidebar}
        <div className={styles.editorArea}>
          <div className={styles.mainArea}>
            <PanelGroup direction="horizontal" autoSaveId="editor-split-layout">
              <Panel
                defaultSize={50}
                minSize={20}
                className={!showEditor ? styles.hiddenPanel : undefined}
              >
                <MarkdownEditor
                  key={activeId}
                  ref={editorRef}
                  value={activeTab.content}
                  onChange={updateActiveContent}
                  isDark={isDark}
                  currentPath={activeTab.path}
                />
              </Panel>

              {mode === 'split' && <PanelResizeHandle className={styles.resizeHandle} />}

              <Panel
                defaultSize={50}
                minSize={20}
                className={!showPreview ? styles.hiddenPanel : undefined}
              >
                <MarkdownPreview ref={previewScrollRef} content={activeTab.content} />
              </Panel>
            </PanelGroup>
          </div>

          <StatusBar
            filePath={activeTab.path}
            stats={stats}
            isModified={activeTab.isModified}
          />
        </div>
      </div>

      {/* ── Notepad++ 风格浮动搜索对话框 ── */}
      {searchDialog.open && editorRef.current?.getView() && (
        <SearchDialog
          view={editorRef.current!.getView()!}
          isDark={isDark}
          initialMode={searchDialog.mode}
          onClose={() => setSearchDialog(prev => ({ ...prev, open: false }))}
        />
      )}

      {/* ── 文件操作错误提示 ── */}
      {fileError && (
        <div className={styles.errorToast} role="alert">
          <span>{fileError}</span>
          <button className={styles.errorClose} onClick={clearFileError}>✕</button>
        </div>
      )}
    </div>
  );
}
