import { useState, useCallback, useEffect } from 'react';

export interface EditorSettings {
  autoSave: boolean;
  autoSaveInterval: number; // 秒
}

const STORAGE_KEY = 'editor-settings';

const defaults: EditorSettings = {
  autoSave: false,
  autoSaveInterval: 30,
};

function loadSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return {
      autoSave: typeof parsed.autoSave === 'boolean' ? parsed.autoSave : defaults.autoSave,
      autoSaveInterval:
        typeof parsed.autoSaveInterval === 'number'
          ? parsed.autoSaveInterval
          : defaults.autoSaveInterval,
    };
  } catch {
    return { ...defaults };
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<EditorSettings>(loadSettings);

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<EditorSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  return { settings, updateSettings };
}
