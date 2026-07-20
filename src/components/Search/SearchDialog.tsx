import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { EditorView } from '@codemirror/view';
import { SearchCursor, RegExpCursor } from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import styles from './SearchDialog.module.css';

// ── 类型 ───────────────────────────────────

export interface MatchResult {
  from: number;
  to: number;
  line: number;
  text: string;
}

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  wrapAround: boolean;
}

interface SearchDialogProps {
  view: EditorView;
  isDark: boolean;
  onClose: () => void;
  initialMode?: 'find' | 'replace';
}

// ── 装饰器 ─────────────────────────────────

/** 在编辑器中定位到当前匹配（通过选区选中） */
function navigateToMatch(view: EditorView, matches: MatchResult[], currentIndex: number) {
  if (currentIndex < 0 || currentIndex >= matches.length) return;

  const docLen = view.state.doc.length;
  const m = matches[currentIndex];
  if (m.from >= docLen || m.to > docLen) return;

  view.dispatch({
    selection: EditorSelection.single(m.from, m.to),
    scrollIntoView: true,
  });
}

// ── 搜索工具函数 ──────────────────────────

/** 判断字符是否为单词字符（字母、数字、下划线） */
function isWordChar(ch: string): boolean {
  return /\w/.test(ch);
}

function findAllMatches(
  view: EditorView,
  query: string,
  opts: SearchOptions,
): MatchResult[] {
  if (!query) return [];

  const { state } = view;
  const doc = state.doc;
  const results: MatchResult[] = [];
  const maxMatches = 2000;

  try {
    if (opts.regexp) {
      // 全词匹配：在正则两侧加 \b，但需保留原始正则的锚点和标志
      const pattern = opts.wholeWord ? `\\b(?:${query})\\b` : query;
      try { new RegExp(pattern); } catch { return []; }
      const cursor = new RegExpCursor(doc, pattern, { ignoreCase: !opts.caseSensitive }, 0, doc.length);
      while (!cursor.next().done && results.length < maxMatches) {
        const { from, to } = cursor.value;
        const line = state.doc.lineAt(from);
        results.push({
          from, to,
          line: line.number,
          text: state.sliceDoc(Math.max(line.from, from - 20), Math.min(line.to, to + 20)),
        });
      }
    } else {
      const normalize = opts.caseSensitive ? undefined : (x: string) => x.toLowerCase();
      const cursor = new SearchCursor(doc, query, 0, doc.length, normalize);
      while (!cursor.next().done && results.length < maxMatches) {
        const { from, to } = cursor.value;

        // 全词匹配：检查匹配边界是否为单词边界
        if (opts.wholeWord) {
          const charBefore = from > 0 ? doc.sliceString(from - 1, from) : '';
          const charAfter = to < doc.length ? doc.sliceString(to, to + 1) : '';
          if ((charBefore && isWordChar(charBefore)) || (charAfter && isWordChar(charAfter))) {
            continue; // 不是单词边界，跳过
          }
        }

        const line = state.doc.lineAt(from);
        results.push({
          from, to,
          line: line.number,
          text: state.sliceDoc(Math.max(line.from, from - 20), Math.min(line.to, to + 20)),
        });
      }
    }
  } catch {
    return [];
  }

  return results;
}

function findNextMatch(
  _view: EditorView,
  matches: MatchResult[],
  currentIndex: number,
  wrapAround: boolean,
): number {
  if (matches.length === 0) return -1;
  if (currentIndex < matches.length - 1) return currentIndex + 1;
  if (wrapAround) return 0;
  return currentIndex;
}

function findPrevMatch(
  matches: MatchResult[],
  currentIndex: number,
  wrapAround: boolean,
): number {
  if (matches.length === 0) return -1;
  if (currentIndex > 0) return currentIndex - 1;
  if (wrapAround) return matches.length - 1;
  return currentIndex;
}

function findCurrentMatchIndex(
  view: EditorView,
  matches: MatchResult[],
): number {
  const cursor = view.state.selection.main.head;
  // 找到光标后面的第一个匹配，或最近的匹配
  let best = -1;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].from <= cursor) {
      best = i;
      break;
    }
  }
  return best;
}

// ── 搜索历史（localStorage） ──────────────

const HISTORY_KEY = 'search-dialog-history';
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(history: string[]) {
  try {
    const unique = [...new Set(history)].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(unique));
  } catch { /* ignore */ }
}

// ── 组件 ───────────────────────────────────

