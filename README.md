# Md-Editor

桌面端 Markdown 编辑器（Tauri 2 + React 19 + TypeScript），专注本地 `.md` 文件的打开、编辑、预览和保存。

## 项目定位

- 无后端、纯本地运行
- Markdown 文件直接读写本地磁盘
- 桌面应用壳使用 Tauri 2

## 技术栈

- Desktop: Tauri 2
- Frontend: React 19 + TypeScript + Vite
- Editor: CodeMirror 6 (`@uiw/react-codemirror` + `@codemirror/lang-markdown`)
- Preview: `react-markdown` + `remark/rehype` 生态
- State: Zustand
- Styling: CSS Modules
- Testing: Vitest + Testing Library

## 当前已实现功能

- 打开 Markdown 文件（`.md`）
- 打开工作区文件夹并扫描 Markdown 文件列表
- 新建文件 / 保存 / 另存为
- 左侧文件列表与大纲（Outline）切换
- 中间编辑区与预览可编辑模式切换
- 预览区常见 Markdown 渲染（含 GFM、代码块、表格、数学公式等）
- 未保存变更拦截与确认流程
- 常用快捷键（新建/打开/保存/另存为/模式切换）

## 开发中/规划项

- 最近打开文件记录
- 基础设置（主题、字体大小、布局）
- SQLite 持久化（配置、索引、最近记录）

## 快速开始

### 1. 环境要求

- Node.js 20+
- Rust（stable）
- Tauri CLI（Cargo 子命令）

### 2. 安装依赖

```bash
npm install
```

### 3. 前端开发

```bash
npm run dev
```

### 4. 启动 Tauri 桌面应用（开发模式）

```bash
npm run tauri dev
```

### 5. 构建

```bash
npm run build
```

### 6. 测试与类型检查

```bash
npm run test
npm run typecheck
```

### 7. Windows 一键检查/启动（可选）

```powershell
.\start-dev.cmd --check
.\start-dev.cmd
```

## 常用脚本

- `npm run dev`: 启动 Vite 开发服务器
- `npm run tauri`: 调用 `cargo tauri`
- `npm run build`: TypeScript 检查 + 前端打包
- `npm run test`: 运行 Vitest
- `npm run typecheck`: 仅类型检查

## 目录结构

```text
md/
├─ src/                  # 前端源码
│  ├─ app/               # 应用装配与页面骨架
│  ├─ components/        # 通用组件
│  ├─ features/          # 业务功能模块（editor/preview/workspace/toolbar）
│  ├─ lib/               # markdown/tauri 等基础能力
│  ├─ store/             # Zustand 状态管理
│  ├─ styles/            # 全局样式
│  └─ types/             # TS 类型定义
├─ src-tauri/            # Tauri Rust 侧代码与配置
├─ tests/                # 单元测试与组件测试
├─ docs/                 # 设计文档与实现计划
└─ assets/               # 静态资源（如后续需要）
```

## 说明

- 当前仓库中的部分中文 UI 文案存在编码异常（显示乱码），不影响核心功能；可后续统一做 UTF-8 文案清理。
- 项目版本：`0.1.0`

## License

暂未指定（如需开源，建议补充 `LICENSE` 文件）。
