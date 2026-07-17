# Rust Markdown 编辑器

基于 **Rust + Tauri v2 + React + TypeScript** 开发的桌面端 Markdown 编辑器，支持实时预览、文件管理、暗色/亮色主题切换。

## 功能特性

- 📝 **Markdown 编辑** — 基于 CodeMirror 6，支持语法高亮、行号、自动补全
- 👁️ **实时预览** — 编辑内容即时渲染，支持 GFM（GitHub 风格 Markdown）
- 🎨 **代码高亮** — highlight.js 支持 90+ 编程语言语法高亮
- 🌓 **主题切换** — 暗色/亮色主题，自动跟随系统偏好
- 📂 **文件管理** — 新建、打开、保存、另存为，使用系统原生对话框
- 🖊️ **文本格式** — 加粗、斜体、删除线、标题、代码块、列表、引用、链接、图片
- ⌨️ **快捷键** — 完整的键盘快捷键支持
- 🔲 **分屏模式** — 编辑/预览/分屏三种视图切换
- ⚠️ **修改提醒** — 未保存关闭时弹出确认对话框
- 🖱️ **右键菜单** — 编辑区和预览区自定义右键菜单
- 📊 **状态栏** — 显示文件路径、修改状态、字数/字符/行数统计

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 |
| 后端 | Rust |
| 前端 | React 18 + TypeScript |
| 构建工具 | Vite |
| 编辑器 | CodeMirror 6 |
| Markdown 渲染 | marked.js |
| 代码高亮 | highlight.js |
| 安全过滤 | DOMPurify |
| 布局 | react-resizable-panels |
| 图标 | SVG（Feather Icons 风格） |

## 项目结构

```
rust_markdown/
├── src-tauri/                       # Rust 后端
│   ├── src/
│   │   ├── main.rs                  # 入口
│   │   ├── lib.rs                   # 插件注册、窗口事件
│   │   └── commands.rs              # 文件读写命令
│   ├── tauri.conf.json              # Tauri 配置
│   └── capabilities/default.json    # 权限配置
├── src/                             # React 前端
│   ├── App.tsx                      # 根组件，状态编排
│   ├── main.tsx                     # 入口
│   ├── components/
│   │   ├── Editor/                  # 编辑器组件
│   │   │   ├── MarkdownEditor.tsx   # CodeMirror 封装
│   │   │   ├── ContextMenu.tsx      # 右键菜单
│   │   │   └── *.module.css
│   │   ├── Preview/                 # 预览组件
│   │   ├── Toolbar/                 # 工具栏
│   │   ├── StatusBar/               # 状态栏
│   │   └── Icons.tsx                # SVG 图标库
│   ├── hooks/
│   │   ├── useMarkdown.ts           # 文件状态管理
│   │   ├── useFileOperations.ts     # 文件读写操作
│   │   └── useTheme.ts              # 主题管理
│   ├── types/index.ts               # 类型定义
│   └── styles/                      # 全局样式与主题变量
├── docs/
│   └── React-Hooks-指南.md           # React Hooks 学习文档
├── index.html
├── package.json
└── vite.config.ts
```

## 快速开始

### 环境要求

- **Rust** ≥ 1.96
- **Node.js** ≥ 18
- **Windows** / macOS / Linux

### 开发运行

```bash
# 安装依赖
npm install

# 启动开发模式（热更新）
npm run tauri dev
```

### 生产构建

```bash
npm run tauri build
```

构建产物在 `src-tauri/target/release/bundle/` 目录下。

## 快捷键

### 文件操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + N` | 新建文件 |
| `Ctrl + O` | 打开文件 |
| `Ctrl + S` | 保存 |
| `Ctrl + Shift + S` | 另存为 |

### 文本格式

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + B` | 加粗 |
| `Ctrl + I` | 斜体 |
| `Ctrl + Shift + H` | 标题 |
| `Ctrl + Shift + K` | 代码块 |
| `Ctrl + Shift + L` | 插入链接 |
| `Ctrl + Shift + I` | 插入图片 |

### 视图

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Shift + P` | 切换编辑/预览/分屏 |
| `Ctrl + Shift + T` | 切换暗色/亮色主题 |

## 支持的 Markdown 语法

- 标题（H1-H6）
- 加粗 / 斜体 / 删除线
- 有序列表 / 无序列表 / 任务列表
- 代码块（语法高亮）/ 行内代码
- 引用
- 链接 / 图片
- 表格
- 分割线
- HTML 标签（视频等）

## 图标生成

替换 `src-tauri/icons/` 中的源图标后，运行：

```bash
cargo tauri icon <你的PNG图标路径>
```

建议使用 512×512 或更大的 PNG 图片作为源图。

## License

MIT
