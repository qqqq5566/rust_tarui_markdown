import { useCallback } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '../../types';
import { IconFolder, IconFolderOpen, IconFile } from '../Icons';
import { isMarkdownFile } from '../../utils/languageLoader';
import styles from './FileTreeNode.module.css';

interface FileTreeNodeProps {
  node: FileTreeNodeType;
  depth: number;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onOpenFile: (path: string) => void;
}

export default function FileTreeNode({
  node,
  depth,
  expandedPaths,
  loadingPaths,
  selectedPath,
  onToggle,
  onOpenFile,
}: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isLoading = loadingPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggle(node.path);
    } else {
      onOpenFile(node.path);
    }
  }, [node.isDirectory, node.path, onToggle, onOpenFile]);

  return (
    <div>
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        title={node.path}
      >
        {/* Chevron for directories */}
        {node.isDirectory && (
          <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        )}
        {!node.isDirectory && <span className={styles.chevron} />}

        {/* Icon */}
        {isLoading ? (
          <span className={styles.spinner} />
        ) : node.isDirectory ? (
          <span className={styles.icon}>
            {isExpanded ? <IconFolderOpen size={14} /> : <IconFolder size={14} />}
          </span>
        ) : (
          <span className={styles.icon}>
            <IconFile size={14} />
          </span>
        )}

        {/* Name */}
        <span className={`${styles.name} ${isMarkdownFile(node.name) ? styles.mdFile : ''}`}>
          {node.name}
        </span>
      </div>

      {/* Children */}
      {node.isDirectory && isExpanded && node.children && (
        <div className={styles.children}>
          {node.children.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
