-- ============================================================
-- خَيال · مخطط قاعدة البيانات
-- PostgreSQL 14+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══ المستخدمون ═══
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          VARCHAR(30) UNIQUE NOT NULL,
  display_name    VARCHAR(60) NOT NULL,
  email           VARCHAR(254) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  bio             VARCHAR(300) DEFAULT '',
  location        VARCHAR(80) DEFAULT '',
  website         VARCHAR(500) DEFAULT '',
  avatar          TEXT,
  cover           TEXT,
  accent_color    VARCHAR(7),
  verified        BOOLEAN DEFAULT FALSE,
  role            VARCHAR(20) DEFAULT 'user', -- user | moderator | admin
  status          VARCHAR(20) DEFAULT 'active', -- active | suspended | deleted
  prefs           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_handle ON users(LOWER(handle));
CREATE INDEX idx_users_status ON users(status) WHERE status = 'active';

-- ═══ الجلسات ═══
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT UNIQUE NOT NULL,
  csrf_token      TEXT NOT NULL,
  user_agent      TEXT,
  ip              INET,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ═══ المنشورات ═══
CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  prompt          TEXT NOT NULL,
  images          TEXT[] NOT NULL DEFAULT '{}',
  cover           TEXT,
  model           VARCHAR(60) DEFAULT '',
  aspect_ratio    REAL DEFAULT 0.8,
  tags            TEXT[] DEFAULT '{}',
  visibility      VARCHAR(20) DEFAULT 'public',
  nsfw            BOOLEAN DEFAULT FALSE,
  likes_count     INTEGER DEFAULT 0,
  saves_count     INTEGER DEFAULT 0,
  copies_count    INTEGER DEFAULT 0,
  comments_count  INTEGER DEFAULT 0,
  views_count     INTEGER DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_created ON posts(created_at DESC) WHERE deleted_at IS NULL AND visibility = 'public';
CREATE INDEX idx_posts_trending ON posts((likes_count + saves_count * 2 + comments_count * 3) DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);
CREATE INDEX idx_posts_search ON posts USING GIN(to_tsvector('simple', title || ' ' || prompt));

-- ═══ الإعجابات ═══
CREATE TABLE likes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX idx_likes_post ON likes(post_id, created_at DESC);

-- ═══ مجلدات الحفظ ═══
CREATE TABLE save_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(60) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_folders_user ON save_folders(user_id);

-- ═══ المحفوظات ═══
CREATE TABLE saves (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  folder_id   UUID REFERENCES save_folders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX idx_saves_post ON saves(post_id, created_at DESC);
CREATE INDEX idx_saves_folder ON saves(folder_id) WHERE folder_id IS NOT NULL;

-- ═══ المتابعات ═══
CREATE TABLE follows (
  follower_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);

-- ═══ التعليقات ═══
CREATE TABLE comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  likes_count  INTEGER DEFAULT 0,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_post ON comments(post_id, created_at DESC) WHERE deleted_at IS NULL AND parent_id IS NULL;
CREATE INDEX idx_comments_parent ON comments(parent_id, created_at ASC) WHERE deleted_at IS NULL;

-- ═══ إعجابات التعليقات ═══
CREATE TABLE comment_likes (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- ═══ الإشعارات ═══
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL, -- like | comment | follow | save | mention
  actor_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  target_type  VARCHAR(20),  -- post | comment | user
  target_id    UUID,
  target_thumb TEXT,
  text         TEXT DEFAULT '',
  unread       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifs_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifs_unread ON notifications(user_id, unread) WHERE unread = TRUE;

-- ═══ المحادثات ═══
CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_members (
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted            BOOLEAN DEFAULT FALSE,
  blocked          BOOLEAN DEFAULT FALSE,
  unread_count     INTEGER DEFAULT 0,
  last_read_at     TIMESTAMPTZ,
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_members_user ON conversation_members(user_id);

-- ═══ الرسائل ═══
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id         VARCHAR(80),
  text              TEXT DEFAULT '',
  attachment        JSONB,
  state             VARCHAR(20) DEFAULT 'sent', -- sending | sent | delivered | read
  deleted_by_sender BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  read_at           TIMESTAMPTZ
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_client ON messages(sender_id, client_id) WHERE client_id IS NOT NULL;

-- ═══ البلاغات ═══
CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   VARCHAR(20) NOT NULL,
  target_id     UUID NOT NULL,
  reason        VARCHAR(30) NOT NULL,
  note          VARCHAR(500) DEFAULT '',
  state         VARCHAR(20) DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX idx_reports_state ON reports(state, created_at);

-- ═══ دالة تحديث updated_at تلقائياً ═══
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();