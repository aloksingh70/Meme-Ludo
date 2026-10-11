-- Migration 001: Initial schema for Ludo accounts, sessions, matches and leaderboard
-- Designed for SQLite (with foreign keys enabled) and directly portable to PostgreSQL

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_username_len CHECK (length(username) >= 3 AND length(username) <= 20)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  ruleset_version TEXT NOT NULL,
  CONSTRAINT matches_player_count_check CHECK (player_count >= 2 AND player_count <= 4)
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL,
  seat_index INTEGER NOT NULL,
  user_id TEXT,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  kind TEXT NOT NULL,
  placement INTEGER NOT NULL,
  tokens_home INTEGER NOT NULL DEFAULT 0,
  captures_made INTEGER NOT NULL DEFAULT 0,
  times_captured INTEGER NOT NULL DEFAULT 0,
  sixes_rolled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, seat_index),
  CONSTRAINT fk_match_players_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_match_players_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_kind CHECK (kind IN ('human', 'bot')),
  CONSTRAINT chk_color CHECK (color IN ('red', 'green', 'yellow', 'blue')),
  CONSTRAINT chk_placement CHECK (placement >= 1 AND placement <= 4),
  CONSTRAINT chk_tokens_home CHECK (tokens_home >= 0 AND tokens_home <= 4)
);

CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
CREATE INDEX IF NOT EXISTS idx_match_players_placement ON match_players(placement);
CREATE INDEX IF NOT EXISTS idx_matches_ended_at ON matches(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
