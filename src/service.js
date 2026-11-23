// Shared logic used by both the Telegram bot and the mini app API.
const db = require('./db');
const config = require('./config');
const { VERSES } = require('./missions');

const DAY = 24 * 3600 * 1000;
const OFFSET = config.tzOffsetMinutes * 60 * 1000;
const RECIPIENT_LABEL = { stranger: 'someone they don’t know', friend: 'a friend', cg: 'someone in CG' };

// Day number in Singapore time (used for streaks / weeks)
const localDay = (ts) => Math.floor((ts + OFFSET) / DAY);
function startOfWeek(ts = Date.now()) {
  const d = localDay(ts);
  const weekday = (d + 3) % 7; // 1970-01-01 was a Thursday -> Monday = 0
  return (d - weekday) * DAY - OFFSET;
}

function nameOf(u) { return u.display_name || u.first_name || (u.username ? '@' + u.username : 'Friend'); }

const getUser = (id) => db.get('SELECT * FROM users WHERE id = ?', [id]);

async function upsertUser(tgUser) {
  const approved = config.joinCode && !config.isAdmin(tgUser.id) ? 0 : 1;
  await db.run(`INSERT INTO users (id, first_name, username, display_name, avatar, approved, created_at) VALUES (?,?,?,?,NULL,?,?)
    ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username`,
    [tgUser.id, tgUser.first_name || '', tgUser.username || '', tgUser.first_name || '', approved, Date.now()]);
  return getUser(tgUser.id);
}

async function tryJoinCode(userId, code) {
  if (!config.joinCode) return true;
  if (String(code || '').trim().toLowerCase() !== config.joinCode.toLowerCase()) return false;
  await db.run('UPDATE users SET approved = 1 WHERE id = ?', [userId]);
  return true;
}

function publicUser(u) {
  let avatar = null;
  try { avatar = u.avatar ? JSON.parse(u.avatar) : null; } catch { }
  return { id: u.id, name: nameOf(u), avatar };
}

async function logAct(userId, { description, recipient, isPublic = true, missionId = null, taskId = null }) {
  description = String(description || '').trim().slice(0, 500);
  if (!description) throw new Error('Please describe what you did.');
  if (!config.stars[recipient]) throw new Error('Please choose who you loved.');
  missionId = Number(missionId) || null; taskId = Number(taskId) || null;
  if (missionId && !(await db.get('SELECT id FROM missions WHERE id = ?', [missionId]))) missionId = null;
  if (taskId) {
    const t = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
    if (!t) taskId = null; else if (!t.done_at) await db.run('UPDATE tasks SET done_at = ? WHERE id = ?', [Date.now(), taskId]);
  }
  const stars = config.stars[recipient];
  return db.get(`INSERT INTO acts (user_id, description, recipient, stars, is_public, mission_id, task_id, created_at)
    VALUES (?,?,?,?,?,?,?,?) RETURNING *`, [userId, description, recipient, stars, isPublic ? 1 : 0, missionId, taskId, Date.now()]);
}

async function deleteAct(userId, actId) {
  const act = await db.get('SELECT * FROM acts WHERE id = ?', [actId]);
  if (!act || (act.user_id !== userId && !config.isAdmin(userId))) return false;
  await db.run('DELETE FROM acts WHERE id = ?', [actId]);
  if (act.task_id && (await db.get('SELECT COUNT(*) n FROM acts WHERE task_id = ?', [act.task_id])).n === 0)
    await db.run('UPDATE tasks SET done_at = NULL WHERE id = ?', [act.task_id]);
  return true;
}

async function streakFor(userId) {
  const days = new Set((await db.all('SELECT created_at FROM acts WHERE user_id = ?', [userId])).map(r => localDay(r.created_at)));
  let d = localDay(Date.now());
  if (!days.has(d)) d -= 1; // streak still alive if you logged yesterday
  let streak = 0;
  while (days.has(d)) { streak++; d--; }
  return streak;
}

const byTypeOf = rows => { const b = { stranger: 0, friend: 0, cg: 0 }; rows.forEach(r => b[r.recipient] = r.n); return b; };

