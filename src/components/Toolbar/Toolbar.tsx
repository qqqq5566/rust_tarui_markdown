import type { EditorMode } from '../../types';
import {
  IconNew, IconOpen, IconSave, IconSaveAs,
  IconBold, IconItalic, IconStrikethrough, IconHeading,
  IconCode, IconCodeInline,
  IconListUnordered, IconListOrdered, IconQuote,
  IconLink, IconImage,
  IconSun, IconMoon, IconEye,
} from '../Icons';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onBold: () => void;
  onItalic: () => void;
  onStrikethrough: () => void;
  onHeading: () => void;
  onCodeBlock: () => void;
  onInlineCode: () => void;
  onUnorderedList: () => void;
  onOrderedList: () => void;
  onBlockquote: () => void;
  onLink: () => void;
  onImage: () => void;
  onToggleTheme: () => void;
  onToggleMode: () => void;
  currentMode: EditorMode;
  isDark: boolean;
  currentFilePath: string | null;
}

export default function Toolbar({
  onNew, onOpen, onSave, onSaveAs,
  onBold, onItalic, onStrikethrough, onHeading,
  onCodeBlock, onInlineCode,
  onUnorderedList, onOrderedList, onBlockquote,
  onLink, onImage,
  onToggleTheme, onToggleMode,
  currentMode, isDark,
}: ToolbarProps) {
  const modeLabels: Record<EditorMode, string> = {
    edit: '编辑',
    preview: '预览',
    split: '分屏',
  };

  return (
    <div className={styles.toolbar}>
      {/* 文件操作 */}
      <div className={styles.group}>
        <button className={styles.button} onClick={onNew} title="新建 (Ctrl+N)">
          <IconNew size={16} />
          <span className={styles.label}>新建</span>
        </button>
        <button className={styles.button} onClick={onOpen} title="打开 (Ctrl+O)">
          <IconOpen size={16} />
          <span className={styles.label}>打开</span>
        </button>
        <button className={styles.button} onClick={onSave} title="保存 (Ctrl+S)">
          <IconSave size={16} />
          <span className={styles.label}>保存</span>
        </button>
        <button className={styles.button} onClick={onSaveAs} title="另存为 (Ctrl+Shift+S)">
          <IconSaveAs size={16} />
          <span className={styles.label}>另存为</span>
        </button>
      </div>

      <div className={styles.separator} />

      {/* 文本格式 */}
      <div className={styles.group}>
        <button className={styles.button} onClick={onBold} title="加粗 (Ctrl+B)">
          <IconBold size={16} />
        </button>
        <button className={styles.button} onClick={onItalic} title="斜体 (Ctrl+I)">
          <IconItalic size={16} />
        </button>
        <button className={styles.button} onClick={onStrikethrough} title="删除线">
          <IconStrikethrough size={16} />
        </button>
        <button className={styles.button} onClick={onHeading} title="标题 (Ctrl+Shift+H)">
          <IconHeading size={16} />
        </button>
      </div>

      <div className={styles.separator} />

      {/* 块元素 */}
      <div className={styles.group}>
        <button className={styles.button} onClick={onCodeBlock} title="代码块 (Ctrl+Shift+K)">
          <IconCode size={16} />
        </button>
        <button className={styles.button} onClick={onInlineCode} title="行内代码">
          <IconCodeInline size={16} />
        </button>
        <button className={styles.button} onClick={onUnorderedList} title="无序列表">
          <IconListUnordered size={16} />
        </button>
        <button className={styles.button} onClick={onOrderedList} title="有序列表">
          <IconListOrdered size={16} />
        </button>
        <button className={styles.button} onClick={onBlockquote} title="引用">
          <IconQuote size={16} />
        </button>
      </div>

      <div className={styles.separator} />

      {/* 插入 */}
      <div className={styles.group}>
        <button className={styles.button} onClick={onLink} title="链接 (Ctrl+Shift+L)">
          <IconLink size={16} />
        </button>
        <button className={styles.button} onClick={onImage} title="图片 (Ctrl+Shift+I)">
          <IconImage size={16} />
        </button>
      </div>

      <div className={styles.spacer} />

      {/* 视图与主题 */}
      <div className={styles.group}>
        <button className={styles.button} onClick={onToggleTheme} title="切换主题 (Ctrl+Shift+T)">
          {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button
          className={`${styles.button} ${styles.modeButton}`}
          onClick={onToggleMode}
          title="切换视图 (Ctrl+Shift+P)"
        >
          <IconEye size={16} />
          <span className={styles.label}>{modeLabels[currentMode]}</span>
        </button>
      </div>
    </div>
  );
}
