// Love Better mini app
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const qs = new URLSearchParams(location.search);
  const devUser = qs.get('dev');
  if (tg) { tg.ready(); tg.expand(); }
  const dark = tg && tg.initData ? tg.colorScheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.dataset.theme = 'dark';
  if (tg && tg.setHeaderColor) { try { tg.setHeaderColor(dark ? '#131A1B' : '#F4F6F3'); tg.setBackgroundColor(dark ? '#131A1B' : '#F4F6F3'); } catch (e) { } }

  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const haptic = (t = 'light') => { try { tg.HapticFeedback.impactOccurred(t); } catch (e) { } };
  const WHO = {
    stranger: { e: '🌍', label: 'Someone I don’t know', short: 'a stranger', color: '#3B8ED8' },
    friend: { e: '🤗', label: 'A friend', short: 'a friend', color: '#F5B82E' },
    cg: { e: '⛪', label: 'Someone in CG', short: 'someone in CG', color: '#217A78' },
  };

  const state = { me: null, tab: 'home', groupSeg: 'feed', boardPeriod: 'all', missions: null, tasks: null, countdownTimer: null };

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': (tg && tg.initData) || '' };
    if (devUser) headers['X-Dev-User'] = devUser;
    const res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
    return data;
  }

  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms);
  }
  function hearts(n = 14) {
    const fx = $('#fx');
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.textContent = ['⭐', '✨', '💛', '💙', '💚'][i % 5];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDelay = Math.random() * 0.5 + 's';
      fx.appendChild(s); setTimeout(() => s.remove(), 2600);
    }
  }
  function ago(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 7 * 86400) return Math.floor(s / 86400) + 'd ago';
    return new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
  }
  const face = (avatar, size) => Avatar.render(avatar || { base: 'boy', background: 'mint' }, { face: true, size });

  // ---------------- boot ----------------
  async function boot() {
    try {
      state.me = await api('/me');
    } catch (e) {
      view.innerHTML = `<div class="empty"><div>📱</div><h2>Open this from Telegram</h2><p class="muted" style="margin-top:8px">${esc(e.message)}</p></div>`;
      return;
    }
    if (!state.me.approved) return renderJoin();
    $('#tabs').hidden = false;
    api('/tasks').then(t => state.tasks = t).catch(() => {});
    if (!state.me.user.avatar) { go('home'); openAvatarEditor(true); return; }
    go('home');
  }

  function renderJoin() {
    view.innerHTML = `<div class="join"><div style="font-size:56px">💛</div><h2>Welcome to Love Better</h2>
      <p class="muted" style="margin-top:6px">Type the join code your CG leader gave you.</p>
      <input type="text" id="code" placeholder="Join code" autocomplete="off">
      <button class="btn block" id="joinBtn">Join</button></div>`;
    $('#joinBtn').onclick = async () => {
      try { await api('/join', { method: 'POST', body: { code: $('#code').value } }); boot(); } catch (e) { toast(e.message); }
    };
  }

  async function refreshMe() { state.me = await api('/me'); }

  function go(tab) {
    if (tab === 'log') return openLog();
    state.tab = tab;
    clearInterval(state.countdownTimer);
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    window.scrollTo(0, 0);
    ({ home: renderHome, missions: renderMissions, group: renderGroup, me: renderMe })[tab]();
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { haptic(); go(b.dataset.tab); });

  // ---------------- home ----------------
  function countdownHTML() {
    return state.me.countdown.map((e, i) => {
      const ms = new Date(e.date).getTime() - Date.now();
      let big, sub;
      if (ms <= 0 && ms > -86400000) { big = 'Today!'; sub = e.key === 'newyear' ? 'Happy New Year! 🎉' : 'Go love big 🎉'; }
      else if (ms <= 0) { big = '✔'; sub = 'Thank you!'; }
      else {
        const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
        big = `${d}<small> day${d === 1 ? '' : 's'}</small>`; sub = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
      }
      const date = new Date(e.date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
      return `<div class="cd c${i}"><span class="flake">${esc(e.emoji || '🎄')}</span><div class="t">${esc(e.title)}</div><div class="d">${big}</div><div class="hms">${sub}</div><div class="small" style="opacity:.75;margin-top:4px">${date}</div></div>`;
    }).join('');
  }

  async function renderHome() {
    const { me } = state;
    const s = me.stats, g = me.group;
    const pct = Math.min(100, Math.round((g.totalStars / (g.goal || 1)) * 100));
    view.innerHTML = `
      <div class="hello">
        <button class="av" id="editAv" aria-label="Edit avatar">${face(me.user.avatar)}</button>
        <div><p class="muted small" style="font-weight:800">${greeting()}</p><h1>${esc(me.user.name)}</h1><p class="muted small">Let’s love someone well today 💛</p></div>
      </div>
      <div class="card stars-card">
        <div><b>${s.totalStars}⭐</b><span>My stars</span></div>
        <div><b>${s.streak}🔥</b><span>Day streak</span></div>
        <div><b>#${s.rank || '-'}</b><span>of ${s.members}</span></div>
      </div>
      <button class="btn block" id="quickLog" style="margin-bottom:14px">💛 I loved someone today</button>
      <div class="card verse"><p>“${esc(me.verse.text)}”</p><p class="ref">${esc(me.verse.ref)}</p></div>
      <div class="section-title"><h3>Countdowns</h3></div>
      <div class="countdown" id="cd">${countdownHTML()}</div>
      <div class="section-title"><h3>Our group goal</h3><span class="muted small">${g.members} of us</span></div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;font-weight:800"><span>${g.totalStars}⭐ together</span><span class="muted">Goal ${g.goal}⭐</span></div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <p class="muted small">${g.totalActs} acts of love so far · ${g.todayActs} today · ${g.weekActs} this week</p>
      </div>
      <div class="section-title"><h3>Top lovers this week</h3><button class="link" id="seeBoard">See all</button></div>
      <div class="card" id="top3"><div class="muted small">Loading…</div></div>
      <div class="section-title"><h3>Latest from the group</h3><button class="link" id="seeFeed">See all</button></div>
      <div id="latest"></div>`;
    $('#editAv').onclick = () => openAvatarEditor();
    $('#quickLog').onclick = () => openLog();
    $('#seeBoard').onclick = () => { state.groupSeg = 'board'; state.boardPeriod = 'week'; go('group'); };
    $('#seeFeed').onclick = () => { state.groupSeg = 'feed'; go('group'); };
    state.countdownTimer = setInterval(() => { const el = $('#cd'); if (el) el.innerHTML = countdownHTML(); }, 1000);

    const [board, feed] = await Promise.all([api('/leaderboard?period=week'), api('/feed')]);
    if (state.tab !== 'home') return;
    const top = board.filter(r => r.stars > 0).slice(0, 3);
    $('#top3').innerHTML = top.length ? top.map((r, i) => boardRow(r, i)).join('') : `<p class="muted small">No stars yet this week. You could be first! ✨</p>`;
    $('#latest').innerHTML = feed.length ? feed.slice(0, 3).map(postHTML).join('') : emptyFeed();
    bindPosts($('#latest'));
  }
  function greeting() {
    const h = Number(new Date().toLocaleString('en-SG', { hour: 'numeric', hour12: false, timeZone: 'Asia/Singapore' }));
    return h < 12 ? 'Good morning ☀️' : h < 18 ? 'Good afternoon 🌤' : 'Good evening 🌙';
  }

  // ---------------- feed ----------------
  function postHTML(p) {
    const w = WHO[p.recipient];
    const link = p.mission ? `<span class="pill rose">${esc(p.mission.emoji || '🎯')} ${esc(p.mission.title)}</span>` : p.task ? `<span class="pill rose">🎯 ${esc(p.task)}</span>` : '';
    const desc = p.description != null
      ? `<p class="desc">${esc(p.description)}${!p.isPublic ? ' <span class="muted small">(only you can see this)</span>' : ''}</p>`
      : `<p class="desc muted">Loved ${w.short} quietly 🤫</p>`;
    return `<div class="card post" data-id="${p.id}">
      <div class="top"><div class="mini-av">${face(p.user.avatar)}</div>
        <div class="grow"><b>${esc(p.user.name)}</b><div class="muted small">loved ${w.e} ${w.short} · ${ago(p.createdAt)}</div></div>
        <span class="pill">+${p.stars}⭐</span></div>
      ${desc}
      <div class="meta">${link}</div>
      <div class="actions"><button class="cheer ${p.cheered ? 'on' : ''}" data-cheer>${p.cheered ? '💛' : '🤍'} ${p.cheers || ''} <span class="small">${p.cheered ? 'Cheered' : 'Cheer'}</span></button>
        ${p.mine || state.me.isAdmin ? `<button class="del" data-del>Delete</button>` : ''}</div>
    </div>`;
  }
  const emptyFeed = () => `<div class="card empty"><div>🌱</div>Nothing yet. Log the first act of love!</div>`;
  function bindPosts(root) {
    root.querySelectorAll('[data-cheer]').forEach(b => b.onclick = async () => {
      const card = b.closest('.post'); haptic();
      const r = await api(`/acts/${card.dataset.id}/cheer`, { method: 'POST' });
      b.classList.toggle('on', r.cheered);
      b.innerHTML = `${r.cheered ? '💛' : '🤍'} ${r.cheers || ''} <span class="small">${r.cheered ? 'Cheered' : 'Cheer'}</span>`;
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmThen('Delete this act? Its stars will be removed.', async () => {
      const card = b.closest('.post');
      await api(`/acts/${card.dataset.id}`, { method: 'DELETE' });
      card.remove(); await refreshMe(); toast('Deleted');
    }));
  }
  function confirmThen(msg, fn) {
    if (tg && tg.showConfirm && tg.initData) tg.showConfirm(msg, ok => ok && fn());
    else if (window.confirm(msg)) fn();
  }

  // ---------------- missions + my tasks ----------------
  async function renderMissions() {
    view.innerHTML = `<h2 style="margin:4px 4px 4px">Missions</h2><p class="muted small" style="margin:0 4px 14px">Pick one, go do it, then tap “I did it!” to log it and earn stars.</p>
      <div class="section-title" style="margin-top:6px"><h3>🎯 My own love goals</h3></div>
      <div class="card">
        <p class="muted small" style="margin-bottom:10px">Set your own task to love someone better. Everyone in the group can see it and cheer you on.</p>
        <div style="display:flex;gap:8px"><input type="text" id="newTask" maxlength="200" placeholder="e.g. Cook dinner for my mum this week"><button class="btn" id="addTask">Add</button></div>
        <div id="myTasks" style="margin-top:8px"></div>
      </div>
      <div class="section-title"><h3>✨ Missions for everyone</h3></div>
      <div id="missionList"><div class="muted small">Loading…</div></div>
      ${state.me.isAdmin ? `<div class="card admin"><h3>Admin: add a mission</h3>
        <div style="display:flex;gap:8px;margin-top:10px"><input type="text" id="mEmoji" value="💛" style="width:64px;text-align:center"><input type="text" id="mTitle" placeholder="Mission title"></div>
        <textarea id="mDesc" placeholder="Short description (optional)" style="margin-top:8px;min-height:60px"></textarea>
        <button class="btn block" id="addMission" style="margin-top:8px">Add mission</button></div>` : ''}`;
    $('#addTask').onclick = async () => {
      const title = $('#newTask').value.trim(); if (!title) return;
      try { await api('/tasks', { method: 'POST', body: { title } }); $('#newTask').value = ''; haptic('medium'); toast('Goal added 💪'); loadTasks(); } catch (e) { toast(e.message); }
    };
    if (state.me.isAdmin) $('#addMission').onclick = async () => {
      try { await api('/missions', { method: 'POST', body: { emoji: $('#mEmoji').value, title: $('#mTitle').value, description: $('#mDesc').value } }); toast('Mission added'); renderMissions(); } catch (e) { toast(e.message); }
    };
    loadTasks();
    state.missions = await api('/missions');
    if (state.tab !== 'missions') return;
    $('#missionList').innerHTML = state.missions.map(m => `<div class="card mission">
      <div class="emoji">${esc(m.emoji || '💛')}</div>
      <div class="grow"><h3>${esc(m.title)}</h3>${m.description ? `<p>${esc(m.description)}</p>` : ''}
        <div class="foot"><button class="btn small" data-mission="${m.id}">I did it!</button>
          ${m.mine ? `<span class="pill">✔ You: ${m.mine}×</span>` : ''}<span class="muted small">${m.everyone} done in group</span>
          ${state.me.isAdmin ? `<button class="del" data-archive="${m.id}">Remove</button>` : ''}</div></div></div>`).join('');
    view.querySelectorAll('[data-mission]').forEach(b => b.onclick = () => openLog({ mission: state.missions.find(m => m.id == b.dataset.mission) }));
    view.querySelectorAll('[data-archive]').forEach(b => b.onclick = () => confirmThen('Remove this mission for everyone?', async () => { await api('/missions/' + b.dataset.archive, { method: 'DELETE' }); renderMissions(); }));
  }
  async function loadTasks() {
    state.tasks = await api('/tasks');
    const el = $('#myTasks'); if (!el) return;
    const mine = state.tasks.filter(t => t.user.id === state.me.user.id);
    el.innerHTML = mine.length ? mine.map(t => `<div class="row">
      <span style="font-size:20px">${t.doneAt ? '✅' : '⬜'}</span>
      <div class="grow" style="${t.doneAt ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}</div>
      ${t.doneAt ? '' : `<button class="btn small" data-done="${t.id}">Done!</button>`}
      <button class="del" data-deltask="${t.id}" aria-label="Delete">✕</button></div>`).join('') : `<p class="muted small">No goals yet.</p>`;
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = () => openLog({ task: mine.find(t => t.id == b.dataset.done) }));
    el.querySelectorAll('[data-deltask]').forEach(b => b.onclick = () => confirmThen('Delete this goal?', async () => { await api('/tasks/' + b.dataset.deltask, { method: 'DELETE' }); loadTasks(); }));
  }

  // ---------------- log sheet ----------------
  function openLog(link = {}) {
    haptic('medium');
    let who = null;
    const openTasks = (state.tasks || []).filter(t => t.user.id === state.me.user.id && !t.doneAt);
    const linked = link.mission ? `${link.mission.emoji || '🎯'} ${link.mission.title}` : link.task ? `🎯 ${link.task.title}` : '';
    openSheet(`
      <div class="sheet-head"><h2>Log an act of love 💛</h2><button class="x" data-close>✕</button></div>
      ${linked ? `<div class="linked" style="margin-top:10px"><span>${esc(linked)}</span></div>` : ''}
      <label class="lbl" for="desc">What did you do?</label>
      <textarea id="desc" maxlength="500" placeholder="e.g. Bought kopi for the cleaner auntie and thanked her">${link.task ? esc(link.task.title) : link.mission ? esc(link.mission.title) : ''}</textarea>
      <label class="lbl">Who did you love?</label>
      <div class="who">${Object.entries(WHO).map(([k, w]) => `<button data-who="${k}"><span class="e">${w.e}</span><span><b>${w.label}</b></span><span class="s">+${state.me.stars[k]}⭐</span></button>`).join('')}</div>
      ${!link.mission && !link.task && openTasks.length ? `<label class="lbl" for="taskSel">Is this one of your goals? (optional)</label>
        <select id="taskSel" style="width:100%;padding:12px;border-radius:14px;border:2px solid var(--line);background:var(--card)"><option value="">No</option>${openTasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>` : ''}
      <label class="check"><input type="checkbox" id="pub" checked> Share the details with the group</label>
      <button class="btn block" id="save" disabled>Choose who you loved</button>`);
    const save = $('#save');
    $('#sheet').querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
      who = b.dataset.who; haptic();
      $('#sheet').querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b));
      save.disabled = false; save.textContent = `Log it (+${state.me.stars[who]}⭐)`;
    });
    save.onclick = async () => {
      const description = $('#desc').value.trim();
      if (!description) { toast('Write a few words about what you did'); $('#desc').focus(); return; }
      save.disabled = true;
      try {
        const sel = $('#taskSel');
        const r = await api('/acts', { method: 'POST', body: { description, recipient: who, isPublic: $('#pub').checked, missionId: link.mission?.id, taskId: link.task?.id || (sel && sel.value ? Number(sel.value) : null) } });
        closeSheet(); hearts();
        try { tg.HapticFeedback.notificationOccurred('success'); } catch (e) { }
        toast(`+${r.act.stars}⭐ Beautiful! You have ${r.stats.totalStars}⭐ now`, 3000);
        await refreshMe(); go(state.tab);
      } catch (e) { toast(e.message); save.disabled = false; }
    };
  }

  function openSheet(html) {
    const sh = $('#sheet');
    sh.innerHTML = `<div class="grab"></div>${html}`;
    sh.hidden = false; $('#sheetBackdrop').hidden = false;
    sh.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; document.body.style.overflow = ''; }
  $('#sheetBackdrop').onclick = closeSheet;

  // ---------------- together: feed / goals / leaderboard ----------------
  async function renderGroup() {
    const seg = state.groupSeg;
    view.innerHTML = `<h2 style="margin:4px 4px 12px">Loving together</h2>
      <div class="seg">${[['feed', '💌 Feed'], ['goals', '🎯 Goals'], ['board', '🏆 Ranks']].map(([k, l]) => `<button data-seg="${k}" class="${seg === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="groupBody"><div class="muted small">Loading…</div></div>`;
    view.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => { state.groupSeg = b.dataset.seg; haptic(); renderGroup(); });
    const body = $('#groupBody');
    if (seg === 'feed') {
      const feed = await api('/feed');
      body.innerHTML = feed.length ? feed.map(postHTML).join('') : emptyFeed();
      bindPosts(body);
    } else if (seg === 'goals') {
      const tasks = await api('/tasks');
      state.tasks = tasks;
      const open = tasks.filter(t => !t.doneAt), done = tasks.filter(t => t.doneAt);
      const item = t => `<div class="row"><div class="mini-av">${face(t.user.avatar)}</div><div class="grow"><b>${esc(t.user.name)}</b><div class="small" style="${t.doneAt ? 'opacity:.7' : ''}">${t.doneAt ? '✅ ' : ''}${esc(t.title)}</div></div><span class="muted small">${ago(t.doneAt || t.createdAt)}</span></div>`;
      body.innerHTML = `<div class="card"><h3>Working on it 💪</h3>${open.length ? open.map(item).join('') : '<p class="muted small" style="margin-top:8px">No open goals. Add yours in Missions!</p>'}</div>
        ${done.length ? `<div class="card"><h3>Done 🎉</h3>${done.slice(0, 30).map(item).join('')}</div>` : ''}
        <button class="btn ghost block" id="toMissions">＋ Add my own goal</button>`;
      $('#toMissions').onclick = () => go('missions');
    } else {
      body.innerHTML = `<div class="seg" style="box-shadow:none;background:var(--rose-soft)">${[['week', 'This week'], ['all', 'All time']].map(([k, l]) => `<button data-p="${k}" class="${state.boardPeriod === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="card" id="board">Loading…</div>`;
      body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { state.boardPeriod = b.dataset.p; renderGroup(); });
      const rows = await api('/leaderboard?period=' + state.boardPeriod);
      $('#board').innerHTML = rows.length ? rows.map(boardRow).join('') : '<p class="muted">No one here yet.</p>';
    }
  }
  function boardRow(r, i) {
    const medal = ['🥇', '🥈', '🥉'][i];
    const me = r.id === state.me.user.id;
    return `<div class="row ${me ? 'me-row' : ''}"><div class="rank">${medal || i + 1}</div><div class="mini-av">${face(r.avatar)}</div>
      <div class="grow"><b>${esc(r.name)}${me ? ' (you)' : ''}</b><div class="muted small">${r.acts} act${r.acts === 1 ? '' : 's'} of love</div></div><span class="pill">${r.stars}⭐</span></div>`;
  }

  // ---------------- me: stats, avatar, settings, admin ----------------
  async function renderMe() {
    await refreshMe();
    const { me } = state, s = me.stats, g = me.group;
    const maxType = Math.max(1, ...Object.values(s.byType));
    const gMaxType = Math.max(1, ...Object.values(g.byType));
    const maxDay = Math.max(1, ...g.daily);
    const bars = (by, max) => Object.entries(WHO).map(([k, w]) => `<div class="bar"><span>${w.e} ${w.short}</span><div class="track"><div class="fill" style="width:${by[k] / max * 100}%;background:${w.color}"></div></div><b style="text-align:right">${by[k]}</b></div>`).join('');
    view.innerHTML = `
      <div class="hello"><button class="av" id="editAv">${face(me.user.avatar)}</button>
        <div class="grow"><h1>${esc(me.user.name)}</h1><button class="link" id="editAv2">✏️ Edit avatar & name</button></div></div>
      <div class="section-title" style="margin-top:4px"><h3>My stats</h3></div>
      <div class="stat-grid">
        <div class="stat"><b>${s.totalStars}⭐</b><span>Total stars</span></div>
        <div class="stat"><b>${s.totalActs}</b><span>Acts of love</span></div>
        <div class="stat"><b>${s.weekStars}⭐</b><span>This week (${s.weekActs} acts)</span></div>
        <div class="stat"><b>${s.streak}🔥</b><span>Day streak</span></div>
        <div class="stat"><b>${s.missionsDone}</b><span>Missions done</span></div>
        <div class="stat"><b>${s.tasksDone}</b><span>Own goals done</span></div>
      </div>
      <div class="card bars" style="margin-top:14px"><h3>Who I’ve loved</h3>${bars(s.byType, maxType)}</div>
      <div class="section-title"><h3>Our group</h3><span class="muted small">${g.members} members</span></div>
      <div class="stat-grid">
        <div class="stat"><b>${g.totalStars}⭐</b><span>Stars together</span></div>
        <div class="stat"><b>${g.totalActs}</b><span>Acts of love</span></div>
      </div>
      <div class="card bars" style="margin-top:14px"><h3>Who we’ve loved</h3>${bars(g.byType, gMaxType)}</div>
      <div class="card"><h3>Acts of love, last 14 days</h3><div class="spark">${g.daily.map(n => `<div style="height:${n / maxDay * 100}%" title="${n}"></div>`).join('')}</div><p class="muted small" style="margin-top:6px">Today: ${g.todayActs}</p></div>
      <div class="card"><label class="check" style="margin:0"><input type="checkbox" id="notify" ${me.user.notify ? 'checked' : ''}> Get announcements from the admin</label></div>
      ${me.isAdmin ? `<div class="card admin"><h3>📣 Admin: message everyone</h3>
        <p class="muted small" style="margin:6px 0 10px">This is sent as a Telegram message from the bot to every member.</p>
        <textarea id="bcast" maxlength="3500" placeholder="e.g. Hi fam! 2 weeks to XMAS service. Who will you invite this week? Let’s go love better 💛"></textarea>
        <button class="btn block" id="sendB" style="margin-top:8px">Send to everyone</button></div>` : ''}
      <p class="muted small" style="text-align:center;margin-top:18px">${esc(me.appName)} · made with 💛</p>`;
    $('#editAv').onclick = $('#editAv2').onclick = () => openAvatarEditor();
    $('#notify').onchange = async e => { await api('/profile', { method: 'POST', body: { notify: e.target.checked } }); toast(e.target.checked ? 'Announcements on 🔔' : 'Announcements off 🔕'); };
    if (me.isAdmin) $('#sendB').onclick = () => {
      const message = $('#bcast').value.trim(); if (!message) return toast('Write a message first');
      confirmThen(`Send this to all ${g.members} members?`, async () => {
        $('#sendB').disabled = true; $('#sendB').textContent = 'Sending…';
        try { const r = await api('/broadcast', { method: 'POST', body: { message } }); toast(`📣 Sent to ${r.sent}${r.failed ? `, ${r.failed} failed` : ''}`, 3500); $('#bcast').value = ''; }
        catch (e) { toast(e.message); }
        $('#sendB').disabled = false; $('#sendB').textContent = 'Send to everyone';
      });
    };
  }

  // ---------------- avatar editor ----------------
  const EDIT_TABS = [
    ['base', 'Male / Female'], ['skin', 'Skin'], ['hair', 'Hair'], ['hairColor', 'Hair colour'], ['eyes', 'Eyes'], ['mouth', 'Mouth'],
    ['outfit', 'Clothes'], ['outfitColor', 'Clothes colour'], ['accessory', 'Accessories'], ['pose', 'Pose'], ['background', 'Background'],
  ];
  const SWATCH = ['skin', 'hairColor', 'outfitColor'];
  function openAvatarEditor(first = false) {
    let av = Object.assign({}, Avatar.DEFAULTS[(state.me.user.avatar && state.me.user.avatar.base) || 'girl'], state.me.user.avatar || {});
    let cur = 'base';
    openSheet(`
      <div class="sheet-head"><h2>${first ? 'Create your character ✨' : 'My character'}</h2>${first ? '' : '<button class="x" data-close>✕</button>'}</div>
      <div class="editor-preview" id="prev"></div>
      <div style="text-align:center;margin-bottom:10px"><button class="link" id="rand">🎲 Surprise me</button></div>
      <div class="opt-tabs" id="otabs">${EDIT_TABS.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('')}</div>
      <div id="opts"></div>
      <label class="lbl" for="nm">Display name</label>
      <input type="text" id="nm" maxlength="40" value="${esc(state.me.user.name)}">
      <button class="btn block" id="saveAv" style="margin-top:14px">Save</button>`);
    const draw = () => {
      $('#prev').innerHTML = Avatar.render(av);
      $('#otabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === cur));
      const list = Avatar.OPTIONS[cur];
      if (SWATCH.includes(cur)) {
        $('#opts').innerHTML = `<div class="swatches">${list.map(([v, l]) => `<button data-v="${v}" title="${l}" aria-label="${l}" class="${av[cur] === v ? 'on' : ''}" style="background:${v}"></button>`).join('')}</div>`;
      } else {
        $('#opts').innerHTML = `<div class="opt-grid">${list.map(([v, l]) => {
          const pv = Object.assign({}, av, { [cur]: v });
          if (cur === 'base') Object.assign(pv, Avatar.DEFAULTS[v], { skin: av.skin });
          const useFace = ['eyes', 'mouth', 'hair', 'hairColor', 'accessory'].includes(cur);
          return `<button data-v="${v}" class="${av[cur] === v ? 'on' : ''}">${Avatar.render(pv, { face: useFace })}${l}</button>`;
        }).join('')}</div>`;
      }
      $('#opts').querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
        haptic();
        if (cur === 'base' && av.base !== b.dataset.v) av = Object.assign({}, Avatar.DEFAULTS[b.dataset.v], { skin: av.skin });
        else av[cur] = b.dataset.v;
        draw();
      });
    };
    $('#otabs').querySelectorAll('button').forEach(b => b.onclick = () => { cur = b.dataset.k; draw(); b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); });
    $('#rand').onclick = () => {
      haptic();
      const pick = k => { const o = Avatar.OPTIONS[k]; return o[Math.floor(Math.random() * o.length)][0]; };
      av = { base: av.base, skin: av.skin };
      ['hair', 'hairColor', 'eyes', 'mouth', 'outfit', 'outfitColor', 'accessory', 'pose', 'background'].forEach(k => av[k] = pick(k));
      draw();
    };
    $('#saveAv').onclick = async () => {
      try {
        await api('/profile', { method: 'POST', body: { avatar: av, name: $('#nm').value } });
        await refreshMe(); closeSheet(); hearts(8); toast('Looking good! 😍'); go(state.tab);
      } catch (e) { toast(e.message); }
    };
    draw();
  }

  boot();
})();
