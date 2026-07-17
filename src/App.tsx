import { useState, useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { useMarkdown } from './hooks/useMarkdown';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import MarkdownEditor from './components/Editor/MarkdownEditor';
import type { MarkdownEditorAPI } from './components/Editor/MarkdownEditor';
import MarkdownPreview from './components/Preview/MarkdownPreview';
import Toolbar from './components/Toolbar/Toolbar';
import StatusBar from './components/StatusBar/StatusBar';

import type { EditorMode } from './types';
import styles from './App.module.css';

export default function App() {
  const [mode, setMode] = useState<EditorMode>('split');

  const { content, filePath, isModified, setContent, updateFilePath, markClean, resetFileState, stats } = useMarkdown();
  const { toggleTheme, isDark } = useTheme();
  const editorRef = useRef<MarkdownEditorAPI>(null);

  const handleFileOpened = useCallback(
    (newContent: string, path: string) => {
      resetFileState();
      // Need to set content and path without marking as modified
      setContent(newContent);
      updateFilePath(path);
      // Override the isModified that setContent set
      markClean();
    },
    [setContent, updateFilePath, markClean, resetFileState],
  );

  const handleFileSaved = useCallback(
    (path: string) => {
      updateFilePath(path);
      markClean();
    },
    [updateFilePath, markClean],
  );

  const { openFile, saveFile, saveFileAs, newFile } = useFileOperations({
    onFileOpened: handleFileOpened,
    onFileSaved: handleFileSaved,
  });

  // Update window title when file changes
  useEffect(() => {
    const filename = filePath
      ? filePath.split(/[/\\]/).pop() || '未命名'
      : '未命名';
    const modified = isModified ? ' •' : '';
    document.title = `${filename}${modified} - Rust Markdown 编辑器`;
  }, [filePath, isModified]);

  // Window close handling - check for unsaved changes
  useEffect(() => {
    const setupListener = async () => {
      const unlisten = await listen('close-requested', async () => {
        if (isModified) {
          const { confirm } = await import('@tauri-apps/plugin-dialog');
          const shouldClose = await confirm(
            '有未保存的更改，确定不保存就关闭吗？',
            { title: '未保存的更改', kind: 'warning' },
          );
          if (shouldClose) {
            await getCurrentWindow().destroy();
          }
        } else {
          await getCurrentWindow().destroy();
        }
      });
      return unlisten;
    };

    const promise = setupListener();
    return () => {
      promise.then(unlisten => unlisten());
    };
  }, [isModified]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'n') {
        e.preventDefault();
        if (isModified) {
          const { confirm } = await import('@tauri-apps/plugin-dialog');
          const shouldDiscard = await confirm(
            '有未保存的更改，确定丢弃吗？',
            { title: '新建文件', kind: 'warning' },
          );
          if (!shouldDiscard) return;
        }
        resetFileState();
        newFile();
      }

      if (ctrl && e.key === 'o') {
        e.preventDefault();
        if (isModified) {
          const { confirm } = await import('@tauri-apps/plugin-dialog');
          const shouldDiscard = await confirm(
            '有未保存的更改，确定打开其他文件吗？',
            { title: '打开文件', kind: 'warning' },
          );
          if (!shouldDiscard) return;
        }
        openFile();
      }

      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        await saveFile(content);
      }

      if (ctrl && e.key === 's' && e.shiftKey) {
        e.preventDefault();
        await saveFileAs(content);
      }

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
  }, [isModified, content, resetFileState, newFile, openFile, saveFile, saveFileAs, toggleTheme]);

  // Toolbar action handlers
  const handleNew = useCallback(async () => {
    if (isModified) {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const shouldDiscard = await confirm(
        '有未保存的更改，确定丢弃吗？',
        { title: '新建文件', kind: 'warning' },
      );
      if (!shouldDiscard) return;
    }
    resetFileState();
    newFile();
  }, [isModified, resetFileState, newFile]);

  const handleOpen = useCallback(async () => {
    if (isModified) {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const shouldDiscard = await confirm(
        '有未保存的更改，确定打开其他文件吗？',
        { title: '打开文件', kind: 'warning' },
      );
      if (!shouldDiscard) return;
    }
    openFile();
  }, [isModified, openFile]);

  const handleSave = useCallback(async () => {
    await saveFile(content);
  }, [content, saveFile]);

  const handleSaveAs = useCallback(async () => {
    await saveFileAs(content);
  }, [content, saveFileAs]);

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
        onToggleTheme={toggleTheme}
        onToggleMode={cycleMode}
        currentMode={mode}
        isDark={isDark}
        currentFilePath={filePath}
      />

      <div className={styles.mainArea}>
        <PanelGroup direction="horizontal" autoSaveId="editor-split-layout">
          <Panel
            defaultSize={50}
            minSize={20}
            className={!showEditor ? styles.hiddenPanel : undefined}
          >
            <MarkdownEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              isDark={isDark}
            />
          </Panel>

          {mode === 'split' && <PanelResizeHandle className={styles.resizeHandle} />}

          <Panel
            defaultSize={50}
            minSize={20}
            className={!showPreview ? styles.hiddenPanel : undefined}
          >
            <MarkdownPreview content={content} />
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar
        filePath={filePath}
        stats={stats}
        isModified={isModified}
      />
    </div>
  );
}
