# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run Commands

```bash
npm run dev           # Vite dev server (frontend only, no Tauri)
npm run tauri dev     # Full Tauri desktop app (runs Vite + Rust backend)
npm run tauri build   # Production build
npm run build         # TypeScript check + Vite production build (frontend only)
```

There are no tests yet.

## Architecture

**Tauri v2 desktop app** — React 18 + TypeScript + Vite frontend, Rust backend. The Rust side is minimal: only window close-event protocol (`close-requested` → `confirm-close`). File I/O goes through `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` from the frontend, not via custom Rust commands.

**State lives in `App.tsx`.** It's the single orchestrator: owns `useTabs` (multi-tab state), `useFileOperations` (open/save), `useTheme` (CSS-variable theming via `data-theme` attribute), `useScrollSync` (editor↔preview scroll linking), and renders all child components. No global state library — state flows down via props, actions flow up via callbacks.

### Component Tree

```
App
├── Toolbar          — file ops + formatting buttons + search/theme/mode toggles
├── TabBar           — tab switcher with close buttons
├── PanelGroup (react-resizable-panels, horizontal split)
│   ├── MarkdownEditor   — CodeMirror 6 wrapper, exposes API via forwardRef
│   └── MarkdownPreview  — rendered HTML via marked + DOMPurify, forwardRef for scroll container
├── StatusBar        — file path, modified indicator, word/char/line counts
└── SearchDialog     — floating Notepad++ style find/replace (conditional)
```

### Key Patterns

- **`MarkdownEditor` exposes an imperative API** via `forwardRef` + `useImperativeHandle`. `App` calls `editorRef.current?.toggleBold()` etc. for toolbar formatting buttons. This API also exposes `getView(): EditorView | null` so external components (SearchDialog, useScrollSync) can access the raw CodeMirror instance.
- **Search is a standalone floating dialog** (`SearchDialog.tsx`), not CodeMirror's built-in panel. It uses `SearchCursor`/`RegExpCursor` from `@codemirror/search` directly on the `EditorView`'s document. CodeMirror's built-in search keymap is disabled (`searchKeymap: false` in basicSetup). Ctrl+F/Ctrl+H are intercepted globally in `App.tsx`'s keydown handler.
- **Scroll sync** uses ratio mapping (`scrollTop / maxScroll`) with a `syncing` ref flag + `requestAnimationFrame` deferred reset to prevent feedback loops between editor and preview `scroll` events.
- **Theming** uses CSS variables under `[data-theme="dark"]` and `[data-theme="light"]` selectors. Both `MarkdownEditor` and `MarkdownPreview` also have inline theme definitions (CodeMirror `EditorView.theme()` for editor, class-based selectors for preview).
- **Tab management**: `useTabs` hook manages `TabState[]` with generate-increment IDs. Empty unmodified tabs are reused when opening files. Closing the last tab is prevented. `activeId` change auto-closes the search dialog (since EditorView references become stale).
- **Window close protocol**: Tauri `CloseRequested` → Rust emits `close-requested` event → frontend checks all tabs for unsaved changes → emits `confirm-close` back → Rust closes the window.

### Dead Code

- `src/hooks/useMarkdown.ts` — single-file state management; superseded by `useTabs`. Not imported anywhere.
- Rust `commands.rs` (`read_file`, `write_file`, `file_exists`) — registered in `lib.rs` but the frontend uses `@tauri-apps/plugin-fs` directly. Safe to remove if no future migration to custom Rust I/O is planned.

### Editor Formatting Helper

`insertFormatting(view, wrapper, placeholder, prefixOnly?, suffix?)` in `MarkdownEditor.tsx` handles all markdown formatting:
- **Symmetric** (`wrapper` only): `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, ```` ```\ncode\n``` ````
- **Prefix-only** (`prefixOnly: true`): `## heading`, `- list`, `> quote`
- **Asymmetric** (`wrapper` + `suffix`): `[text](url)`, `![alt](url)`
- Selected text is wrapped; if already wrapped, it's unwrapped (toggle behavior). If no selection, placeholder text is inserted and selected.

### CSS Modules

All components use CSS Modules (`*.module.css`). CodeMirror-managed DOM elements use `:global()` selectors within module files. Never write plain CSS files outside of `src/styles/` (global.css, themes.css).
