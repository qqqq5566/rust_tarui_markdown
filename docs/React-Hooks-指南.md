# React 基础知识与 Hooks 完全指南

> 本文档结合 `rust_markdown` 编辑器项目中的实际代码，讲解 React 核心概念和 Hooks 用法。

---

## 一、React 基础三要素

### 1.1 组件（Component）

组件是 React 的构建单元。一个组件就是一个**返回 HTML 的 JavaScript 函数**。

```tsx
// 函数组件的基本形态
function MyButton() {
  return <button>点击我</button>;
}
```

**本项目示例**（`Toolbar.tsx`）：

```tsx
export default function Toolbar({ onNew, onSave }) {
  return (
    <div className={styles.toolbar}>
      <button onClick={onNew}>新建</button>
      <button onClick={onSave}>保存</button>
    </div>
  );
}
```

### 1.2 JSX

JSX 让你在 JavaScript 中直接写类似 HTML 的语法。本质上是 `React.createElement()` 的语法糖。

```tsx
// JSX 写法
const element = <h1 className="title">你好</h1>;

// 编译后等价于
const element = React.createElement('h1', { className: 'title' }, '你好');
```

**关键规则**：
- 必须有一个根标签（或用 `<>...</>` 包裹）
- 用 `{}` 嵌入 JavaScript 表达式
- HTML 属性用驼峰命名：`className` 代替 `class`，`onClick` 代替 `onclick`

```tsx
// 本项目中的 JSX 示例
<div className={styles.toolbar}>
  <button onClick={onNew} title="新建 (Ctrl+N)">
    <span className={styles.icon}>📄</span>
    <span className={styles.label}>新建</span>
  </button>
</div>
```

### 1.3 Props（属性）

Props 是父组件传递给子组件的数据，**只读不可修改**。

```tsx
// 父组件传递 props
<Button label="保存" color="blue" onClick={handleSave} />

// 子组件接收 props
function Button({ label, color, onClick }) {
  return <button style={{ backgroundColor: color }} onClick={onClick}>{label}</button>;
}
```

**`onNew={}` 的含义**：

```tsx
// App.tsx（父组件）定义了一个函数
const handleNew = () => {
  resetFileState();  // 重置文件状态
  newFile();         // 清空当前路径
};

// 把这个函数通过 props 传给 Toolbar（子组件）
<Toolbar onNew={handleNew} />

// Toolbar.tsx（子组件）接收这个函数，按钮点击时调用
function Toolbar({ onNew }) {
  return <button onClick={onNew}>新建</button>;
}
```

**数据流向**：`App` → `Toolbar` → `button`，单向流动，子组件不能修改父组件的数据。

---

## 二、Hooks 完全指南

Hooks 是 React 16.8 引入的函数，让你在函数组件中使用状态和生命周期。

### 2.1 useState — 状态管理

让组件"记住"数据，数据变化时自动重新渲染。

```tsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);  // 初始值 0

  return (
    <div>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}
```

**本项目示例**（`App.tsx`）：

```tsx
// mode 状态：记录当前视图模式
const [mode, setMode] = useState<EditorMode>('split');
//   ^^^^      ^^^^^^^                    ^^^^^^^^
//   当前值     修改函数                    初始值（分屏模式）

// 点击按钮切换模式
const cycleMode = () => {
  setMode(prev => {
    const modes = ['edit', 'preview', 'split'];
    const idx = modes.indexOf(prev);
    return modes[(idx + 1) % modes.length];  // 循环切换
  });
};
```

**要点**：
- `setState` 是**异步**的，不能立即读取新值
- 用函数形式 `setCount(prev => prev + 1)` 获取最新值
- 状态变化会触发组件重新渲染

---

### 2.2 useEffect — 副作用处理

在组件渲染后执行操作：数据请求、DOM 操作、事件监听、定时器等。

```tsx
import { useEffect } from 'react';

function Timer() {
  useEffect(() => {
    // 组件挂载后执行
    console.log('组件已挂载');
    const timer = setInterval(() => console.log('tick'), 1000);

    // 返回清理函数，组件卸载前执行
    return () => {
      console.log('组件即将卸载，清理定时器');
      clearInterval(timer);
    };
  }, []);  // 空数组 = 只执行一次（挂载和卸载）
}
```

