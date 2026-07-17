import { useReducer, useMemo, useCallback } from 'react';
import type { FileState, FileAction, DocumentStats } from '../types';

const initialState: FileState = {
  path: null,
  content: '',
  isModified: false,
};

function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case 'SET_CONTENT':
      return { ...state, content: action.payload, isModified: true };
    case 'SET_PATH':
      return { ...state, path: action.payload };
    case 'MARK_CLEAN':
      return { ...state, isModified: false };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

function computeStats(content: string): DocumentStats {
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const chars = content.length;
  const words = content.length === 0
    ? 0
    : content.trim().split(/\s+/).filter(w => w.length > 0).length;
  return { wordCount: words, charCount: chars, lineCount: lines };
}

export function useMarkdown() {
  const [fileState, dispatch] = useReducer(fileReducer, initialState);

  const setContent = useCallback((content: string) => {
    dispatch({ type: 'SET_CONTENT', payload: content });
  }, []);

  const updateFilePath = useCallback((path: string) => {
    dispatch({ type: 'SET_PATH', payload: path });
  }, []);

  const markClean = useCallback(() => {
    dispatch({ type: 'MARK_CLEAN' });
  }, []);

  const resetFileState = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const stats = useMemo(() => computeStats(fileState.content), [fileState.content]);

  return {
    content: fileState.content,
    filePath: fileState.path,
    isModified: fileState.isModified,
    setContent,
    updateFilePath,
    markClean,
    resetFileState,
    stats,
  };
}
