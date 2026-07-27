import { useState, useCallback } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '../../types';
import { IconFolderPlus } from '../Icons';
import ContextMenu from '../Editor/ContextMenu';
import type { ContextMenuItem } from '../Editor/ContextMenu';
import FileTreeNodeComponent from './FileTreeNode';
import RenameDialog from './RenameDialog';
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
  onDelete: (path: string, isDirectory: boolean) => void;
  onRename: (oldPath: string, newName: string) => void;
  onNewFile: (parentDir: string, name: string) => void;
  onNewFolder: (parentDir: string, name: string) => void;
}

/** 从路径中提取文件夹名称 */
function folderName(folderPath: string): string {
  const parts = folderPath.replace(/[/\\]$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || folderPath;
}

/** 复制文本到剪贴板 */
function copyToClipboard(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
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
  onDelete,
  onRename,
  onNewFile,
  onNewFolder,
}: FileExplorerPanelProps) {
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileTreeNodeType;
  } | null>(null);

  // 重命名/新建弹窗状态
  const [renameDialog, setRenameDialog] = useState<{
    title: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileTreeNodeType) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 构建右键菜单项
  const getMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const items: ContextMenuItem[] = [];

    // 文件：打开
    if (!node.isDirectory) {
      items.push({
        label: '打开',
        action: () => onOpenFile(node.path),
      });
      items.push({ label: '', divider: true, action: () => {} });
    }

    // 目录：新建
    if (node.isDirectory) {
      items.push({
        label: '新建文件',
        action: () => {
          setRenameDialog({
            title: `在 "${node.name}" 中新建文件`,
            defaultValue: '',
            onConfirm: (name) => onNewFile(node.path, name),
          });
        },
      });
      items.push({
        label: '新建文件夹',
        action: () => {
          setRenameDialog({
            title: `在 "${node.name}" 中新建文件夹`,
            defaultValue: '',
            onConfirm: (name) => onNewFolder(node.path, name),
          });
        },
      });
      items.push({ label: '', divider: true, action: () => {} });
    }

    // 通用：重命名
    items.push({
      label: '重命名',
      action: () => {
        setRenameDialog({
          title: `重命名 "${node.name}"`,
          defaultValue: node.name,
          onConfirm: (name) => onRename(node.path, name),
        });
      },
    });

    // 通用：删除
    items.push({
      label: '删除',
      action: () => onDelete(node.path, node.isDirectory),
    });

    items.push({ label: '', divider: true, action: () => {} });

    // 通用：复制路径
    items.push({
      label: '复制路径',
      action: () => copyToClipboard(node.path),
    });

    return items;
  }, [contextMenu, onOpenFile, onNewFile, onNewFolder, onRename, onDelete]);

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
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getMenuItems()}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* 重命名/新建弹窗 */}
      {renameDialog && (
        <RenameDialog
          title={renameDialog.title}
          defaultValue={renameDialog.defaultValue}
          onConfirm={(value) => {
            renameDialog.onConfirm(value);
            setRenameDialog(null);
          }}
          onCancel={() => setRenameDialog(null)}
        />
      )}
    </div>
  );
}
