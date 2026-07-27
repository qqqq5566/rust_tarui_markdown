import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './RenameDialog.module.css';

interface RenameDialogProps {
  title: string;
  defaultValue: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function RenameDialog({
  title,
  defaultValue,
  placeholder,
  onConfirm,
  onCancel,
}: RenameDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 聚焦并选中扩展名前的内容
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      const dotIdx = value.lastIndexOf('.');
      if (dotIdx > 0) {
        inputRef.current?.setSelectionRange(0, dotIdx);
      } else {
        inputRef.current?.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  }, [value, defaultValue, onConfirm, onCancel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }, [handleConfirm, onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <div className={styles.actions}>
          <button className={styles.btn} onClick={onCancel}>取消</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConfirm}>确定</button>
        </div>
      </div>
    </div>
  );
}
