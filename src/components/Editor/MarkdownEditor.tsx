import { forwardRef, useImperativeHandle, useCallback, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import ContextMenu from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import {
  IconLink, IconImage, IconTable, IconVideo,
} from '../Icons';
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
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
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
  function MarkdownEditor({ value, onChange, isDark }, ref) {
    const editorRef = useRef<EditorView | null>(null);

    const getView = useCallback((): EditorView | null => {
      return editorRef.current;
    }, []);

    useImperativeHandle(ref, () => ({
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
                document.execCommand('undo');
              },
            },
            {
              label: '重做',
              shortcut: 'Ctrl+Y',
              action: () => {
                document.execCommand('redo');
              },
            },
          ],
        });
      },
      [getView],
    );

    const extensions: Extension[] = [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
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
            searchKeymap: true,
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
