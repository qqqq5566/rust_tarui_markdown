import { useEffect, useRef, useCallback } from 'react';
import type { EditorSettings } from '../../hooks/useSettings';
import styles from './SettingsDropdown.module.css';

interface SettingsDropdownProps {
  settings: EditorSettings;
  onUpdate: (partial: Partial<EditorSettings>) => void;
  isDark: boolean;
  onClose: () => void;
}

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 秒' },
  { value: 10, label: '10 秒' },
  { value: 30, label: '30 秒' },
  { value: 60, label: '1 分钟' },
  { value: 120, label: '2 分钟' },
];

export default function SettingsDropdown({
  settings,
  onUpdate,
  isDark,
  onClose,
}: SettingsDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 忽略设置按钮点击（由按钮自己控制 toggle）
    if (target.closest('[data-settings-btn]')) return;
    if (panelRef.current && !panelRef.current.contains(target)) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    // 延迟添加监听，避免按钮点击事件同时触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Escape 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={`${styles.dropdown} ${isDark ? styles.dark : styles.light}`}
    >
      {/* ── 自动保存开关 ── */}
      <div className={styles.row}>
        <div className={styles.rowLeft}>
          <span className={styles.label}>自动保存</span>
          <span className={styles.hint}>
            {settings.autoSave ? '已开启' : '已关闭'}
          </span>
        </div>
        <button
          className={`${styles.toggle} ${settings.autoSave ? styles.toggleOn : styles.toggleOff}`}
          onClick={() => onUpdate({ autoSave: !settings.autoSave })}
          role="switch"
          aria-checked={settings.autoSave}
          aria-label="自动保存开关"
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      {/* ── 保存间隔（仅开启时显示） ── */}
      {settings.autoSave && (
        <div className={styles.row}>
          <span className={styles.label}>保存间隔</span>
          <select
            className={styles.select}
            value={settings.autoSaveInterval}
            onChange={e => onUpdate({ autoSaveInterval: Number(e.target.value) })}
          >
            {INTERVAL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
