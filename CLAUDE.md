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
│   ├── MobileDrawer.jsx   # 移动端抽屉导航
│   ├── DiaryEditor.jsx    # 日记编辑器（沉浸式衬线排版 + 草稿保存）
│   ├── DiaryPage.jsx      # 日记模块页面（列表 + 编辑 + 批量管理）
│   ├── MemoPage.jsx       # 备忘录模块页面（清单 + 提醒 + 批量管理）
│   ├── DraftsPage.jsx     # 草稿箱页面（新建草稿 + 已发布修改 + 批量管理）
│   ├── InlineChecklist.jsx # 内联待办清单组件
│   ├── SwipeableRow.jsx   # 滑动操作行（置顶/删除/收藏）
│   ├── BatchActionBar.jsx # 批量操作浮动栏
│   ├── CloudEntriesModal.jsx # 云端日记管理弹窗
│   ├── SettingsPage.jsx   # 设置与统计中心
│   ├── YearInPixels.jsx   # 心情像素网格
│   ├── AuthScreen.jsx     # 登录/注册页面
│   ├── ChangePasswordModal.jsx # 修改密码弹窗
│   └── EmptyState.jsx     # 空状态
├── hooks/
│   ├── useEntries.js      # 数据操作 hooks（乐观更新 + 批量删除）
│   ├── useAuth.js         # Supabase Auth 认证 hook
│   ├── useSync.js         # 同步引擎 hook（生命周期管理）
│   ├── useTheme.js        # 主题切换 hook
│   └── useReminders.js    # 提醒轮询 hook
├── lib/
│   ├── supabase.js        # Supabase 客户端配置
│   ├── syncEngine.js      # 同步引擎（推送/拉取/合并/Realtime/云端管理）
│   ├── db.js              # localStorage CRUD（内存缓存 + 草稿存储）
│   ├── markdown.js        # Markdown 序列化/反序列化
│   ├── moods.js           # 心情/天气数据
│   └── notifier.js        # 通知系统
├── supabase/
│   └── schema.sql         # 建表 SQL + RLS 策略 + Realtime
├── index.css              # Tailwind + 设计系统 tokens + 组件样式
├── App.jsx                # 主布局（认证门控 + 路由 + 同步集成）
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
- 图片自动添加圆角（8px）+ 柔和阴影

### 备忘录模块

- 待办事项使用 InlineChecklist 组件
- 底部「添加待办」按钮手动添加条目
- 支持设置截止时间，过期任务红色高亮
- 提醒轮询：每 30 秒检查一次到期任务

## 草稿 ↔ 发布系统

### 核心规则

- **草稿箱 = 纯本地**，永远不碰云端
- **发布 = 同步到云端**，其他设备可见
- 编辑已发布条目 → 修改先存草稿 → 发布后覆盖原条目

### 存储层

- `notebook_entries` — 主存储，syncEngine 读写
- `draft_entry_{id}` — 临时草稿缓存，DiaryEditor 即时写入

### 保存流程

```
用户编辑
  → 0ms: saveDraftLocal() 写入 draft_entry_{id}（即时响应）
  → 1s: schedulePersist() 写入 notebook_entries（持久化）
  → 不触发 onLocalChange（不推云端）

用户点击发布
  → onSave({ status: 'published' }) 写入 notebook_entries
  → onLocalChange() → schedulePush() → pushEntries() → Supabase
  → clearDraftLocal() 清除临时缓存
```

### 批量管理

- 所有列表视图（日记/备忘录/草稿箱）支持「管理」按钮 + 长按进入选择模式
- BatchActionBar 浮动操作栏：全选/取消/删除
- 草稿箱批量删除区分纯草稿和已修改条目

## 数据模型

### 笔记条目 (localStorage: notebook_entries)

```js
{
  id: string,
  title: string,
  content: TipTapJSON,
  type: 'diary' | 'memo',
  status: 'draft' | 'published',
  mood: string | null,
  weather: string | null,
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

## Supabase 集成

### 1. 建表

在 Supabase Dashboard > SQL Editor 中执行 `supabase/schema.sql`。

### 2. 环境变量

复制 `.env.example` 为 `.env`，填入 Supabase 凭据：

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### 3. 同步架构

```
┌─────────────┐   发布时推送   ┌──────────────┐   Realtime    ┌─────────────┐
│  localStorage │ ──────────▶ │  Supabase DB  │ ───────────▶ │  其他设备     │
│  (草稿纯本地) │ ◀── merge ── │  (已发布条目)  │              │  (刷新后可见) │
└─────────────┘              └──────────────┘              └─────────────┘
```

**同步规则**:

- 草稿（status='draft'）**永不推送到云端**
- 只有已发布条目（status='published'）才同步
- 发布时 → `onLocalChange()` → `schedulePush()` → `pushEntries()`
- 切换标签页 → `fullSync()` 全量 push + pull

**冲突解决**: last-write-wins（`updated_at` 较新者胜），`version` 作 tiebreaker。

### 4. 云端管理

设置页提供:

- **批量上传到云端** — 推送所有已发布条目
- **管理云端日记** — 弹窗选择性下载/删除云端条目

### 5. 认证流程

- 未配置 Supabase → 直接进入本地模式
- 已配置 + 未登录 → 登录页（10 秒超时降级，可跳过）
- 已登录 → 手动同步

## 性能优化

### 数据层缓存

`db.js` 使用内存缓存，所有读操作走缓存，写操作同步 flush 到 localStorage。

### 乐观更新

`useEntries` 的 create/update/remove 做乐观更新：直接操作当前数组，不触发全量重排序。

### 组件 memo

`EntryRow`、`DiaryItem`、`MemoItem`、`DraftItem` 用 `React.memo` 包裹。

### 批量删除

`batchRemove(ids)` — 批量删除条目，每个 ID 走 `queueDeletion` 流程。

## UI 规范

### Sidebar footer 三元素统一样式

```text
px-2.5 py-1.5 gap-2 rounded-md text-xs text-ink-secondary mb-1
```

### ChecklistRow 对齐

- `align-items: center` 自动居中
- 字号 `var(--font-size-sm)` (13px)
- 无手动 `margin-top` hack

### 按钮尺寸

- 不使用全局 `min-height: 44px`
- 使用 `.touch-target` 类按需添加

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
- [x] 草稿 ↔ 发布系统（纯本地草稿 + 手动发布）
- [x] 批量管理（所有视图支持选择模式 + 批量删除）
- [x] 云端管理（选择性下载/删除云端条目）
- [x] 滑动操作（SwipeableRow 置顶/删除/收藏）
- [x] InlineChecklist 底部添加待办按钮
