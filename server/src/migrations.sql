
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id TEXT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_bot INTEGER DEFAULT 0,
  last_lat REAL,
  last_lng REAL,
  last_seen TEXT,
  cid TEXT UNIQUE,
  city_code TEXT
);

CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  type TEXT NOT NULL, -- dps, dtp, short, camera, dir, custom
  direction TEXT,     -- for 'dir' type: N/E/S/W
  name TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,    -- null for permanent (camera/custom-permanent)
  ttl_minutes INTEGER,
  owner_tg_id TEXT,
  owner_cid TEXT,
  is_system INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  icon TEXT,
  city_code TEXT,
  extended_once INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  voter TEXT NOT NULL,      -- cid or tg_id
  value INTEGER NOT NULL,   -- +1 stands, -1 left
  created_at TEXT NOT NULL,
  UNIQUE(post_id, voter) ON CONFLICT IGNORE,
  FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaints(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  author_cid TEXT,
  reason TEXT,
  status TEXT DEFAULT 'new',  -- new -> in_progress -> resolved
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS settings_global(
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_city ON posts(city_code);
