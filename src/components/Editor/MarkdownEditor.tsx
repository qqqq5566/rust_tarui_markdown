import { forwardRef, useImperativeHandle, useCallback, useRef, useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { loadLanguageExtension } from '../../utils/languageLoader';
import ContextMenu from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import {
  IconLink, IconImage, IconTable, IconVideo,
} from '../Icons';
import {
  readImageFromClipboard, saveImageToAssets,
  imageToBase64Markdown, mimeToExt,
} from '../../utils/imagePaste';
import styles from './MarkdownEditor.module.css';

export interface MarkdownEditorAPI {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleStrikethrough: () => void;
  toggleHeading: () => void;
  toggleCodeBlock: () => void;
  toggleInlineCode: () => void;
  toggleUnorderedList: () => void;
  toggleOrderedList: () => void;
  toggleBlockquote: () => void;
  toggleLink: () => void;
  toggleImage: () => void;
  /** 获取底层 CodeMirror EditorView 实例，供外部搜索等操作使用 */
  getView: () => EditorView | null;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  /** 当前文件路径，用于图片粘贴保存到 assets/ 目录 */
  currentPath: string | null;
}

function insertFormatting(
  view: EditorView,
  wrapper: string,
  placeholder: string = '',
  prefixOnly: boolean = false,
  suffix: string = '',
): boolean {
  const { state } = view;
  const selection = state.selection.main;
  const selectedText = state.sliceDoc(selection.from, selection.to);

  // Use suffix if provided, otherwise symmetric (suffix = wrapper)
  const endMarker = suffix || wrapper;
  const isAsymmetric = suffix !== '' && suffix !== wrapper;

  let newText: string;
  let cursorOffset: number;

  if (selectedText) {
    if (prefixOnly) {
      newText = wrapper + selectedText;
      cursorOffset = wrapper.length + selectedText.length;
    } else if (selectedText.startsWith(wrapper) && selectedText.endsWith(endMarker)) {
      // Unwrap: remove both markers
      newText = selectedText.slice(wrapper.length, -endMarker.length);
      cursorOffset = newText.length;
    } else {
      // Wrap: add markers around selection
      newText = wrapper + selectedText + endMarker;
      cursorOffset = wrapper.length + selectedText.length + endMarker.length;
    }
  } else {
    if (prefixOnly) {
      newText = wrapper + placeholder;
      cursorOffset = wrapper.length + placeholder.length;
    } else if (isAsymmetric) {
      // Asymmetric: prefix + placeholder + suffix (no double-wrapping)
      newText = wrapper + placeholder + endMarker;
      cursorOffset = wrapper.length + placeholder.length;
    } else {
      // Symmetric: wrapper + placeholder + wrapper
      newText = wrapper + placeholder + wrapper;
      cursorOffset = wrapper.length + placeholder.length;
    }
  }

  const from = selection.from;
  const to = selection.to;
  view.dispatch({
    changes: { from, to, insert: newText },
    selection: { anchor: from + cursorOffset },
  });

  view.focus();
  return true;
}

const MarkdownEditor = forwardRef<MarkdownEditorAPI, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, isDark, currentPath }, ref) {
    const editorRef = useRef<EditorView | null>(null);
    // 保持最新 path 引用，避免 extensions 闭包陈旧
    const pathRef = useRef(currentPath);
    pathRef.current = currentPath;

    // 根据文件路径异步加载语言扩展
    const [languageExtension, setLanguageExtension] = useState<Extension | null>(null);
    useEffect(() => {
      let cancelled = false;
      loadLanguageExtension(currentPath).then(ext => {
        if (!cancelled) setLanguageExtension(ext);
      });
      return () => { cancelled = true; };
    }, [currentPath]);

    const getView = useCallback((): EditorView | null => {
      return editorRef.current;
    }, []);

    useImperativeHandle(ref, () => ({
      // ── 格式化操作 ──
      toggleBold: () => {
        const view = getView();
        if (view) insertFormatting(view, '**', '加粗文本');
      },
      toggleItalic: () => {
        const view = getView();
        if (view) insertFormatting(view, '*', '斜体文本');
      },
      toggleStrikethrough: () => {
        const view = getView();
        if (view) insertFormatting(view, '~~', '删除线');
      },
      toggleHeading: () => {
        const view = getView();
        if (view) insertFormatting(view, '## ', '标题', true);
      },
      toggleCodeBlock: () => {
        const view = getView();
        if (view) insertFormatting(view, '```\n', '代码', false);
      },
      toggleInlineCode: () => {
        const view = getView();
        if (view) insertFormatting(view, '`', '行内代码');
      },
      toggleUnorderedList: () => {
        const view = getView();
        if (view) insertFormatting(view, '- ', '列表项', true);
      },
      toggleOrderedList: () => {
        const view = getView();
        if (view) insertFormatting(view, '1. ', '列表项', true);
      },
      toggleBlockquote: () => {
        const view = getView();
        if (view) insertFormatting(view, '> ', '引用', true);
      },
      toggleLink: () => {
        const view = getView();
        if (view) insertFormatting(view, '[', '链接文本', false, '](url)');
      },
      toggleImage: () => {
        const view = getView();
        if (view) insertFormatting(view, '![', '图片描述', false, '](url)');
      },
      // ── 暴露 EditorView 供 SearchDialog 等外部使用 ──
      getView,
    }), [getView]);

    const handleChange = useCallback(
      (val: string) => {
        onChange(val);
      },
      [onChange],
    );

    const handleEditorCreated = useCallback((view: EditorView) => {
      editorRef.current = view;
    }, []);

    const darkTheme = EditorView.theme(
      {
        '&': {
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          height: '100%',
        },
        '.cm-content': {
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: '14px',
          lineHeight: '1.7',
          padding: '16px',
        },
        '.cm-gutters': {
          backgroundColor: '#1e1e1e',
          color: '#858585',
          border: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#222325',
        },
        '.cm-activeLine': {
          backgroundColor: '#222325',
        },
        '.cm-cursor': {
          borderLeftColor: '#d4d4d4',
        },
        '.cm-selectionBackground': {
          backgroundColor: '#409cdb',
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#409cdb',
        },
        // 匹配高亮
        '.cm-selectionMatch': {
          backgroundColor: '#4a5568',
          borderBottom: '1px solid #718096',
        },
        // 移除 Markdown 语法元素的背景色，避免与选中混淆
        '.cm-heading': {
          color: '#569cd6',
          fontWeight: 'bold',
          backgroundColor: 'transparent',
        },
        '.cm-formatting': {
          backgroundColor: 'transparent',
        },
        '.cm-formatting-header': {
          color: '#808080',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-list': {
          color: '#d4d4d4',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-code': {
          backgroundColor: 'transparent',
        },
        '.cm-formatting-quote': {
          color: '#808080',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-link': {
          color: '#808080',
          backgroundColor: 'transparent',
        },
        '.cm-url': {
          color: '#6a9955',
          backgroundColor: 'transparent',
        },
        '.cm-link': {
          color: '#569cd6',
          backgroundColor: 'transparent',
        },
        '.cm-quote': {
          color: '#ce9178',
          backgroundColor: 'transparent',
        },
        '.cm-monospace': {
          backgroundColor: 'transparent',
        },
        '.cm-strikethrough': {
          backgroundColor: 'transparent',
        },
        '.cm-emphasis': {
          backgroundColor: 'transparent',
        },
        '.cm-strong': {
          backgroundColor: 'transparent',
        },
      },
      { dark: true },
    );

    const lightTheme = EditorView.theme(
      {
        '&': {
          backgroundColor: '#ffffff',
          color: '#333333',
          height: '100%',
        },
        '.cm-content': {
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: '14px',
          lineHeight: '1.7',
          padding: '16px',
        },
        '.cm-gutters': {
          backgroundColor: '#fafafa',
          color: '#999999',
          border: 'none',
        },
        '.cm-activeLineGutter': {
          backgroundColor: '#f5f5f5',
        },
        '.cm-activeLine': {
          backgroundColor: '#fafbff',
        },
        '.cm-cursor': {
          borderLeftColor: '#333333',
        },
        '.cm-selectionBackground': {
          backgroundColor: '#409cdb',
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: '#409cdb',
        },
        // 匹配高亮
        '.cm-selectionMatch': {
          backgroundColor: '#c8e6c9',
          borderBottom: '1px solid #81c784',
        },
        // 移除 Markdown 语法元素的背景色，避免与选中混淆
        '.cm-heading': {
          color: '#2563eb',
          fontWeight: 'bold',
          backgroundColor: 'transparent',
        },
        '.cm-formatting': {
          backgroundColor: 'transparent',
        },
        '.cm-formatting-header': {
          color: '#999999',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-list': {
          color: '#333333',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-code': {
          backgroundColor: 'transparent',
        },
        '.cm-formatting-quote': {
          color: '#999999',
          backgroundColor: 'transparent',
        },
        '.cm-formatting-link': {
          color: '#999999',
          backgroundColor: 'transparent',
        },
        '.cm-url': {
          color: '#059669',
          backgroundColor: 'transparent',
        },
        '.cm-link': {
          color: '#2563eb',
          backgroundColor: 'transparent',
        },
        '.cm-quote': {
          color: '#9333ea',
          backgroundColor: 'transparent',
        },
        '.cm-monospace': {
          backgroundColor: 'transparent',
        },
        '.cm-strikethrough': {
          backgroundColor: 'transparent',
        },
        '.cm-emphasis': {
          backgroundColor: 'transparent',
        },
        '.cm-strong': {
          backgroundColor: 'transparent',
        },
      },
      { dark: false },
    );

    const editorAPI = useRef({
      toggleBold: () => {
        const view = getView();
        if (view) insertFormatting(view, '**', '加粗文本');
      },
      toggleItalic: () => {
        const view = getView();
        if (view) insertFormatting(view, '*', '斜体文本');
      },
      toggleHeading: () => {
        const view = getView();
        if (view) insertFormatting(view, '## ', '标题', true);
      },
      toggleCodeBlock: () => {
        const view = getView();
        if (view) insertFormatting(view, '```\n', '代码', false);
      },
      toggleLink: () => {
        const view = getView();
        if (view) insertFormatting(view, '[', '链接文本', false, '](url)');
      },
      toggleImage: () => {
        const view = getView();
        if (view) insertFormatting(view, '![', '图片描述', false, '](url)');
      },
    });

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
      items: ContextMenuItem[];
    } | null>(null);

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        const view = getView();
        if (!view) return;

        const hasSelection = !view.state.selection.main.empty;
        const selectedText = view.state.sliceDoc(
          view.state.selection.main.from,
          view.state.selection.main.to,
        );

        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              label: '剪切',
              shortcut: 'Ctrl+X',
              disabled: !hasSelection,
              action: () => {
                if (hasSelection) {
                  navigator.clipboard.writeText(selectedText);
                  view.dispatch(view.state.replaceSelection(''));
                }
              },
            },
            {
              label: '复制',
              shortcut: 'Ctrl+C',
              disabled: !hasSelection,
              action: () => {
                if (hasSelection) {
                  navigator.clipboard.writeText(selectedText);
                }
              },
            },
            {
              label: '粘贴',
              shortcut: 'Ctrl+V',
              action: async () => {
                try {
                  // 优先尝试图片粘贴
                  const img = await readImageFromClipboard();
                  if (img) {
                    const fp = pathRef.current;
                    let md: string;
                    if (fp) {
                      const ext = mimeToExt(img.mime);
                      md = await saveImageToAssets(img.data, fp, ext);
                    } else {
                      md = imageToBase64Markdown(img.data, img.mime);
                    }
                    // 末尾加换行，光标跳到新行
                    const insert = md + '\n';
                    const from = view.state.selection.main.from;
                    view.dispatch({
                      changes: { from, to: view.state.selection.main.to, insert },
                      selection: { anchor: from + insert.length },
                    });
                    return;
                  }
                  // fallback: 文本粘贴
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    view.dispatch(view.state.replaceSelection(text));
                  }
                } catch {
                  // clipboard read failed, ignore
                }
              },
            },
            { label: '', divider: true, action: () => {} },
            // ── 插入功能 ──
            {
              label: '插入表格',
              icon: <IconTable size={14} />,
              action: () => {
                const table =
                  '| 列1 | 列2 | 列3 |\n'
                  + '| --- | --- | --- |\n'
                  + '| 内容 | 内容 | 内容 |\n';
                view.dispatch(view.state.replaceSelection(table));
                view.focus();
              },
            },
            {
              label: '插入链接',
              shortcut: 'Ctrl+Shift+L',
              icon: <IconLink size={14} />,
              action: () => {
                insertFormatting(view, '[', '链接文本', false, '](url)');
              },
            },
            {
              label: '插入图片',
              shortcut: 'Ctrl+Shift+I',
              icon: <IconImage size={14} />,
              action: () => {
                insertFormatting(view, '![', '图片描述', false, '](url)');
              },
            },
            {
              label: '插入视频',
              icon: <IconVideo size={14} />,
              action: () => {
                const video = '<video src="视频地址" controls width="100%"></video>\n';
                view.dispatch(view.state.replaceSelection(video));
                view.focus();
              },
            },
            { label: '', divider: true, action: () => {} },
            {
              label: '全选',
              shortcut: 'Ctrl+A',
              action: () => {
                const doc = view.state.doc;
                view.dispatch({
                  selection: { anchor: 0, head: doc.length },
                });
              },
            },
            { label: '', divider: true, action: () => {} },
            {
              label: '撤销',
              shortcut: 'Ctrl+Z',
              action: () => {
                const v = getView();
                if (v) undo(v);
              },
            },
            {
              label: '重做',
              shortcut: 'Ctrl+Y',
              action: () => {
                const v = getView();
                if (v) redo(v);
              },
            },
          ],
        });
      },
      [getView],
    );

    // Note: searchKeymap is still enabled in basicSetup (Ctrl+F/F3/Escape in editor),
    // but our global keydown handler in App.tsx intercepts Ctrl+F/Ctrl+H to open
    // the custom SearchDialog instead.
    /** 处理图片粘贴 */
    const pasteHandler = EditorView.domEventHandlers({
      paste: (event, view) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        // 检查是否有图片
        const hasImage = Array.from(clipboard.items).some(
          item => item.type.startsWith('image/'),
        );
        if (!hasImage) return false; // 无图片，让 CodeMirror 处理文本

        // 有图片：阻止默认行为，异步处理
        event.preventDefault();

        (async () => {
          const result = await readImageFromClipboard();
          if (!result) return;

          const filePath = pathRef.current;
          let md: string;
          if (filePath) {
            const ext = mimeToExt(result.mime);
            md = await saveImageToAssets(result.data, filePath, ext);
          } else {
            md = imageToBase64Markdown(result.data, result.mime);
          }
          // 末尾加换行，光标跳到新行，避免卡在长 base64 行中
          const insert = md + '\n';
          const from = view.state.selection.main.from;
          view.dispatch({
            changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert },
            selection: { anchor: from + insert.length },
          });
        })();

        return true;
      },
    });

    const extensions: Extension[] = [
      pasteHandler,
      ...(languageExtension ? [languageExtension] : []),
      isDark
        ? syntaxHighlighting(oneDarkHighlightStyle)
        : syntaxHighlighting(defaultHighlightStyle),
      keymap.of([
        {
          key: 'Ctrl-b',
          run: () => {
            editorAPI.current.toggleBold();
            return true;
          },
        },
        {
          key: 'Ctrl-i',
          run: () => {
            editorAPI.current.toggleItalic();
            return true;
          },
        },
        {
          key: 'Ctrl-Shift-h',
          run: () => {
            editorAPI.current.toggleHeading();
            return true;
          },
        },
        {
          key: 'Ctrl-Shift-k',
          run: () => {
            editorAPI.current.toggleCodeBlock();
            return true;
          },
        },
        {
          key: 'Ctrl-Shift-l',
          run: () => {
            editorAPI.current.toggleLink();
            return true;
          },
        },
        {
          key: 'Ctrl-Shift-i',
          run: () => {
            editorAPI.current.toggleImage();
            return true;
          },
        },
      ]),
    ];

    // 语言扩展未加载完成时不渲染编辑器
    if (!languageExtension) {
      return <div className={styles.editorContainer} />;
    }

    return (
      <div className={styles.editorContainer} onContextMenu={handleContextMenu}>
        <CodeMirror
          value={value}
          onChange={handleChange}
          extensions={extensions}
          theme={isDark ? darkTheme : lightTheme}
          onCreateEditor={handleEditorCreated}
          placeholder="开始编写 Markdown..."
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBrackets: true,
            autocompletion: true,
            indentOnInput: true,
            bracketMatching: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            searchKeymap: false,
            lintKeymap: true,
          }}
          style={{ height: '100%', overflow: 'auto' }}
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
  },
);

export default MarkdownEditor;