export default function SearchDialog({
  view,
  isDark,
  onClose,
  initialMode = 'find',
}: SearchDialogProps) {
  const [mode, setMode] = useState<'find' | 'replace'>(initialMode);
  const [query, setQuery] = useState(() => {
    // 如果有选中文本，则用它作为初始搜索词
    const sel = view.state.selection.main;
    if (!sel.empty) {
      return view.state.sliceDoc(sel.from, sel.to).slice(0, 200);
    }
    return '';
  });
  const [replace, setReplace] = useState('');
  const [opts, setOpts] = useState<SearchOptions>({
    query: '',
    caseSensitive: false,
    wholeWord: false,
    regexp: false,
    wrapAround: true,
  });

  // 搜索历史
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  // 匹配结果
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [showAllResults, setShowAllResults] = useState(false);

  // 拖拽
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; posX: number; posY: number }>({
    dragging: false, startX: 0, startY: 0, posX: 0, posY: 0,
  });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const matchCountRef = useRef<HTMLDivElement>(null);

  // ── 执行搜索 ──
  const doSearch = useCallback(() => {
    if (!query.trim()) {
      setMatches([]);
      setCurrentIdx(-1);
      view.dispatch({ effects: [] }); // clear potential selection
      return;
    }
    const all = findAllMatches(view, query, opts);
    setMatches(all);
    if (all.length > 0) {
      const idx = findCurrentMatchIndex(view, all);
      setCurrentIdx(idx >= 0 ? idx : 0);
    } else {
      setCurrentIdx(-1);
    }
  }, [view, query, opts]);

  // 初始搜索 + 每次 query/opts 变化时自动搜索
  useEffect(() => {
    const timer = setTimeout(doSearch, 200);
    return () => clearTimeout(timer);
  }, [doSearch]);

  // 当前匹配变化时，导航到该匹配
  useEffect(() => {
    if (currentIdx >= 0 && currentIdx < matches.length) {
      navigateToMatch(view, matches, currentIdx);
    }
  }, [currentIdx, matches, view]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // ── 导航 ──
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = findNextMatch(view, matches, currentIdx, opts.wrapAround);
    setCurrentIdx(next);
  }, [view, matches, currentIdx, opts.wrapAround]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = findPrevMatch(matches, currentIdx, opts.wrapAround);
    setCurrentIdx(prev);
  }, [matches, currentIdx, opts.wrapAround]);

  // ── 替换 ──
  const doReplace = useCallback(() => {
    if (currentIdx < 0 || currentIdx >= matches.length) return;
    const m = matches[currentIdx];
    view.dispatch({
      changes: { from: m.from, to: m.to, insert: replace },
    });
    // 匹配位置已变化，重新搜索
    setTimeout(doSearch, 50);
  }, [view, matches, currentIdx, replace, doSearch]);

  const doReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    const changes = matches.map(m => ({ from: m.from, to: m.to, insert: replace }));
    view.dispatch({ changes });
    setMatches([]);
    setCurrentIdx(-1);
    setShowAllResults(false);
  }, [view, matches, replace]);

  // ── 搜索历史 ──
  const addToHistory = useCallback((q: string) => {
    if (!q.trim()) return;
    setHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const handleQueryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addToHistory(query);
      doSearch();
      setShowHistory(false);
      if (e.shiftKey) goToPrev();
      else goToNext();
    } else if (e.key === 'Escape') {
      setShowHistory(false);
    } else if (e.key === 'ArrowDown' && showHistory) {
      e.preventDefault();
      // 选第一个历史项
      const firstBtn = (e.target as HTMLElement).parentElement?.querySelector('[data-history-item]') as HTMLElement;
      firstBtn?.focus();
    }
  }, [query, addToHistory, doSearch, goToNext, goToPrev, showHistory]);

  // ── 拖拽 ──
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      posX: position?.x ?? rect.left,
      posY: position?.y ?? rect.top,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({ x: dragRef.current.posX + dx, y: dragRef.current.posY + dy });
    };
    const handleUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  // ── 键盘快捷键 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'F3' || (e.key === 'g' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      if (e.shiftKey) goToPrev();
      else goToNext();
    }
  }, [onClose, goToNext, goToPrev]);

  // ── 点击匹配结果跳转 ──
  const jumpToMatch = useCallback((idx: number) => {
    setCurrentIdx(idx);
  }, []);

  // ── 搜索选项切换 ──
  const toggleOpt = useCallback((key: keyof SearchOptions) => {
    setOpts(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 预览文本（为匹配词加高亮标记）
  const previewHtml = useMemo(() => {
    return matches.map((m, i) => {
      let txt = m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // 高亮匹配部分 —— 简化处理，标出查询词
      const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const re = new RegExp(`(${q})`, opts.caseSensitive ? 'g' : 'gi');
        txt = txt.replace(re, '<mark>$1</mark>');
      } catch { /* ignore */ }
      return { html: txt, line: m.line, index: i };
    });
  }, [matches, query, opts.caseSensitive]);

  // ── 渲染 ──
  const posStyle = position ? { left: position.x, top: position.y } : undefined;

  return (
    <div
      ref={dialogRef}
      className={`${styles.dialog} ${isDark ? styles.dark : styles.light}`}
      style={posStyle}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="搜索与替换"
    >
      {/* ── 标题栏（可拖拽） ── */}
      <div className={styles.header} onMouseDown={handleDragStart}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'find' ? styles.activeTab : ''}`}
            onClick={() => setMode('find')}
          >
            查找
          </button>
          <button
            className={`${styles.tab} ${mode === 'replace' ? styles.activeTab : ''}`}
            onClick={() => setMode('replace')}
          >
            替换
          </button>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="关闭 (Esc)">✕</button>
      </div>

      {/* ── 查找输入 ── */}
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>查找：</label>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowAllResults(false); }}
            onKeyDown={handleQueryKeyDown}
            onFocus={() => setShowHistory(history.length > 0)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="输入搜索文本..."
          />
          <button
            className={styles.historyBtn}
            onClick={() => setShowHistory(prev => !prev)}
            title="搜索历史"
            tabIndex={-1}
          >
            ⌄
          </button>
          {/* 历史下拉 */}
          {showHistory && history.length > 0 && (
            <div className={styles.historyDropdown}>
              {history.map((h, i) => (
                <button
                  key={i}
                  data-history-item
                  className={styles.historyItem}
                  onMouseDown={e => {
                    e.preventDefault();
                    setQuery(h);
                    setShowHistory(false);
                    inputRef.current?.focus();
                  }}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 替换输入 ── */}
      {mode === 'replace' && (
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>替换为：</label>
          <input
            className={styles.input}
            type="text"
            value={replace}
            onChange={e => setReplace(e.target.value)}
            placeholder="替换文本..."
          />
        </div>
      )}

      {/* ── 选项 ── */}
      <div className={styles.optionsRow}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={opts.caseSensitive}
            onChange={() => toggleOpt('caseSensitive')}
          />
          区分大小写
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={opts.wholeWord}
            onChange={() => toggleOpt('wholeWord')}
          />
          全词匹配
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={opts.regexp}
            onChange={() => toggleOpt('regexp')}
          />
          正则表达式
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={opts.wrapAround}
            onChange={() => toggleOpt('wrapAround')}
          />
          循环查找
        </label>
      </div>

      {/* ── 操作按钮行 ── */}
      <div className={styles.actionsRow}>
        <button className={styles.actionBtn} onClick={goToPrev} title="Shift+F3">
          ◀ 上一个
        </button>
        <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={goToNext} title="Enter / F3">
          下一个 ▶
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => {
            doSearch();
            setShowAllResults(true);
          }}
        >
          全部查找
        </button>
        {mode === 'replace' && (
          <>
            <button className={styles.actionBtn} onClick={doReplace}>
              替换
            </button>
            <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={doReplaceAll}>
              全部替换
            </button>
          </>
        )}
      </div>

      {/* ── 匹配计数 ── */}
      <div className={styles.matchInfo} ref={matchCountRef}>
        {query.trim() ? (
          matches.length > 0
            ? `找到 ${matches.length} 个匹配${currentIdx >= 0 ? `，当前第 ${currentIdx + 1} 个` : ''}`
            : '未找到匹配'
        ) : (
          '输入关键词开始搜索'
        )}
      </div>

      {/* ── 全部查找结果列表 ── */}
      {showAllResults && matches.length > 0 && (
        <div className={styles.resultsPanel}>
          <div className={styles.resultsHeader}>
            匹配列表（{matches.length} 项）
            <button className={styles.closeBtn} onClick={() => setShowAllResults(false)}>✕</button>
          </div>
          <div className={styles.resultsList}>
            {previewHtml.map(({ html, line, index }) => (
              <button
                key={index}
                className={`${styles.resultItem} ${index === currentIdx ? styles.resultItemActive : ''}`}
                onClick={() => jumpToMatch(index)}
                onDoubleClick={() => { jumpToMatch(index); view.focus(); }}
              >
                <span className={styles.resultLine}>第 {line} 行</span>
                <span
                  className={styles.resultText}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
