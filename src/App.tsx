import { useState, useCallback, useEffect, useRef } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { confirm } from '@tauri-apps/plugin-dialog';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useTabs } from './hooks/useTabs';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import type { MarkdownEditorAPI } from './components/Editor/MarkdownEditor';
import SearchDialog from './components/Search/SearchDialog';
import MarkdownPreview from './components/Preview/MarkdownPreview';
import Toolbar from './components/Toolbar/Toolbar';
import TabBar from './components/TabBar/TabBar';
import StatusBar from './components/StatusBar/StatusBar';

import type { EditorMode } from './types';
import styles from './App.module.css';

export default function App() {
  const [mode, setMode] = useState<EditorMode>('split');

  const {
    tabs, activeTab, activeId, stats,
    updateActiveContent, updateActivePath, markActiveClean,
    openNewTab, closeTab, switchTab, replaceActiveTab,
  } = useTabs();
  const { toggleTheme, isDark } = useTheme();
  const editorRef = useRef<MarkdownEditorAPI>(null);

  // ── 自定义搜索对话框状态 ──
  const [searchDialog, setSearchDialog] = useState<{
    open: boolean;
    mode: 'find' | 'replace';
  }>({ open: false, mode: 'find' });

  // File operation callbacks
  const handleFileOpened = useCallback(
    (newContent: string, path: string) => {
      // If current tab is empty & unmodified, replace it
      const tab = activeTab;
      if (!tab.isModified && tab.content === '' && !tab.path) {
        replaceActiveTab(path, newContent);
      } else {
        openNewTab(path, newContent);
      }
    },
    [activeTab, replaceActiveTab, openNewTab],
  );

  const handleFileSaved = useCallback(
    (path: string) => {
      updateActivePath(path);
      markActiveClean();
    },
    [updateActivePath, markActiveClean],
  );

  const { openFile, saveFile, saveFileAs } = useFileOperations({
    onFileOpened: handleFileOpened,
    onFileSaved: handleFileSaved,
  });

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

  useEffect(() => {
    const p = listen('close-requested', async () => {
      const hasUnsaved = tabsRef.current.some(t => t.isModified);
      if (hasUnsaved) {
        const ok = await confirm(
          '有未保存的更改，确定不保存就关闭吗？',
          { title: '未保存的更改', kind: 'warning' },
        );
        if (ok) await emit('confirm-close');
      } else {
        await emit('confirm-close');
      }
    });
    return () => { p.then(fn => fn()); };
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
        setSearchDialog({ open: true, mode: 'find' });
      }
      // Ctrl+H → 打开替换对话框
      if (ctrl && e.key === 'h') {
        e.preventDefault();
        setSearchDialog({ open: true, mode: 'replace' });
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
  }, [activeId, openNewTab, openFile, saveFile, saveFileAs, closeTab, toggleTheme]);

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

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const modes: EditorMode[] = ['edit', 'preview', 'split'];
      const idx = modes.indexOf(prev);
      return modes[(idx + 1) % modes.length];
    });
  }, []);

  const showEditor = mode === 'edit' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';

  return (
    <div className={`${styles.app} ${isDark ? styles.dark : styles.light}`}>
      <Toolbar
        onNew={handleNew}
        onOpen={handleOpen}
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
        onSearch={() => setSearchDialog({ open: true, mode: 'find' })}
        onReplace={() => setSearchDialog({ open: true, mode: 'replace' })}
        onToggleTheme={toggleTheme}
        onToggleMode={cycleMode}
        currentMode={mode}
        isDark={isDark}
        currentFilePath={activeTab.path}
      />

      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSwitch={switchTab}
        onClose={handleCloseTab}
      />

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
            />
          </Panel>

          {mode === 'split' && <PanelResizeHandle className={styles.resizeHandle} />}

          <Panel
            defaultSize={50}
            minSize={20}
            className={!showPreview ? styles.hiddenPanel : undefined}
          >
            <MarkdownPreview content={activeTab.content} />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar
        filePath={activeTab.path}
        stats={stats}
        isModified={activeTab.isModified}
      />

      {/* ── Notepad++ 风格浮动搜索对话框 ── */}
      {searchDialog.open && editorRef.current?.getView() && (
        <SearchDialog
          view={editorRef.current!.getView()!}
          isDark={isDark}
          initialMode={searchDialog.mode}
          onClose={() => setSearchDialog(prev => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}
