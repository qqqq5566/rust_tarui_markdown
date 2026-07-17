export type EditorMode = 'edit' | 'preview' | 'split';

export type Theme = 'light' | 'dark';

export interface FileState {
  path: string | null;
  content: string;
  isModified: boolean;
}

export interface DocumentStats {
  wordCount: number;
  charCount: number;
  lineCount: number;
}

export type FileAction =
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_PATH'; payload: string }
  | { type: 'MARK_CLEAN' }
  | { type: 'RESET' };