**本项目示例**（`App.tsx`）：

```tsx
// 当 filePath 或 isModified 变化时，更新窗口标题
useEffect(() => {
  const filename = filePath
    ? filePath.split(/[/\\]/).pop() || '未命名'
    : '未命名';
  const modified = isModified ? ' •' : '';
  document.title = `${filename}${modified} - Rust Markdown 编辑器`;
}, [filePath, isModified]);  // 依赖数组：这两个值变化时才执行
```

**依赖数组规则**：

| 依赖数组 | 执行时机 |
|---------|---------|
| `[]` | 只在组件挂载时执行一次 |
| `[a, b]` | 挂载时 + `a` 或 `b` 变化时执行 |
| 不传 | 每次渲染都执行（几乎不用） |

---

### 2.3 useRef — 持久引用

创建一个"容器"，在整个生命周期中保持同一个引用，修改它不会触发重新渲染。

**两大用途**：

**用途一：引用 DOM 元素**

```tsx
function AutoFocus() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();  // 自动聚焦
  }, []);

  return <input ref={inputRef} />;
}
```

**用途二：保存可变值（不触发渲染）**

```tsx
// 本项目：保存当前文件路径，不需要触发渲染
const currentPathRef = useRef<string | null>(null);

// 打开文件时更新
currentPathRef.current = '/path/to/file.md';

// 保存时读取
if (currentPathRef.current) {
  await writeTextFile(currentPathRef.current, content);
}
```

---

### 2.4 useCallback — 缓存函数

防止函数在每次渲染时重新创建，避免子组件不必要的重渲染。

```tsx
import { useCallback } from 'react';

function Parent() {
  const [count, setCount] = useState(0);

  // ❌ 不好：每次渲染都创建新函数，子组件总是重渲染
  const handleClick = () => setCount(c => c + 1);

  // ✅ 好：函数被缓存，依赖不变就不会重新创建
  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);  // 空依赖 = 永远不重新创建
}
```

**本项目示例**（`App.tsx`）：

```tsx
// handleSave 只在 content 或 saveFile 变化时重新创建
const handleSave = useCallback(async () => {
  await saveFile(content);
}, [content, saveFile]);
```

**何时使用**：
- 函数作为 props 传给子组件时
- 函数在 `useEffect` 的依赖中时
- 函数在 `useMemo` 的依赖中时

---

### 2.5 useMemo — 缓存计算结果

缓存昂贵的计算结果，依赖不变时直接返回缓存值。

```tsx
import { useMemo } from 'react';

function ExpensiveList({ items }) {
  // 只在 items 变化时重新排序，否则返回缓存
  const sorted = useMemo(() => {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return <ul>{sorted.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

**本项目示例**（`useMarkdown.ts`）：

```tsx
// content 不变时，stats 对象引用不变，避免 StatusBar 无谓渲染
const stats = useMemo(() => {
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const chars = content.length;
  const words = content.length === 0
    ? 0
    : content.trim().split(/\s+/).filter(w => w.length > 0).length;
  return { wordCount: words, charCount: chars, lineCount: lines };
}, [content]);
```

**`useMemo` vs `useCallback`**：

| Hook | 缓存什么 | 写法 |
|------|---------|------|
| `useMemo` | 计算结果的**值** | `useMemo(() => value, [deps])` |
| `useCallback` | 函数**本身** | `useCallback(() => fn, [deps])` |

> `useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)`

---

### 2.6 useReducer — 复杂状态管理

当状态逻辑复杂、多个状态相互关联时，替代 `useState`。

```tsx
import { useReducer } from 'react';

// 定义状态变化规则
function reducer(state, action) {
  switch (action.type) {
    case 'INCREMENT': return { count: state.count + 1 };
    case 'DECREMENT': return { count: state.count - 1 };
    case 'RESET':     return { count: 0 };
    default:          return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+1</button>
      <button onClick={() => dispatch({ type: 'RESET' })}>重置</button>
    </div>
  );
}
```

**本项目示例**（`useMarkdown.ts`）：

```tsx
type FileAction =
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_PATH'; payload: string }
  | { type: 'MARK_CLEAN' }
  | { type: 'RESET' };

