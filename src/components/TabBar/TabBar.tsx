import type { TabState } from '../../types';
import styles from './TabBar.module.css';

interface TabBarProps {
  tabs: TabState[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TabBar({ tabs, activeId, onSwitch, onClose }: TabBarProps) {
  return (
    <div className={styles.tabBar}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`${styles.tab} ${tab.id === activeId ? styles.active : ''}`}
          onClick={() => onSwitch(tab.id)}
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
    </div>
  );
}
