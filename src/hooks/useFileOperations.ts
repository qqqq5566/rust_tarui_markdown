import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

interface UseFileOperationsOptions {
  onFileOpened: (content: string, path: string) => void;
  onFileSaved: (path: string) => void;
}

export function useFileOperations({ onFileOpened, onFileSaved }: UseFileOperationsOptions) {
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const openFile = useCallback(async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: 'Markdown 文件', extensions: ['md', 'mdx', 'markdown', 'txt'] },
        ],
      });
      if (selected) {
        const content = await readTextFile(selected);
        onFileOpened(content, selected);
      }
    } catch (e) {
      setError(`打开文件失败：${e}`);
    }
  }, [onFileOpened]);

  const saveFile = useCallback(async (content: string, currentPath: string | null): Promise<boolean> => {
    try {
      setError(null);
      if (currentPath) {
        await writeTextFile(currentPath, content);
        onFileSaved(currentPath);
        return true;
      } else {
        return await saveFileAs(content);
      }
    } catch (e) {
      setError(`保存文件失败：${e}`);
      return false;
    }
  }, [onFileSaved]);

  const saveFileAs = useCallback(async (content: string): Promise<boolean> => {
    try {
      setError(null);
      const selected = await save({
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: 'Markdown 文件', extensions: ['md', 'mdx', 'markdown'] },
        ],
        defaultPath: '未命名.md',
      });
      if (selected) {
        await writeTextFile(selected, content);
        onFileSaved(selected);
        return true;
      }
      return false;
    } catch (e) {
      setError(`保存文件失败：${e}`);
      return false;
    }
  }, [onFileSaved]);

  return {
    openFile,
    saveFile,
    saveFileAs,
    error,
    clearError,
  };
}