async function userStats(userId) {
  const [tot, week, types, missionsDone, tasksDone, board, streak] = await Promise.all([
    db.get('SELECT COUNT(*) acts, COALESCE(SUM(stars),0) stars FROM acts WHERE user_id = ?', [userId]),
    db.get('SELECT COUNT(*) acts, COALESCE(SUM(stars),0) stars FROM acts WHERE user_id = ? AND created_at >= ?', [userId, startOfWeek()]),
    db.all('SELECT recipient, COUNT(*) n FROM acts WHERE user_id = ? GROUP BY recipient', [userId]),
    db.get('SELECT COUNT(DISTINCT mission_id) n FROM acts WHERE user_id = ? AND mission_id IS NOT NULL', [userId]),
    db.get('SELECT COUNT(*) n FROM tasks WHERE user_id = ? AND done_at IS NOT NULL', [userId]),
    leaderboard('all'),
    streakFor(userId),
  ]);
  const rank = board.findIndex(r => r.id === userId) + 1;
  return { totalActs: tot.acts, totalStars: tot.stars, weekActs: week.acts, weekStars: week.stars, byType: byTypeOf(types),
    missionsDone: missionsDone.n, tasksDone: tasksDone.n, streak, rank: rank || null, members: board.length };
}

async function groupStats() {
  const today = localDay(Date.now());
  const since = (today - 13) * DAY - OFFSET;
  const [tot, week, todayRow, types, members, recent] = await Promise.all([
    db.get('SELECT COUNT(*) acts, COALESCE(SUM(stars),0) stars FROM acts'),
    db.get('SELECT COUNT(*) acts, COALESCE(SUM(stars),0) stars FROM acts WHERE created_at >= ?', [startOfWeek()]),
    db.get('SELECT COUNT(*) acts FROM acts WHERE created_at >= ?', [today * DAY - OFFSET]),
    db.all('SELECT recipient, COUNT(*) n FROM acts GROUP BY recipient'),
    db.get('SELECT COUNT(*) n FROM users WHERE approved = 1'),
    db.all('SELECT created_at FROM acts WHERE created_at >= ?', [since]),
  ]);
  const daily = Array(14).fill(0);
  recent.forEach(r => { const i = localDay(r.created_at) - (today - 13); if (i >= 0 && i < 14) daily[i]++; });
  return { totalActs: tot.acts, totalStars: tot.stars, weekActs: week.acts, weekStars: week.stars, todayActs: todayRow.acts,
    byType: byTypeOf(types), members: members.n, goal: config.groupGoal, daily };
}

async function leaderboard(period = 'all') {
  const since = period === 'week' ? startOfWeek() : 0;
  const rows = await db.all(`
    SELECT u.id, u.display_name, u.first_name, u.username, u.avatar, u.created_at, COALESCE(SUM(a.stars),0) stars, COUNT(a.id) acts
    FROM users u LEFT JOIN acts a ON a.user_id = u.id AND a.created_at >= ?
    WHERE u.approved = 1
    GROUP BY u.id ORDER BY stars DESC, acts DESC, u.created_at ASC`, [since]);
  return rows.map(r => ({ ...publicUser(r), stars: r.stars, acts: r.acts }));
}

async function feed(viewerId, limit = 50, before = null) {
  const rows = await db.all(`
    SELECT a.*, u.display_name, u.first_name, u.username, u.avatar, m.title mission_title, m.emoji mission_emoji, t.title task_title,
      (SELECT COUNT(*) FROM cheers c WHERE c.act_id = a.id) cheers,
      (SELECT COUNT(*) FROM cheers c WHERE c.act_id = a.id AND c.user_id = ?) cheered
    FROM acts a JOIN users u ON u.id = a.user_id
    LEFT JOIN missions m ON m.id = a.mission_id
    LEFT JOIN tasks t ON t.id = a.task_id
    WHERE (?::int IS NULL OR a.id < ?::int)
    ORDER BY a.id DESC LIMIT ?`, [viewerId, before, before, limit]);
  return rows.map(r => ({
    id: r.id,
    user: publicUser({ id: r.user_id, display_name: r.display_name, first_name: r.first_name, username: r.username, avatar: r.avatar }),
    description: r.is_public || r.user_id === viewerId ? r.description : null,
    isPublic: !!r.is_public, recipient: r.recipient, stars: r.stars,
    mission: r.mission_title ? { title: r.mission_title, emoji: r.mission_emoji } : null,
    task: r.task_title || null,
    cheers: r.cheers, cheered: !!r.cheered, mine: r.user_id === viewerId, createdAt: r.created_at,
  }));
}

