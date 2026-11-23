const path = require('path');
const express = require('express');
const config = require('./config');
const svc = require('./service');
const { verifyInitData } = require('./auth');

function createServer({ broadcast, announceAct, webhookHandler, webhookPath }) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  if (webhookHandler) app.post(webhookPath, webhookHandler());
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m' }));
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Who is calling? Telegram signs the mini app data, we check that signature.
  const api = express.Router();
  api.use(async (req, res, next) => {
    let tgUser = verifyInitData(req.get('X-Telegram-Init-Data'));
    if (!tgUser && config.devMode) {
      const devId = Number(req.get('X-Dev-User') || 1);
      tgUser = { id: devId, first_name: `Tester ${devId}` };
    }
    if (!tgUser) return res.status(401).json({ error: 'Please open Love Better from Telegram.' });
    try { req.user = await svc.upsertUser(tgUser); } catch (e) { console.error(e); return res.status(500).json({ error: 'Database problem, please try again.' }); }
    req.isAdmin = config.isAdmin(req.user.id);
    if (!req.user.approved && req.path !== '/me' && req.path !== '/join') return res.status(403).json({ error: 'join_code_required' });
    next();
  });
  const wrap = fn => async (req, res) => { try { res.json((await fn(req, res)) ?? { ok: true }); } catch (e) { res.status(400).json({ error: e.message }); } };
  const adminOnly = (req, res, next) => req.isAdmin ? next() : res.status(403).json({ error: 'Admins only' });

  api.get('/me', wrap(async req => ({
    user: { ...svc.publicUser(req.user), notify: !!req.user.notify },
    approved: !!req.user.approved, isAdmin: req.isAdmin,
    stats: req.user.approved ? await svc.userStats(req.user.id) : null,
    group: req.user.approved ? await svc.groupStats() : null,
    countdown: svc.countdown(), verse: svc.verseOfTheDay(), stars: config.stars, appName: config.appName,
  })));
  api.post('/join', wrap(async req => {
    if (!(await svc.tryJoinCode(req.user.id, req.body.code))) throw new Error('That code is not right. Ask your CG leader.');
  }));
  api.post('/profile', wrap(async req => {
    const name = String(req.body.name || '').trim().slice(0, 40);
    let avatar = req.body.avatar && typeof req.body.avatar === 'object' ? JSON.stringify(req.body.avatar) : null;
    if (avatar && avatar.length > 2000) throw new Error('Avatar data too large');
    await svc.updateProfile(req.user.id, { name, avatar, notify: req.body.notify });
  }));

  api.post('/acts', wrap(async req => {
    const act = await svc.logAct(req.user.id, {
      description: req.body.description, recipient: req.body.recipient, isPublic: req.body.isPublic !== false,
      missionId: req.body.missionId || null, taskId: req.body.taskId || null,
    });
    announceAct(req.user.id, act).catch(() => {});
    return { act, stats: await svc.userStats(req.user.id) };
  }));
  api.delete('/acts/:id', wrap(async req => { if (!(await svc.deleteAct(req.user.id, Number(req.params.id)))) throw new Error('Not allowed'); }));
  api.post('/acts/:id/cheer', wrap(req => svc.toggleCheer(req.user.id, Number(req.params.id))));
  api.get('/feed', wrap(req => svc.feed(req.user.id, 50, req.query.before ? Number(req.query.before) : null)));
  api.get('/leaderboard', wrap(req => svc.leaderboard(req.query.period === 'week' ? 'week' : 'all')));
  api.get('/missions', wrap(req => svc.missions(req.user.id)));
  api.post('/missions', adminOnly, wrap(async req => { await svc.addMission(req.user.id, req.body); }));
  api.delete('/missions/:id', adminOnly, wrap(async req => { await svc.archiveMission(Number(req.params.id)); }));
  api.get('/tasks', wrap(() => svc.tasks()));
  api.post('/tasks', wrap(req => svc.addTask(req.user.id, req.body.title)));
  api.delete('/tasks/:id', wrap(async req => { if (!(await svc.deleteTask(req.user.id, Number(req.params.id)))) throw new Error('Not allowed'); }));

  api.post('/broadcast', adminOnly, async (req, res) => {
    const msg = String(req.body.message || '').trim().slice(0, 3500);
    if (!msg) return res.status(400).json({ error: 'Write a message first.' });
    try { res.json(await broadcast(req.user.id, msg)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.use('/api', api);
  return app;
}

module.exports = { createServer };
