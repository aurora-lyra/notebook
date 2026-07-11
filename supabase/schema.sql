-- ============================================
-- Notebook Supabase Schema
-- 执行顺序：在 Supabase Dashboard > SQL Editor 中运行
-- ============================================

-- 1. 启用 UUID 扩展（通常已启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 笔记条目表 (entries)
-- ============================================
CREATE TABLE IF NOT EXISTS entries (
  id          TEXT PRIMARY KEY,              -- 客户端生成的 ID (Date.now base36 + random)
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT DEFAULT '',
  content     JSONB,                         -- TipTap JSON
  type        TEXT NOT NULL DEFAULT 'memo' CHECK (type IN ('diary', 'memo')),
  tags        TEXT[] DEFAULT '{}',
  folder      TEXT DEFAULT '',
  pinned      BOOLEAN DEFAULT false,
  favorited   BOOLEAN DEFAULT false,
  cover_url   TEXT DEFAULT '',
  reminder_at TIMESTAMPTZ,
  related_ids TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 用于冲突检测的版本号
  version     BIGINT DEFAULT 1
);

-- 索引：按用户 + 更新时间查询
CREATE INDEX IF NOT EXISTS idx_entries_user_updated
  ON entries (user_id, updated_at DESC);

-- 索引：按类型筛选
CREATE INDEX IF NOT EXISTS idx_entries_user_type
  ON entries (user_id, type);

-- ============================================
-- 3. 待办事项表 (todos)
-- ============================================
CREATE TABLE IF NOT EXISTS todos (
  id          TEXT PRIMARY KEY,              -- 客户端生成的 ID
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL DEFAULT '',
  done        BOOLEAN DEFAULT false,
  priority    TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_at      TIMESTAMPTZ,
  reminded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     BIGINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_todos_user_updated
  ON todos (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_todos_user_done
  ON todos (user_id, done);

-- ============================================
-- 4. 同步元数据表 (sync_meta)
-- 记录每张表最后同步的时间戳，用于增量拉取
-- ============================================
CREATE TABLE IF NOT EXISTS sync_meta (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entries_at  TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z',
  todos_at    TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. RLS (Row Level Security) 策略
-- 确保每个用户只能访问自己的数据
-- ============================================

ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_meta ENABLE ROW LEVEL SECURITY;

-- entries: 用户只能操作自己的条目
CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE USING (auth.uid() = user_id);

-- todos: 用户只能操作自己的待办
CREATE POLICY "Users can view own todos"
  ON todos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos"
  ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos"
  ON todos FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos"
  ON todos FOR DELETE USING (auth.uid() = user_id);

-- sync_meta: 用户只能操作自己的同步记录
CREATE POLICY "Users can view own sync_meta"
  ON sync_meta FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own sync_meta"
  ON sync_meta FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync_meta"
  ON sync_meta FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 6. 启用 Realtime 订阅
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE entries;
ALTER PUBLICATION supabase_realtime ADD TABLE todos;

-- ============================================
-- 7. 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_entries_updated
  BEFORE UPDATE ON entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_todos_updated
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 8. Storage 策略（日记图片上传）
-- 前置操作：在 Supabase Dashboard > Storage 中
-- 手动创建名为 diary-images 的 Public Bucket
-- 然后在 SQL Editor 中执行以下策略
-- ============================================

-- 允许已认证用户上传图片
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'diary-images');

-- 允许所有人查看图片（Public bucket 必需）
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'diary-images');
