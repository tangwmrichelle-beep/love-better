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
  const handleTag = u => u.handle ? ` <span class="muted small">@${esc(u.handle)}</span>` : '';
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
    if (!state.me.onboarded) return renderOnboarding();
    $('#tabs').hidden = false; $('#helpBtn').hidden = false;
    api('/tasks').then(t => state.tasks = t).catch(() => {});
    if (!state.me.user.avatar) { go('home'); openAvatarEditor(true); return; }
    go('home');
  }

  // First-time sign up: first name + username (+ Male/Female if the name isn't on the CG list)
  function renderOnboarding() {
    let gender = null, listed = null, timer;
    view.innerHTML = `<div style="padding-top:6vh">
      <div style="font-size:52px;text-align:center">👋</div>
      <h2 style="text-align:center">Welcome to Love Better!</h2>
      <p class="muted" style="text-align:center;margin-top:6px">Let’s set up your profile.</p>
      <label class="lbl" for="fn">Your first name</label>
      <input type="text" id="fn" maxlength="40" autocomplete="given-name" placeholder="e.g. Jing Xun" value="${esc(state.me.user.firstName)}">
      <div id="gWrap" style="margin-top:12px"></div>
      <label class="lbl" for="un">Create a username</label>
      <input type="text" id="un" maxlength="20" autocomplete="off" autocapitalize="none" placeholder="e.g. jingxun_loves">
      <p class="muted small" style="margin-top:6px">3 to 20 letters, numbers, _ or . (everyone in the group sees this)</p>
      <button class="btn block" id="go" style="margin-top:18px">Next: create my character ✨</button></div>`;
    const drawGender = () => {
      const w = $('#gWrap');
      if (!$('#fn').value.trim()) { w.innerHTML = ''; return; }
      if (listed) { w.innerHTML = `<p class="pill">✔ Found you on the CG list</p>`; return; }
      w.innerHTML = `<label class="lbl" style="margin-top:0">I am</label><div class="seg" style="box-shadow:none;background:var(--accent-soft)">
        ${[['boy', 'Male'], ['girl', 'Female']].map(([k, l]) => `<button data-g="${k}" class="${gender === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      w.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { gender = b.dataset.g; drawGender(); });
    };
    const check = async () => { const n = $('#fn').value.trim(); listed = n ? (await api('/name-check?name=' + encodeURIComponent(n))).gender : null; drawGender(); };
    $('#fn').oninput = () => { clearTimeout(timer); timer = setTimeout(check, 300); };
    check();
    $('#go').onclick = async () => {
      try {
        await api('/onboard', { method: 'POST', body: { firstName: $('#fn').value, username: $('#un').value, gender } });
        await refreshMe(); boot();
      } catch (e) { toast(e.message, 3000); }
    };
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
      <div class="section-title"><h3>Latest from the group</h3><button class="link" id="seeFeed">See all</button></div>
      <div id="latest"></div>`;
    $('#editAv').onclick = () => openAvatarEditor();
    $('#quickLog').onclick = () => openLog();
    $('#seeFeed').onclick = () => { state.groupSeg = 'feed'; go('group'); };
    state.countdownTimer = setInterval(() => { const el = $('#cd'); if (el) el.innerHTML = countdownHTML(); }, 1000);

    const feed = await api('/feed');
    if (state.tab !== 'home') return;
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
        <div class="grow"><b>${esc(p.user.name)}</b>${handleTag(p.user)}<div class="muted small">loved ${w.e} ${w.short} · ${ago(p.createdAt)}</div></div>
        <span class="pill">+${p.stars}⭐</span></div>
      ${desc}${photosHTML(p.photos || [])}
      <div class="meta">${link}</div>
      <div class="actions"><button class="cheer ${p.cheered ? 'on' : ''}" data-cheer>${p.cheered ? '💛' : '🤍'} ${p.cheers || ''} <span class="small">${p.cheered ? 'Cheered' : 'Cheer'}</span></button>
        ${p.mine || state.me.isAdmin ? `<button class="del" data-del>Delete</button>` : ''}</div>
    </div>`;
  }
  const emptyFeed = () => `<div class="card empty"><div>🌱</div>Nothing yet. Log the first act of love!</div>`;
  function bindPosts(root) {
    bindViewer(root);
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
      <label class="lbl" for="desc">What did you do? <span class="muted small" style="font-weight:700">Tell us more 💬</span></label>
      <textarea id="desc" maxlength="1000" placeholder="Who was it, what did you do, and how did they respond?"></textarea>
      <label class="lbl">Add photos <span class="muted small" style="font-weight:700">(optional, up to 4)</span></label>
      <div id="logPhotos"></div>
      <label class="lbl">Who did you love?</label>
      <div class="who">${Object.entries(WHO).map(([k, w]) => `<button data-who="${k}"><span class="e">${w.e}</span><span><b>${w.label}</b></span><span class="s">+${state.me.stars[k]}⭐</span></button>`).join('')}</div>
      ${!link.mission && !link.task && openTasks.length ? `<label class="lbl" for="taskSel">Is this one of your goals? (optional)</label>
        <select id="taskSel" style="width:100%;padding:12px;border-radius:14px;border:2px solid var(--line);background:var(--card)"><option value="">No</option>${openTasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>` : ''}
      <label class="check"><input type="checkbox" id="pub" checked> Share the details with the group</label>
      <button class="btn block" id="save" disabled>Choose who you loved</button>`);
    const photos = mountPhotoPicker($('#logPhotos'));
    const save = $('#save');
    $('#sheet').querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
      who = b.dataset.who; haptic();
      $('#sheet').querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b));
      save.disabled = false; save.textContent = `Log it (+${state.me.stars[who]}⭐)`;
    });
    save.onclick = async () => {
      // If they picked a mission/goal and wrote nothing, use its title.
      const description = $('#desc').value.trim() || (link.mission ? link.mission.title : link.task ? link.task.title : '');
      if (!description) { toast('Tell us a little about what you did'); $('#desc').focus(); return; }
      save.disabled = true; save.textContent = photos.length ? 'Uploading…' : 'Saving…';
      try {
        const sel = $('#taskSel');
        const r = await api('/acts', { method: 'POST', body: { description, photos, recipient: who, isPublic: $('#pub').checked, missionId: link.mission?.id, taskId: link.task?.id || (sel && sel.value ? Number(sel.value) : null) } });
        closeSheet(); hearts();
        try { tg.HapticFeedback.notificationOccurred('success'); } catch (e) { }
        toast(`+${r.act.stars}⭐ Beautiful! You have ${r.stats.totalStars}⭐ now`, 3000);
        await refreshMe(); go(state.tab);
      } catch (e) { toast(e.message); save.disabled = false; save.textContent = `Log it (+${state.me.stars[who]}⭐)`; }
    };
  }

  // Reusable photo picker: returns the live array of shrunk photos (data URLs).
  function mountPhotoPicker(root, max = 4) {
    const photos = [];
    root.innerHTML = `<div class="photo-pick"></div><input type="file" accept="image/*" multiple hidden>`;
    const grid = root.querySelector('.photo-pick'), input = root.querySelector('input');
    const draw = () => {
      grid.innerHTML = photos.map((p, i) => `<div class="pick"><img src="${p}" alt=""><button data-rm="${i}" aria-label="Remove photo">✕</button></div>`).join('') +
        (photos.length < max ? `<button type="button" class="pick add">＋<span>Add photo</span></button>` : '');
      grid.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { photos.splice(Number(b.dataset.rm), 1); draw(); });
      const add = grid.querySelector('.add'); if (add) add.onclick = () => input.click();
    };
    input.onchange = async e => {
      for (const f of [...e.target.files].slice(0, max - photos.length)) {
        try { photos.push(await shrinkPhoto(f)); } catch (err) { toast(err.message); }
      }
      e.target.value = ''; draw();
    };
    draw();
    return photos;
  }
  function photosHTML(list) {
    const n = list.length;
    return n ? `<div class="photos p${Math.min(n, 4)}">${list.map(u => `<img src="${esc(u)}" alt="" loading="lazy" data-full="${esc(u)}">`).join('')}</div>` : '';
  }
  function bindViewer(root) {
    root.querySelectorAll('[data-full]').forEach(img => img.onclick = () => {
      const v = document.createElement('div'); v.className = 'viewer'; v.innerHTML = `<img src="${img.dataset.full}" alt="">`;
      v.onclick = () => v.remove(); document.body.appendChild(v);
    });
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
    view.innerHTML = `<h2 style="margin:4px 4px 12px">Be Inspired ⭐</h2>
      <div class="seg">${[['feed', '💌 Feed'], ['stories', '📖 Stories'], ['goals', '🎯 Goals'], ['board', '🏆 Ranks']].map(([k, l]) => `<button data-seg="${k}" class="${seg === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="groupBody"><div class="muted small">Loading…</div></div>`;
    view.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => { state.groupSeg = b.dataset.seg; haptic(); renderGroup(); });
    const body = $('#groupBody');
    if (seg === 'feed') {
      const feed = await api('/feed');
      body.innerHTML = feed.length ? feed.map(postHTML).join('') : emptyFeed();
      bindPosts(body);
    } else if (seg === 'stories') {
      const list = await api('/stories');
      body.innerHTML = `<button class="btn block" id="newStory" style="margin-bottom:14px">📸 Share a story</button>` +
        (list.length ? list.map(storyHTML).join('') : `<div class="card empty"><div>📖</div>Share how you spread God’s love to the people around you!</div>`);
      $('#newStory').onclick = openStoryComposer;
      bindStories(body);
    } else if (seg === 'goals') {
      const tasks = await api('/tasks');
      state.tasks = tasks;
      const open = tasks.filter(t => !t.doneAt), done = tasks.filter(t => t.doneAt);
      const item = t => `<div class="row"><div class="mini-av">${face(t.user.avatar)}</div><div class="grow"><b>${esc(t.user.name)}</b>${handleTag(t.user)}<div class="small" style="${t.doneAt ? 'opacity:.7' : ''}">${t.doneAt ? '✅ ' : ''}${esc(t.title)}</div></div><span class="muted small">${ago(t.doneAt || t.createdAt)}</span></div>`;
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
  // ---------------- stories ----------------
  function storyHTML(st) {
    const pics = photosHTML(st.photos);
    return `<div class="card post story" data-id="${st.id}">
      <div class="top"><div class="mini-av">${face(st.user.avatar)}</div>
        <div class="grow"><b>${esc(st.user.name)}</b>${handleTag(st.user)}<div class="muted small">shared a story · ${ago(st.createdAt)}</div></div></div>
      <p class="desc">${esc(st.body)}</p>${pics}
      <div class="actions"><button class="cheer ${st.liked ? 'on' : ''}" data-like>${st.liked ? '💛' : '🤍'} ${st.likes || ''} <span class="small">Inspired</span></button>
        ${st.mine || state.me.isAdmin ? `<button class="del" data-delstory>Delete</button>` : ''}</div></div>`;
  }
  function bindStories(root) {
    root.querySelectorAll('[data-like]').forEach(b => b.onclick = async () => {
      const id = b.closest('.story').dataset.id; haptic();
      const r = await api(`/stories/${id}/like`, { method: 'POST' });
      b.classList.toggle('on', r.liked);
      b.innerHTML = `${r.liked ? '💛' : '🤍'} ${r.likes || ''} <span class="small">Inspired</span>`;
    });
    root.querySelectorAll('[data-delstory]').forEach(b => b.onclick = () => confirmThen('Delete this story and its photos?', async () => {
      const card = b.closest('.story'); await api('/stories/' + card.dataset.id, { method: 'DELETE' }); card.remove(); toast('Deleted');
    }));
    bindViewer(root);
  }
  // Shrinks photos on the phone before upload (max 1280px, JPEG) so they load fast and stay small.
  function shrinkPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Could not read that photo'));
      img.src = url;
    });
  }
  function openStoryComposer() {
    openSheet(`
      <div class="sheet-head"><h2>Share a story 📖</h2><button class="x" data-close>✕</button></div>
      <p class="muted small" style="margin-top:4px">How did loving someone (or being loved) inspire you? Everyone in the group will see this.</p>
      <label class="lbl" for="stText">Your story</label>
      <textarea id="stText" maxlength="2000" style="min-height:130px" placeholder="e.g. I bought lunch for the uncle who sweeps our block. He told me no one had ever asked his name before…"></textarea>
      <label class="lbl">Photos (up to 4, optional)</label>
      <div id="storyPhotos"></div>
      <p class="muted small" style="margin-top:8px">Please ask before posting photos of other people 🙏</p>
      <button class="btn block" id="postStory" style="margin-top:14px">Share with the group</button>`);
    const photos = mountPhotoPicker($('#storyPhotos'));
    $('#postStory').onclick = async () => {
      const text = $('#stText').value.trim();
      if (!text) { toast('Write a few words about your story'); return; }
      const b = $('#postStory'); b.disabled = true; b.textContent = 'Sharing…';
      try {
        await api('/stories', { method: 'POST', body: { text, photos } });
        closeSheet(); hearts(); toast('Story shared! Thank you for inspiring us 💛', 3000);
        state.groupSeg = 'stories'; go('group');
      } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Share with the group'; }
    };
  }

  function boardRow(r, i) {
    const medal = ['🥇', '🥈', '🥉'][i];
    const me = r.id === state.me.user.id;
    return `<div class="row ${me ? 'me-row' : ''}"><div class="rank">${medal || i + 1}</div><div class="mini-av">${face(r.avatar)}</div>
      <div class="grow"><b>${esc(r.name)}${me ? ' (you)' : ''}</b>${handleTag(r)}<div class="muted small">${r.acts} act${r.acts === 1 ? '' : 's'} of love</div></div><span class="pill">${r.stars}⭐</span></div>`;
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
        <div class="grow"><h1>${esc(me.user.name)}</h1>${me.user.handle ? `<p class="muted small">@${esc(me.user.handle)}</p>` : ''}<button class="link" id="editAv2">✏️ Edit character & username</button></div></div>
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
    const u = state.me.user;
    const g0 = u.gender || (u.avatar && u.avatar.base) || 'girl';
    let av = Object.assign({}, Avatar.DEFAULTS[g0], u.avatar || {}, { base: g0 });
    ['hair', 'outfit', 'accessory'].forEach(k => { if (!Avatar.allowed(k, av[k], g0)) av[k] = Avatar.DEFAULTS[g0][k]; });
    const tabs = EDIT_TABS.filter(([k]) => k !== 'base' || !u.genderLocked);
    let cur = tabs[0][0];
    openSheet(`
      <div class="sheet-head"><h2>${first ? 'Create your character ✨' : 'My character'}</h2>${first ? '' : '<button class="x" data-close>✕</button>'}</div>
      <div class="editor-preview" id="prev"></div>
      <div style="text-align:center;margin-bottom:10px"><button class="link" id="rand">🎲 Surprise me</button></div>
      <div class="opt-tabs" id="otabs">${tabs.map(([k, l]) => `<button data-k="${k}">${l}</button>`).join('')}</div>
      <div id="opts"></div>
      <label class="lbl" for="nm">Username</label>
      <input type="text" id="nm" maxlength="20" autocapitalize="none" value="${esc(u.handle || '')}">
      <button class="btn block" id="saveAv" style="margin-top:14px">Save</button>`);
    const draw = () => {
      $('#prev').innerHTML = Avatar.render(av);
      $('#otabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === cur));
      const list = Avatar.optionsFor(cur, av.base);
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
      const pick = k => { const o = Avatar.optionsFor(k, av.base); return o[Math.floor(Math.random() * o.length)][0]; };
      // Only fun extras are random. Male/Female, skin, hair and background stay as the person chose.
      ['eyes', 'mouth', 'outfit', 'outfitColor', 'accessory', 'pose'].forEach(k => av[k] = pick(k));
      draw();
    };
    $('#saveAv').onclick = async () => {
      try {
        await api('/profile', { method: 'POST', body: { avatar: av, handle: $('#nm').value, gender: av.base } });
        await refreshMe(); closeSheet(); hearts(8); toast('Looking good! 😍'); go('home');
        if (first) setTimeout(startTour, 900); // brand new member: show them around
      } catch (e) { toast(e.message); }
    };
    draw();
  }

  // ---------------- guided tour (first time) + help ----------------
  const TOUR = [
    { tab: null, icon: '💛', title: 'Welcome to Love Better!', text: 'We love because He first loved us. This app helps our CG notice the small ways we can love people every day, and cheer each other on while we do it.', when: 'Here’s a quick tour. It takes about a minute.' },
    { tab: 'log', icon: '＋', title: 'Log an act of love', text: 'Tap the big ＋ button whenever you do something kind. Tell us what you did, add a photo if you like, and choose who you loved:<br>🌍 Someone you don’t know: <b>+3⭐</b><br>🤗 A friend: <b>+2⭐</b><br>⛪ Someone in CG: <b>+1⭐</b>', when: '<b>When:</b> right after you’ve loved someone, so you don’t forget!' },
    { tab: 'home', icon: '🏠', title: 'Home', text: 'See your stars, your day streak 🔥, the verse of the day, the countdowns to XMAS service and New Year, and how close our group is to our star goal.', when: '<b>When:</b> every day, for a quick check-in and some encouragement.' },
    { tab: 'missions', icon: '🎯', title: 'Missions & my goals', text: 'Need ideas? Pick a mission, go do it, then tap <b>“I did it!”</b>. You can also set your own love goals (like “cook dinner for mum”). Everyone can see them and cheer you on.', when: '<b>When:</b> at the start of your week, to plan who you’ll love.' },
    { tab: 'group', icon: '⭐', title: 'Be Inspired', text: '<b>Feed:</b> see what everyone did and tap Cheer.<br><b>Stories:</b> share a longer story with photos.<br><b>Goals:</b> see what others are working on.<br><b>Ranks:</b> the weekly and all-time leaderboard.', when: '<b>When:</b> whenever you need inspiration, or want to encourage someone.' },
    { tab: 'me', icon: '😊', title: 'Me', text: 'Your stats and who you’ve loved, the group’s stats, and where you can change your character and username.', when: '<b>When:</b> to see how you’re growing, or to give your character a new look.' },
    { tab: null, icon: '🤖', title: 'You can also just chat to the bot', text: 'In the Telegram chat, type what you did (for example “bought kopi for the cleaner auntie”) and the bot will log it for you. Try <b>/stars</b>, <b>/leaderboard</b> and <b>/countdown</b> too.', when: '<b>When:</b> when you’re on the go and want to log something quickly.' },
    { tab: 'help', icon: '?', title: 'Need help?', text: 'Tap the <b>?</b> button at the top right anytime to see these instructions again.', when: 'Now go love someone better today! 💛' },
  ];
  function startTour(step = 0) {
    endTour();
    const t = TOUR[step];
    document.body.classList.add('touring');
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('spot', b.dataset.tab === t.tab));
    $('#helpBtn').classList.toggle('spot', t.tab === 'help');
    const o = document.createElement('div'); o.className = 'tour'; o.id = 'tour';
    o.innerHTML = `<div class="tour-card" role="dialog" aria-modal="true">
      <div class="tour-icon">${t.icon}</div><h2>${t.title}</h2><p>${t.text}</p><p class="tour-when">${t.when}</p>
      <div class="dots">${TOUR.map((_, i) => `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>
      <div class="tour-btns">${step ? '<button class="btn ghost" id="tBack">Back</button>' : '<button class="btn ghost" id="tSkip">Skip</button>'}
        <button class="btn" id="tNext">${step === TOUR.length - 1 ? 'Let’s go! 💛' : 'Next'}</button></div></div>`;
    document.body.appendChild(o);
    haptic();
    $('#tNext').onclick = () => step === TOUR.length - 1 ? endTour() : startTour(step + 1);
    if ($('#tBack')) $('#tBack').onclick = () => startTour(step - 1);
    if ($('#tSkip')) $('#tSkip').onclick = endTour;
  }
  function endTour() {
    const o = $('#tour'); if (o) o.remove();
    document.body.classList.remove('touring');
    document.querySelectorAll('.spot').forEach(b => b.classList.remove('spot'));
  }

  function openHelp() {
    const sec = (icon, title, body) => `<details class="help"><summary><span>${icon}</span>${title}</summary><div>${body}</div></details>`;
    openSheet(`
      <div class="sheet-head"><h2>How to use Love Better</h2><button class="x" data-close>✕</button></div>
      <button class="btn block" id="replay" style="margin:10px 0 14px">▶️ Show me the tour again</button>
      ${sec('＋', 'Log an act of love', `Tap the big <b>＋</b> at the bottom. Tell us what you did, add photos if you like (optional, up to 4), choose who you loved, and tap <b>Log it</b>.<br><br>🌍 Someone you don’t know: <b>+3⭐</b><br>🤗 A friend: <b>+2⭐</b><br>⛪ Someone in CG: <b>+1⭐</b><br><br>Want to keep the details private? Untick <b>“Share the details with the group”</b>. You still get the stars, and others just see that you loved someone.`)}
      ${sec('🎯', 'Missions and my own goals', `Go to <b>Missions</b>. Pick a mission, do it, then tap <b>I did it!</b> to log it.<br><br>To set your own goal, type it under <b>My own love goals</b> and tap <b>Add</b>. When you’ve done it, tap <b>Done!</b> to log it and earn your stars.`)}
      ${sec('📖', 'Share a story with photos', `Go to <b>Be Inspired → Stories</b> and tap <b>Share a story</b>. Write what happened and add up to 4 photos. Please ask before posting photos of other people 🙏`)}
      ${sec('⭐', 'Cheer others on', `In <b>Be Inspired</b>, tap <b>Cheer</b> on an act of love or <b>Inspired</b> on a story to encourage the person.`)}
      ${sec('🏆', 'Leaderboard and stats', `<b>Be Inspired → Ranks</b> shows this week and all-time stars. <b>Me</b> shows your own stats, your streak 🔥 and the group’s progress.`)}
      ${sec('😊', 'Change my character or username', `Go to <b>Me</b> and tap <b>Edit character & username</b>. <b>🎲 Surprise me</b> mixes up your clothes, accessories, pose and expression.`)}
      ${sec('🔥', 'What is a streak?', `The number of days in a row you’ve logged at least one act of love. Log something every day to keep it going!`)}
      ${sec('🤖', 'Using the bot in the chat', `You can log without opening the app. Just type what you did to the bot, then choose who you loved. To add a photo, send the photo with a caption saying what you did.<br><br><b>/stars</b>: my stars<br><b>/leaderboard</b>: top 10<br><b>/countdown</b>: days to XMAS service and New Year<br><b>/verse</b>: verse of the day<br><b>/mute</b> or <b>/unmute</b>: turn announcements off or on`)}
      ${sec('🗑️', 'I made a mistake', `You can delete your own acts of love, stories and goals with the <b>Delete</b> button on them. The stars are removed too.`)}
      <p class="muted small" style="text-align:center;margin-top:16px">Still stuck? Message Richelle 💛</p>`);
    $('#replay').onclick = () => { closeSheet(); go('home'); startTour(); };
  }
  $('#helpBtn').onclick = () => { haptic(); openHelp(); };

  boot();
})();