async function toggleCheer(userId, actId) {
  if (!(await db.get('SELECT id FROM acts WHERE id = ?', [actId]))) return null;
  const removed = await db.run('DELETE FROM cheers WHERE act_id = ? AND user_id = ?', [actId, userId]);
  if (!removed) await db.run('INSERT INTO cheers (act_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING', [actId, userId]);
  return { cheered: !removed, cheers: (await db.get('SELECT COUNT(*) n FROM cheers WHERE act_id = ?', [actId])).n };
}

function missions(userId) {
  return db.all(`SELECT m.*, (SELECT COUNT(*) FROM acts a WHERE a.mission_id = m.id AND a.user_id = ?) mine,
    (SELECT COUNT(*) FROM acts a WHERE a.mission_id = m.id) everyone
    FROM missions m WHERE m.active = 1 ORDER BY m.id`, [userId]);
}

async function addMission(userId, { emoji, title, description }) {
  title = String(title || '').trim().slice(0, 120);
  if (!title) throw new Error('Mission needs a title.');
  await db.run('INSERT INTO missions (emoji, title, description, created_by, created_at) VALUES (?,?,?,?,?)',
    [String(emoji || '💖').slice(0, 8), title, String(description || '').trim().slice(0, 300), userId, Date.now()]);
}

const archiveMission = (id) => db.run('UPDATE missions SET active = 0 WHERE id = ?', [id]);

async function tasks() {
  const rows = await db.all(`SELECT t.*, u.display_name, u.first_name, u.username, u.avatar FROM tasks t JOIN users u ON u.id = t.user_id
    ORDER BY (t.done_at IS NOT NULL), t.created_at DESC LIMIT 200`);
  return rows.map(t => ({ id: t.id, title: t.title, createdAt: t.created_at, doneAt: t.done_at,
    user: publicUser({ id: t.user_id, display_name: t.display_name, first_name: t.first_name, username: t.username, avatar: t.avatar }) }));
}

function addTask(userId, title) {
  title = String(title || '').trim().slice(0, 200);
  if (!title) throw new Error('Write what you want to do.');
  return db.get('INSERT INTO tasks (user_id, title, created_at) VALUES (?,?,?) RETURNING *', [userId, title, Date.now()]);
}

async function deleteTask(userId, taskId) { return (await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId])) > 0; }

async function updateProfile(userId, { name, avatar, notify }) {
  await db.run('UPDATE users SET display_name = COALESCE(?, display_name), avatar = COALESCE(?, avatar), notify = COALESCE(?::int, notify) WHERE id = ?',
    [name || null, avatar || null, typeof notify === 'boolean' ? (notify ? 1 : 0) : null, userId]);
}
const setNotify = (userId, on) => db.run('UPDATE users SET notify = ? WHERE id = ?', [on ? 1 : 0, userId]);
const logBroadcast = (senderId, message, sent, failed) =>
  db.run('INSERT INTO broadcasts (sender_id, message, sent, failed, created_at) VALUES (?,?,?,?,?)', [senderId, message, sent, failed, Date.now()]);

function verseOfTheDay() { return VERSES[localDay(Date.now()) % VERSES.length]; }

function countdown() {
  const now = Date.now();
  return config.events.map(e => {
    const ms = new Date(e.date).getTime() - now;
    return { ...e, ms, days: Math.max(0, Math.ceil(ms / DAY)) };
  });
}

const recipients = () => db.all('SELECT * FROM users WHERE approved = 1 AND notify = 1');

module.exports = {
  RECIPIENT_LABEL, nameOf, upsertUser, getUser, tryJoinCode, publicUser, logAct, deleteAct, userStats, groupStats,
  leaderboard, feed, toggleCheer, missions, addMission, archiveMission, tasks, addTask, deleteTask, updateProfile,
  setNotify, logBroadcast, verseOfTheDay, countdown, recipients,
};