function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case 'SET_CONTENT':
      return { ...state, content: action.payload, isModified: true };
    case 'SET_PATH':
      return { ...state, path: action.payload };
    case 'MARK_CLEAN':
      return { ...state, isModified: false };
    case 'RESET':
      return { path: null, content: '', isModified: false };
    default:
      return state;
  }
}

// 使用
const [fileState, dispatch] = useReducer(fileReducer, initialState);
```

**`useState` vs `useReducer`**：

| 场景 | 推荐 |
|------|------|
| 单个独立状态 | `useState` |
| 多个状态互相关联 | `useReducer` |
| 状态更新逻辑复杂 | `useReducer` |

---

### 2.7 forwardRef + useImperativeHandle

让父组件能调用子组件暴露的方法。本项目中用它让 `App` 直接操作编辑器。

**本项目示例**（`MarkdownEditor.tsx`）：

```tsx
// 1. 定义子组件暴露的 API 接口
export interface MarkdownEditorAPI {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleLink: () => void;
  toggleImage: () => void;
}

// 2. 用 forwardRef 包装子组件
const MarkdownEditor = forwardRef<MarkdownEditorAPI, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange }, ref) {
    const editorRef = useRef<EditorView>(null);

    // 3. 用 useImperativeHandle 定义暴露给父组件的值
    useImperativeHandle(ref, () => ({
      toggleBold: () => {
        const view = editorRef.current;
        if (view) insertFormatting(view, '**', '加粗文本');
      },
      toggleItalic: () => {
        const view = editorRef.current;
        if (view) insertFormatting(view, '*', '斜体文本');
      },
      toggleLink: () => {
        const view = editorRef.current;
        if (view) insertFormatting(view, '[', '链接文本', false, '](url)');
      },
      toggleImage: () => {
        const view = editorRef.current;
        if (view) insertFormatting(view, '![', '图片描述', false, '](url)');
      },
    }), []);
    //  ^^ 空依赖 = API 对象在组件生命周期中保持不变

    return <CodeMirror ... />;
  }
);
```

**父组件使用**（`App.tsx`）：

```tsx
function App() {
  // 1. 创建一个 ref
  const editorRef = useRef<MarkdownEditorAPI>(null);

  // 2. 通过 ref 调用子组件的方法
  return (
    <Toolbar
      onBold={() => editorRef.current?.toggleBold()}    // 点击"加粗"按钮
      onItalic={() => editorRef.current?.toggleItalic()} // 点击"斜体"按钮
      onLink={() => editorRef.current?.toggleLink()}     // 点击"链接"按钮
      onImage={() => editorRef.current?.toggleImage()}   // 点击"图片"按钮
    />

    <MarkdownEditor ref={editorRef} value={content} onChange={setContent} />
  );
}
```

**调用链路**：`Toolbar 按钮点击` → `onBold prop` → `App 的匿名函数` → `editorRef.current.toggleBold()` → `MarkdownEditor 的 useImperativeHandle` → `CodeMirror 操作`

---

## 三、`onNew={}` 模式详解

回顾你问的 `onNew={}` 模式，完整流程如下：

```
┌─────────────────────────────────────────────────────────┐
│ App.tsx（父组件）                                         │
│                                                         │
│ const handleNew = useCallback(async () => {              │
│   resetFileState();   // ← 我要执行的操作                 │
│   newFile();                                              │
│ }, [...]);                                                │
│                                                         │
│ <Toolbar onNew={handleNew} />   ← 把函数传给子组件         │
└─────────────────┬───────────────────────────────────────┘
                  │ props
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Toolbar.tsx（子组件）                                     │
│                                                         │
│ function Toolbar({ onNew }) {  ← 从 props 接收函数       │
│   return (                                               │
│     <button onClick={onNew}>  ← 点击时调用这个函数        │
│       新建                                               │
│     </button>                                            │
│   );                                                     │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

**本质**：父组件定义一个函数，通过 props 传给子组件，子组件在合适的时机（用户点击）调用它。

**为什么要这样做**：
- 子组件不需要知道"新建文件"的具体逻辑
- 父组件控制数据和业务逻辑，子组件只负责 UI 和触发事件
- 组件之间职责分离，易于维护和复用

**常见命名惯例**：
- `onXxx`：事件回调 props，如 `onClick`、`onNew`、`onSave`
- `handleXxx`：处理函数，如 `handleNew`、`handleSave`

---

## 四、Hooks 使用规则

1. **只在顶层调用**，不能在 if/for/嵌套函数中使用
2. **只在 React 函数中调用**（函数组件或自定义 Hook）
3. 自定义 Hook 必须以 `use` 开头

```tsx
// ❌ 错误：在条件语句中使用 Hook
if (condition) {
  useState(0);  // 报错！
}

// ✅ 正确：Hook 在顶层
function MyComponent() {
  const [value, setValue] = useState(0);

  if (condition) {
    // 可以使用状态，但不能在这里声明新 Hook
    setValue(1);
  }
}
```

---

## 五、本项目 Hook 总览

| Hook | 文件 | 用途 |
|------|------|------|
| `useState` | `App.tsx` | 视图模式切换（edit/preview/split） |
| `useState` | `useTheme.ts` | 暗色/亮色主题 |
| `useState` | `MarkdownEditor.tsx` | 右键菜单位置 |
| `useState` | `MarkdownPreview.tsx` | 右键菜单位置 |
| `useState` | `useFileOperations.ts` | 文件操作错误信息 |
| `useEffect` | `App.tsx` | 窗口标题更新、关闭确认、全局快捷键 |
| `useEffect` | `useTheme.ts` | 主题持久化到 localStorage |
| `useRef` | `App.tsx` | 引用编辑器 API |
| `useRef` | `MarkdownEditor.tsx` | 引用 CodeMirror 实例 |
| `useRef` | `MarkdownPreview.tsx` | 引用预览区 DOM 节点 |
| `useRef` | `useFileOperations.ts` | 保存当前文件路径 |
| `useCallback` | `App.tsx` | 文件操作回调、工具栏回调 |
| `useCallback` | `MarkdownEditor.tsx` | onChange、右键菜单处理 |
| `useCallback` | `MarkdownPreview.tsx` | 链接点击、右键菜单处理 |
| `useCallback` | `useFileOperations.ts` | openFile、saveFile 等 |
| `useCallback` | `useTheme.ts` | toggleTheme |
| `useMemo` | `MarkdownPreview.tsx` | Markdown → HTML 渲染 |
| `useMemo` | `useMarkdown.ts` | 字数/字符/行数统计 |
| `useReducer` | `useMarkdown.ts` | 文件状态管理 |
| `useImperativeHandle` | `MarkdownEditor.tsx` | 暴露出加粗/斜体/链接等方法 |
| `forwardRef` | `MarkdownEditor.tsx` | 让父组件能传递 ref |
| `自定义 Hook` | `useMarkdown.ts` | 封装文件状态逻辑 |
| `自定义 Hook` | `useFileOperations.ts` | 封装文件读写逻辑 |
| `自定义 Hook` | `useTheme.ts` | 封装主题切换逻辑 |

---

## 六、快速参考卡片

```
┌──────────────────────────────────────────────────────┐
│                   React Hooks 速查                     │
├──────────────┬───────────────────────────────────────┤
│ useState     │ 让组件有"记忆"，数据变了就重新渲染        │
│ useEffect    │ 渲染之后干活（请求、监听、定时器）        │
│ useRef       │ 存一个不变的值，改了不触发渲染            │
│ useCallback  │ 缓存函数，props 传函数时用               │
│ useMemo      │ 缓存计算结果，避免重复计算                │
│ useReducer   │ 复杂状态逻辑，多个状态互相关联时用         │
│ forwardRef   │ 让父组件能拿到子组件的 DOM/方法           │
│ useImperative│ 控制 forwardRef 暴露什么给父组件          │
├──────────────┴───────────────────────────────────────┤
│         自定义 Hook = 以 use 开头的函数                 │
│      把组件逻辑抽出来复用，内部可以使用其他 Hooks        │
└──────────────────────────────────────────────────────┘
```
