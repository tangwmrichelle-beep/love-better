// Database: PostgreSQL (for example a free Neon database). Set DATABASE_URL.
const { Pool, types } = require('pg');
const config = require('./config');
const { PRESET_MISSIONS } = require('./missions');

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
  CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY, sender_id BIGINT, message TEXT NOT NULL, sent INTEGER, failed INTEGER, created_at BIGINT NOT NULL);
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender_locked INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS users_handle ON users (LOWER(handle));
  `);
  if ((await get('SELECT COUNT(*) n FROM missions')).n === 0) {
    const now = Date.now();
    for (const m of PRESET_MISSIONS) await run('INSERT INTO missions (emoji, title, description, created_at) VALUES (?,?,?,?)', [m.emoji, m.title, m.description, now]);
  }
}

module.exports = { pool, all, get, run, init };
