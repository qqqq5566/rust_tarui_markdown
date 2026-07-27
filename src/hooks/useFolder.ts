import { useState, useCallback, useEffect, useRef } from 'react';
import { confirm, open as openDialog } from '@tauri-apps/plugin-dialog';
import { stat, readTextFile, readDir, remove, rename, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { join, dirname } from '@tauri-apps/api/path';
import type { TabState, FileTreeNode } from '../types';

const FOLDER_SESSION_KEY = 'editor-folder-path';
const IGNORE_PATTERNS = ['.git', 'node_modules', '.DS_Store', 'target'];

interface UseFolderOptions {
  tabs: TabState[];
  activeTab: TabState;
  switchTab: (id: string) => void;
  replaceActiveTab: (path: string, content: string, mtime?: number) => void;
  openNewTab: (path: string | null, content: string, lastModified?: number | null) => TabState;
  closeTab: (id: string) => void;
  updateTabPath: (tabId: string, newPath: string) => void;
}

export function useFolder({
  tabs,
  activeTab,
  switchTab,
  replaceActiveTab,
  openNewTab,
  closeTab,
  updateTabPath,
}: UseFolderOptions) {
  const [folderPath, setFolderPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem(FOLDER_SESSION_KEY) || null;
    } catch { return null; }
  });
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(folderPath !== null);

  /** 读取目录内容 → FileTreeNode[] */
  const loadDirEntries = useCallback(async (dirPath: string): Promise<FileTreeNode[]> => {
    try {
      const entries = await readDir(dirPath);
      const nodes: FileTreeNode[] = [];
      for (const entry of entries) {
        if (IGNORE_PATTERNS.includes(entry.name)) continue;
        const fullPath = await join(dirPath, entry.name);
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory,
          isSymlink: entry.isSymlink,
        });
      }
      nodes.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      return nodes;
    } catch {
      return [];
    }
  }, []);

  /** 打开文件夹 */
  const handleOpenFolder = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: '选择文件夹',
    });
    if (!selected) return;
    const path = selected as string;
    setFolderPath(path);
    localStorage.setItem(FOLDER_SESSION_KEY, path);
    setExpandedPaths(new Set());
    setLoadingPaths(new Set());
    setSidebarVisible(true);
    const entries = await loadDirEntries(path);
    setFileTree(entries);
  }, [loadDirEntries]);

  /** 展开/折叠目录 */
  const handleToggleFolder = useCallback(async (path: string) => {
    if (loadingPaths.has(path)) return;

    if (expandedPaths.has(path)) {
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return;
    }

    setLoadingPaths(prev => new Set(prev).add(path));
    const children = await loadDirEntries(path);
    setFileTree(prev => {
      const update = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map(n => n.path === path ? { ...n, children } : n.children ? { ...n, children: update(n.children) } : n);
      return update(prev);
    });
    setExpandedPaths(prev => new Set(prev).add(path));
    setLoadingPaths(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, [expandedPaths, loadingPaths, loadDirEntries]);

  /** 从文件树打开文件 */
  const handleOpenFileFromTree = useCallback(async (filePath: string) => {
    const existing = tabs.find(t => t.path === filePath);
    if (existing) {
      switchTab(existing.id);
      return;
    }

    try {
      const content = await readTextFile(filePath);
      let mtime: number | undefined;
      try {
        const info = await stat(filePath);
        if (info.mtime) mtime = info.mtime.getTime();
      } catch { /* ignore */ }

      const tab = activeTab;
      if (!tab.isModified && tab.content === '' && !tab.path) {
        replaceActiveTab(filePath, content, mtime);
      } else {
        openNewTab(filePath, content, mtime ?? null);
      }
    } catch {
      // 读取失败，静默忽略
    }
  }, [tabs, activeTab, switchTab, replaceActiveTab, openNewTab]);

  /** 关闭文件夹 */
  const handleCloseFolder = useCallback(() => {
    setFolderPath(null);
    setFileTree([]);
    setExpandedPaths(new Set());
    setSidebarVisible(false);
    localStorage.removeItem(FOLDER_SESSION_KEY);
  }, []);

  /** 刷新文件树 */
  const handleRefreshTree = useCallback(async () => {
    if (!folderPath) return;
    const expanded = new Set(expandedPaths);
    const rootEntries = await loadDirEntries(folderPath);
    const reloadExpanded = async (nodes: FileTreeNode[]): Promise<FileTreeNode[]> => {
      return Promise.all(nodes.map(async (node) => {
        if (expanded.has(node.path)) {
          const children = await loadDirEntries(node.path);
          return { ...node, children: await reloadExpanded(children) };
        }
        return node;
      }));
    };
    const updated = await reloadExpanded(rootEntries);
    setFileTree(updated);
  }, [folderPath, expandedPaths, loadDirEntries]);

  /** 删除文件或目录 */
  const handleDeleteFile = useCallback(async (path: string, isDirectory: boolean) => {
    const nodeName = path.split(/[/\\]/).pop() || path;
    const ok = await confirm(
      `确定删除${isDirectory ? '目录' : '文件'}"${nodeName}"吗？${isDirectory ? '目录内所有内容将被删除。' : ''}`,
      { title: '删除确认', kind: 'warning' },
    );
    if (!ok) return;

    try {
      await remove(path, isDirectory ? { recursive: true } : undefined);
      const affected = tabs.filter(t => t.path === path || t.path?.startsWith(path + '/') || t.path?.startsWith(path + '\\'));
      affected.forEach(t => closeTab(t.id));
    } catch (e) {
      console.error('删除失败:', e);
    }
    handleRefreshTree();
  }, [tabs, closeTab, handleRefreshTree]);

  /** 重命名文件或目录 */
  const handleRenameFile = useCallback(async (oldPath: string, newName: string) => {
    try {
      const parentDir = await dirname(oldPath);
      const newPath = await join(parentDir, newName);
      await rename(oldPath, newPath);
      for (const tab of tabs) {
        if (tab.path === oldPath) {
          updateTabPath(tab.id, newPath);
        }
      }
    } catch (e) {
      console.error('重命名失败:', e);
    }
    handleRefreshTree();
  }, [tabs, updateTabPath, handleRefreshTree]);

  /** 新建文件 */
  const handleNewFile = useCallback(async (parentDir: string, name: string) => {
    try {
      const filePath = await join(parentDir, name);
      await writeTextFile(filePath, '');
    } catch (e) {
      console.error('新建文件失败:', e);
    }
    handleRefreshTree();
  }, [handleRefreshTree]);

  /** 新建文件夹 */
  const handleNewFolder = useCallback(async (parentDir: string, name: string) => {
    try {
      const dirPath = await join(parentDir, name);
      await mkdir(dirPath);
    } catch (e) {
      console.error('新建文件夹失败:', e);
    }
    handleRefreshTree();
  }, [handleRefreshTree]);

  // 启动时加载根目录（session 恢复）
  const folderInitRef = useRef(false);
  useEffect(() => {
    if (folderInitRef.current || !folderPath) return;
    folderInitRef.current = true;
    loadDirEntries(folderPath).then(setFileTree);
  }, [folderPath, loadDirEntries]);

  return {
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
  };
}
