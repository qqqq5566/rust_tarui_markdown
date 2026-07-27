import { useState, useCallback } from 'react';
import type { TabState } from '../../types';
import ContextMenu from '../Editor/ContextMenu';
import type { ContextMenuItem } from '../Editor/ContextMenu';
import styles from './TabBar.module.css';

interface TabBarProps {
  tabs: TabState[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseRight: (id: string) => void;
  onCloseLeft: (id: string) => void;
  onCloseAll: () => void;
}

export default function TabBar({
  tabs, activeId, onSwitch, onClose,
  onCloseOthers, onCloseRight, onCloseLeft, onCloseAll,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const tabIndex = contextMenu ? tabs.findIndex(t => t.id === contextMenu.tabId) : -1;
  const hasRight = tabIndex >= 0 && tabIndex < tabs.length - 1;
  const hasLeft = tabIndex > 0;

  const menuItems: ContextMenuItem[] = contextMenu ? [
    {
      label: '关闭',
      action: () => onClose(contextMenu.tabId),
      disabled: tabs.length <= 1,
    },
    {
      label: '关闭其他',
      action: () => onCloseOthers(contextMenu.tabId),
      disabled: tabs.length <= 1,
    },
    {
      label: '关闭右侧',
      action: () => onCloseRight(contextMenu.tabId),
      disabled: !hasRight,
    },
    {
      label: '关闭左侧',
      action: () => onCloseLeft(contextMenu.tabId),
      disabled: !hasLeft,
    },
    { label: '', divider: true, action: () => {} },
    {
      label: '关闭全部',
      action: () => onCloseAll(),
      disabled: tabs.length <= 1,
    },
  ] : [];

  return (
    <div className={styles.tabBar}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`${styles.tab} ${tab.id === activeId ? styles.active : ''}`}
          onClick={() => onSwitch(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          title={tab.path || '未命名'}
        >
          <span className={styles.tabTitle}>
            {tab.title}
            {tab.isModified && <span className={styles.modifiedDot}> ●</span>}
          </span>
          {tabs.length > 1 && (
            <button
              className={styles.closeBtn}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              title="关闭"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
