// Database: PostgreSQL (for example a free Neon database). Set DATABASE_URL.
const { Pool, types } = require('pg');
const config = require('./config');
const { PRESET_MISSIONS, RETIRED_MISSIONS } = require('./missions');

types.setTypeParser(20, v => Number(v));   // BIGINT -> number (Telegram ids, timestamps, counts)
types.setTypeParser(1700, v => Number(v)); // NUMERIC -> number (SUMs)

if (!config.databaseUrl) console.warn('DATABASE_URL is not set. Add your Neon database address in the settings.');
const pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30000 });
pool.on('error', e => console.error('Database error:', e.message));

// Lets us write "?" placeholders; converts them to Postgres' $1, $2, ...
const toPg = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
const all = async (sql, params = []) => (await pool.query(toPg(sql), params)).rows;
const get = async (sql, params = []) => (await all(sql, params))[0];
const run = async (sql, params = []) => (await pool.query(toPg(sql), params)).rowCount;

async function init() {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, display_name TEXT, avatar TEXT,
    approved INTEGER NOT NULL DEFAULT 1, notify INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY, emoji TEXT, title TEXT NOT NULL, description TEXT,
    active INTEGER NOT NULL DEFAULT 1, created_by BIGINT, created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, created_at BIGINT NOT NULL, done_at BIGINT);
  CREATE TABLE IF NOT EXISTS acts (
    id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL, recipient TEXT NOT NULL CHECK (recipient IN ('stranger','friend','cg')),
    stars INTEGER NOT NULL, is_public INTEGER NOT NULL DEFAULT 1,
    mission_id INTEGER REFERENCES missions(id) ON DELETE SET NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, created_at BIGINT NOT NULL);
  CREATE INDEX IF NOT EXISTS acts_user ON acts(user_id);
  CREATE INDEX IF NOT EXISTS acts_time ON acts(created_at);
  CREATE TABLE IF NOT EXISTS cheers (
    act_id INTEGER NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (act_id, user_id));
  CREATE TABLE IF NOT EXISTS reactions (
    act_id INTEGER NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, emoji TEXT NOT NULL, PRIMARY KEY (act_id, user_id, emoji));
  CREATE TABLE IF NOT EXISTS act_notes (
    id SERIAL PRIMARY KEY, act_id INTEGER NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at BIGINT NOT NULL);
  CREATE INDEX IF NOT EXISTS act_notes_act ON act_notes(act_id);
  CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY, sender_id BIGINT, title TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL);
  CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY, sender_id BIGINT, message TEXT NOT NULL, sent INTEGER, failed INTEGER, created_at BIGINT NOT NULL);
  `);
  // Old "Cheer" taps become 💛 reactions (safe to run every start).
  await pool.query(`INSERT INTO reactions (act_id, user_id, emoji) SELECT act_id, user_id, '💛' FROM cheers ON CONFLICT DO NOTHING`);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_seen_at BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_locked INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users (LOWER(handle));
    CREATE TABLE IF NOT EXISTS stories (
      id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL, created_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS story_photos (
      id SERIAL PRIMARY KEY, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      token TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, position INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS story_photos_story ON story_photos(story_id);
    CREATE TABLE IF NOT EXISTS act_photos (
      id SERIAL PRIMARY KEY, act_id INTEGER NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
      token TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, position INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS act_photos_act ON act_photos(act_id);
    CREATE TABLE IF NOT EXISTS story_likes (
      story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (story_id, user_id));
  `);
  // Hearts update: one heart per act, new "family" category, missions grouped into hear / see / delight.
  await pool.query(`
    ALTER TABLE acts DROP CONSTRAINT IF EXISTS acts_recipient_check;
    ALTER TABLE acts ADD CONSTRAINT acts_recipient_check CHECK (recipient IN ('stranger','friend','family','cg'));
    UPDATE acts SET stars = 1 WHERE stars <> 1;
    ALTER TABLE missions ADD COLUMN IF NOT EXISTS category TEXT;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS purchases (user_id BIGINT NOT NULL, item_id TEXT NOT NULL, price INTEGER NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, item_id));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS jar_style TEXT;
  `);
  const now = Date.now();
  for (const m of PRESET_MISSIONS) {
    const existing = await get('SELECT id FROM missions WHERE title = ?', [m.title]);
    // Starter missions follow this file (category, emoji, wording). Missions the admin added are left alone.
    if (existing) await run('UPDATE missions SET category = ?, emoji = ?, description = ? WHERE id = ? AND created_by IS NULL', [m.category, m.emoji, m.description, existing.id]);
    else await run('INSERT INTO missions (emoji, title, description, category, created_at) VALUES (?,?,?,?,?)', [m.emoji, m.title, m.description, m.category, now]);
  }
  await run('UPDATE missions SET active = 0 WHERE created_by IS NULL AND title = ANY(?::text[])', [RETIRED_MISSIONS]);
}

module.exports = { pool, all, get, run, init };
