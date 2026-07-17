import type { DocumentStats } from '../../types';
import styles from './StatusBar.module.css';

interface StatusBarProps {
  filePath: string | null;
  stats: DocumentStats;
  isModified: boolean;
}

export default function StatusBar({ filePath, stats, isModified }: StatusBarProps) {
  const displayPath = filePath || '未命名';

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <span className={styles.filePath} title={filePath || undefined}>
          {displayPath}
        </span>
        {isModified && <span className={styles.modified}>（已修改）</span>}
      </div>
      <div className={styles.right}>
        <span className={styles.stat}>字数：{stats.wordCount}</span>
        <span className={styles.stat}>字符：{stats.charCount}</span>
        <span className={styles.stat}>行数：{stats.lineCount}</span>
      </div>
    </div>
  );
}
