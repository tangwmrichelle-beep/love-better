const path = require('path');
const express = require('express');
const config = require('./config');
const svc = require('./service');
const { verifyInitData } = require('./auth');
const { MISSION_CATEGORIES, PRESET_MISSIONS } = require('./missions');

function createServer({ broadcast, broadcastNotice, announceAct, notifyNote, webhookHandler, webhookPath }) {
  const app = express();
  app.use(['/api/stories', '/api/acts', '/api/notifications'], express.json({ limit: '8mb' })); // notifications have no length limit // stories and acts can carry up to 4 photos
  app.use(express.json({ limit: '100kb' }));
  if (webhookHandler) app.post(webhookPath, webhookHandler());
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '5m' }));
  app.get('/health', (req, res) => res.json({ ok: true }));
  // Story photos. The random token in the address keeps them private to people who can see the story.
  app.get('/photos/:key', async (req, res) => {
    const m = /^(a?)(\d+)-([a-f0-9]{24})$/.exec(req.params.key);
    if (!m) return res.status(404).end();
    try {
      const p = await svc.getPhoto(Number(m[2]), m[3], m[1] ? 'act' : 'story');
      if (!p) return res.status(404).end();
      res.set('Content-Type', p.mime).set('Cache-Control', 'private, max-age=31536000, immutable').send(p.data);
    } catch (e) { res.status(500).end(); }
  });

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
    user: { ...svc.publicUser(req.user), notify: !!req.user.notify, firstName: req.user.real_name || req.user.first_name || '',
      gender: req.user.gender || null, genderLocked: !!req.user.gender_locked },
    approved: !!req.user.approved, onboarded: !!req.user.onboarded, isAdmin: req.isAdmin,
    stats: req.user.approved ? await svc.userStats(req.user.id) : null,
    group: req.user.approved ? await svc.groupStats() : null,
    points: req.user.approved ? (await svc.points(req.user.id)).balance : 0,
    unread: req.user.approved ? await svc.unreadCount(req.user.id) : 0,
    countdown: svc.countdown(), verse: svc.verseOfTheDay(), stars: config.stars, appName: config.appName,
  })));
  api.post('/join', wrap(async req => {
    if (!(await svc.tryJoinCode(req.user.id, req.body.code))) throw new Error('That code is not right. Ask your CG leader.');
  }));
  api.post('/onboard', wrap(async req => { await svc.onboard(req.user.id, req.body); }));
  api.get('/name-check', wrap(req => ({ gender: svc.genderForName(req.query.name) })));
  api.post('/profile', wrap(async req => {
    let avatar = req.body.avatar && typeof req.body.avatar === 'object' ? JSON.stringify(req.body.avatar) : null;
    if (avatar && avatar.length > 2000) throw new Error('Avatar data too large');
    await svc.updateProfile(req.user.id, { handle: req.body.handle, avatar, notify: req.body.notify, gender: req.body.gender });
  }));

  api.post('/acts', wrap(async req => {
    const act = await svc.logAct(req.user.id, {
      description: req.body.description, recipient: req.body.recipient, isPublic: req.body.isPublic !== false,
      missionId: req.body.missionId || null, taskId: req.body.taskId || null, photos: req.body.photos,
    });
    announceAct(req.user.id, act).catch(() => {});
    return { act, stats: await svc.userStats(req.user.id) };
  }));
  api.delete('/acts/:id', wrap(async req => { if (!(await svc.deleteAct(req.user.id, Number(req.params.id)))) throw new Error('Not allowed'); }));
  api.post('/acts/:id/cheer', wrap(req => svc.toggleCheer(req.user.id, Number(req.params.id))));
  api.post('/acts/:id/react', wrap(req => svc.toggleReaction(req.user.id, Number(req.params.id), String(req.body.emoji || ''))));
  api.post('/acts/:id/notes', wrap(async req => {
    const r = await svc.addNote(req.user.id, Number(req.params.id), req.body.body);
    if (notifyNote && Number(r.ownerId) !== Number(req.user.id)) notifyNote(r.ownerId, req.user, r.note.body).catch(() => {});
    return { note: r.note };
  }));
  api.delete('/notes/:id', wrap(async req => { if (!(await svc.deleteNote(req.user.id, Number(req.params.id), req.isAdmin))) throw new Error('Not allowed'); }));
  api.get('/feed', wrap(req => svc.feed(req.user.id, 50, req.query.before ? Number(req.query.before) : null)));
  api.get('/leaderboard', wrap(req => svc.leaderboard(req.query.period === 'week' ? 'week' : 'all')));
  // Starter missions keep the order they have in missions.js; admin-added ones come after, oldest first.
  const presetOrder = t => { const i = PRESET_MISSIONS.findIndex(m => m.title === t); return i < 0 ? 999 : i; };
  api.get('/missions', wrap(async req => ({ categories: await svc.categories(),
    missions: (await svc.missions(req.user.id)).sort((a, b) => presetOrder(a.title) - presetOrder(b.title) || a.id - b.id) })));
  api.get('/users/:id/jar', wrap(async req => { const j = await svc.jar(req.user.id, Number(req.params.id)); if (!j) throw new Error('Not found'); return j; }));
  api.put('/group/goal', adminOnly, wrap(req => svc.setGroupGoal(req.body.goal)));
  api.get('/group/jar', wrap(() => svc.groupJar()));
  api.get('/acts/:id', wrap(async req => { const a = await svc.actDetail(req.user.id, Number(req.params.id)); if (!a) throw new Error('Not found'); return a; }));
  api.get('/users/:id/acts', wrap(req => svc.userActs(req.user.id, Number(req.params.id), req.query.recipient || null)));
  api.post('/missions', adminOnly, wrap(async req => { await svc.addMission(req.user.id, req.body); }));
  api.delete('/missions/:id', adminOnly, wrap(async req => { await svc.archiveMission(Number(req.params.id)); }));
  api.put('/missions/:id', adminOnly, wrap(async req => { await svc.editMission(req.user.id, Number(req.params.id), req.body); }));
  api.get('/shop', wrap(req => svc.shop(req.user.id)));
  api.post('/shop/buy', wrap(req => svc.buyItem(req.user.id, String(req.body.item || ''))));
  api.post('/shop/equip', wrap(req => svc.equip(req.user.id, req.body || {})));
  api.put('/shop/prices', adminOnly, wrap(async req => { await svc.setPrices(req.body || {}); return svc.shop(req.user.id); }));
  api.put('/categories/:key', adminOnly, wrap(async req => { await svc.editCategory(req.params.key, req.body); }));
  api.get('/tasks', wrap(() => svc.tasks()));
  api.get('/stories', wrap(req => svc.stories(req.user.id)));
  api.post('/stories', wrap(async req => { await svc.addStory(req.user.id, req.body); }));
  api.delete('/stories/:id', wrap(async req => { if (!(await svc.deleteStory(req.user.id, Number(req.params.id)))) throw new Error('Not allowed'); }));
  api.post('/stories/:id/like', wrap(req => svc.toggleStoryLike(req.user.id, Number(req.params.id))));
  api.post('/tasks', wrap(req => svc.addTask(req.user.id, req.body.title)));
  api.delete('/tasks/:id', wrap(async req => { if (!(await svc.deleteTask(req.user.id, Number(req.params.id)))) throw new Error('Not allowed'); }));

  api.get('/notifications', wrap(async req => { const items = await svc.notifications(req.user.id); await svc.markNotifsSeen(req.user.id); return { items, seenAt: Number(req.user.notif_seen_at || 0) }; }));
  api.get('/notifications/unread', wrap(async req => ({ unread: await svc.unreadCount(req.user.id) })));
  api.post('/notifications', adminOnly, wrap(async req => {
    const n = await svc.addAnnouncement(req.user.id, req.body || {});
    let tg = null;
    if (req.body.telegram !== false && broadcastNotice) tg = await broadcastNotice(req.user.id, n.title, n.body).catch(e => ({ error: e.message }));
    return { ...n, telegram: tg };
  }));
  api.delete('/notifications/:id', adminOnly, wrap(async req => { await svc.deleteAnnouncement(Number(req.params.id)); }));
  api.post('/broadcast', adminOnly, async (req, res) => {
    const msg = String(req.body.message || '').trim().slice(0, 3500);
    if (!msg) return res.status(400).json({ error: 'Write a message first.' });
    try { res.json(await broadcast(req.user.id, msg)); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.use('/api', api);
  return app;
}

module.exports = { createServer };
