import type { FileTreeNode as FileTreeNodeType } from '../../types';
import { IconFolderPlus } from '../Icons';
import FileTreeNodeComponent from './FileTreeNode';
import styles from './FileExplorerPanel.module.css';

interface FileExplorerPanelProps {
  folderPath: string;
  fileTree: FileTreeNodeType[];
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  selectedPath: string | null;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onCloseFolder: () => void;
  onRefresh: () => void;
}

/** 从路径中提取文件夹名称 */
function folderName(folderPath: string): string {
  const parts = folderPath.replace(/[/\\]$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || folderPath;
}

export default function FileExplorerPanel({
  folderPath,
  fileTree,
  expandedPaths,
  loadingPaths,
  selectedPath,
  onToggleFolder,
  onOpenFile,
  onCloseFolder,
  onRefresh,
}: FileExplorerPanelProps) {
  if (!folderPath) {
    return (
      <div className={styles.panel}>
        <div className={styles.placeholder}>
          <span className={styles.placeholderIcon}>
            <IconFolderPlus size={32} />
          </span>
          <span>未打开文件夹</span>
          <span>点击工具栏「打开文件夹」按钮</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.folderName}>{folderName(folderPath)}</span>
        <button className={styles.headerBtn} onClick={onRefresh} title="刷新文件列表">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        <button className={styles.headerBtn} onClick={onCloseFolder} title="关闭文件夹">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tree */}
      <div className={styles.tree}>
        {fileTree.length === 0 ? (
          <div className={styles.placeholder}>
            <span>此文件夹为空</span>
          </div>
        ) : (
          fileTree.map(node => (
            <FileTreeNodeComponent
              key={node.path}
              node={node}
              depth={0}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
              selectedPath={selectedPath}
              onToggle={onToggleFolder}
              onOpenFile={onOpenFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
