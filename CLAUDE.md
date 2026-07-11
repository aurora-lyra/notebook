# Notebook — 个人工作空间

极简主义日记 + 备忘录应用，Notion 风格设计。

## 技术栈

- **框架**: React 19 + Vite 8
- **样式**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **编辑器**: TipTap v3 (StarterKit + Placeholder + Image + Underline)
- **图标**: Lucide React
- **日期**: date-fns
- **数据**: localStorage + Supabase（本地优先 + 云端同步）

## 常用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run lint     # 运行 oxlint
```

## 项目结构

```
src/
├── components/
│   ├── TipTapEditor.jsx   # TipTap 编辑器（浮动菜单 + 气泡菜单）
│   ├── Sidebar.jsx        # 左侧导航栏（含用户信息 + 云端状态）
│   ├── EntryList.jsx      # 条目列表（memo 化 EntryRow）
│   ├── EntryEditor.jsx    # 通用条目编辑视图
│   ├── DiaryEditor.jsx    # 日记专用编辑器（沉浸式衬线排版 + 自动保存状态栏）
│   ├── DiaryPage.jsx      # 日记模块页面（列表 + 编辑整合）
│   ├── TodoItem.jsx       # 单个待办事项（优先级莫兰迪色圆点）
│   ├── TodoList.jsx       # 待办列表（分类：今天/以后/已完成）
│   ├── MemoPage.jsx       # 备忘录模块页面（集成提醒系统）
│   ├── AuthScreen.jsx     # 登录/注册页面（含连接错误处理）
│   ├── EmptyState.jsx     # 空状态
├── hooks/
│   ├── useEntries.js      # 数据操作 hooks（乐观更新 + syncVersion）
│   ├── useAuth.js         # Supabase Auth 认证 hook（含超时降级）
│   ├── useSync.js         # 同步引擎 hook（生命周期管理）
│   └── useReminders.js    # 提醒轮询 hook（30秒检查一次）
├── lib/
│   ├── supabase.js        # Supabase 客户端配置（含连接诊断）
│   ├── syncEngine.js      # 同步引擎（推送/拉取/合并/Realtime）
│   ├── db.js              # localStorage CRUD（内存缓存 + 异步 flush）
│   ├── todoStore.js       # 待办事项数据层
│   └── notifier.js        # 通知系统（Notification API + 网页气泡）
├── supabase/
│   └── schema.sql         # 建表 SQL + RLS 策略 + Realtime
├── index.css              # Tailwind + 设计系统 tokens + 日记排版样式
├── App.jsx                # 主布局（认证门控 + 三模式路由 + 同步集成）
└── main.jsx               # 入口
```

## 设计系统

详见 `src/index.css` 的 `@theme` 块。核心原则：

- **色彩**: 黑白灰为主，蓝色点缀（#2383e2）
- **字体**: 系统字体栈，含 Noto Sans/Serif SC
- **间距**: 4px 基础网格
- **圆角**: 小而克制（4-12px）
- **阴影**: 极淡，仅用于浮层
- **莫兰迪优先级色**: 高 #c47c6c / 中 #c9a96e / 低 #8fa89a

### 日记模式排版

- 正文使用衬线体（Georgia / Noto Serif SC），17px，line-height: 2.0
- 编辑区最大宽度 700px，水平居中
- 标题用无衬线体，形成视觉层次对比
- 图片自动添加圆角（8px）+ 柔和阴影，hover 加深
- 状态栏显示自动保存状态（正在保存… / 已保存到本地）

### 备忘录模块

- 待办事项分三类：今天 / 以后 / 已完成
- 优先级用莫兰迪色圆点，点击循环切换
- 支持设置截止时间，过期任务红色高亮
- 通知系统：浏览器 Notification API + 网页气泡降级
- 提醒轮询：每 30 秒检查一次到期任务

## 数据模型

### 笔记条目 (localStorage: notebook_entries)

```js
{
  id: string,
  title: string,
  content: TipTapJSON,
  type: 'diary' | 'memo',
  tags: string[],
  folder: string,
  pinned: boolean,
  favorited: boolean,
  coverUrl: string,
  reminderAt: string | null,
  relatedIds: string[],
  attachments: any[],
  createdAt: ISO string,
  updatedAt: ISO string,
}
```

### 待办事项 (localStorage: notebook_todos)

```js
{
  id: string,
  text: string,
  done: boolean,
  priority: 'high' | 'medium' | 'low',
  dueAt: ISO string | null,
  remindedAt: ISO string | null,
  createdAt: ISO string,
  updatedAt: ISO string,
}
```

## 编辑器交互

- **浮动菜单**: 空段落时出现，支持标题/引用/列表/图片
- **气泡菜单**: 选中文字时出现，支持加粗/斜体/下划线/标题/引用/分割线
- **自动保存**: 内容变化 300ms 防抖后导出 JSON

## Supabase 集成

### 1. 建表

在 Supabase Dashboard > SQL Editor 中执行 `supabase/schema.sql`。

### 2. 环境变量

复制 `.env.example` 为 `.env`，填入 Supabase 凭据：

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

注意：URL 不要带 `/rest/v1` 后缀。

### 3. 同步架构

```
┌─────────────┐   800ms防抖   ┌──────────────┐   Realtime    ┌─────────────┐
│  localStorage │ ──────────▶ │  Supabase DB  │ ───────────▶ │  其他设备     │
│  (本地优先)   │ ◀── merge ── │  (云端真相)    │              │  (自动拉取)   │
└─────────────┘              └──────────────┘              └─────────────┘
```

**冲突解决**: last-write-wins（`updated_at` 较新者胜），`version` 作 tiebreaker。

**同步时机**:
- 本地写入 → 800ms 防抖后推送
- Realtime 订阅 → 远程变更毫秒级拉取
- 页面获得焦点 → 全量 push + pull（兜底）
- 登录时 → 全量拉取 + 推送本地未同步数据

### 4. 认证流程

- 未配置 Supabase → 直接进入本地模式
- 已配置 + 未登录 → 登录页（10 秒超时降级，可跳过）
- 已登录 → 自动同步

## 性能优化

### 数据层缓存

`db.js` 使用内存缓存，所有读操作走缓存，写操作通过 `requestIdleCallback` 异步 flush 到 localStorage。`deleteEntry` 返回已解析数组，调用方无需二次解析。

### 乐观更新

`useEntries` 的 create/update/remove 做乐观更新：直接操作当前数组（增量修改），不触发全量重排序。

### 组件 memo

`EntryRow` 和 `DiaryItem` 用 `React.memo` 包裹，只有自身数据变化时才重渲染。

### 删除操作链路（优化后）

```text
点击删除 → db.deleteEntry (内存 splice, 0 次 parse)
         → applyFilter (内存过滤)
         → React setEntries (仅删除行消失，其他 memo 跳过)
```

## 后续计划

- [x] 接入 Supabase Auth 认证
- [x] Supabase 数据库同步
- [x] 性能优化（缓存 + 乐观更新 + memo）
- [x] 暗色模式（月之静谧 Moonlight Zen 主题）
- [x] 拖拽排序（@dnd-kit，跨分类拖拽）
- [x] Markdown 导入/导出（自定义零依赖转换器）
- [x] 移动端响应式（抽屉导航 + FAB + 自适应布局）
- [x] PWA 支持（vite-plugin-pwa，离线缓存）
- [x] 图片上传（Supabase Storage + 本地压缩 + WebP）
- [x] 情绪像素马赛克（Year in Pixels 心情网格）
- [x] 设置与统计中心（个人设置 + 时光复盘）
- [x] 沉浸式写作模式（编辑时侧边栏自动淡出）
- [x] 心情+天气胶囊选择器
- [x] 修改密码功能
