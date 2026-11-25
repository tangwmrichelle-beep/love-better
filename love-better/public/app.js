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
  // Who you loved -> heart colour. One heart per act of love goes into your jar.
  const WHO = {
    stranger: { label: 'Someone new', short: 'someone new', plural: ['new person', 'new people'], fill: '#FFF1B3', stroke: '#D4A017', color: '#F2C94C' },
    friend: { label: 'A friend', short: 'a friend', plural: ['friend', 'friends'], fill: '#C7E4FF', stroke: '#7FB5E6', color: '#8CC4F2' },
    family: { label: 'A family member', short: 'a family member', plural: ['family member', 'family members'], fill: '#FFD0E1', stroke: '#EE93B5', color: '#F4A6C4' },
    cg: { label: 'Someone in the CG', short: 'someone in the CG', plural: ['person in the CG', 'people in the CG'], fill: '#E2D4FF', stroke: '#A68AE6', color: '#B9A0F0' },
  };
  const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z';
  const heart = (type, size = 20) => { const w = WHO[type] || WHO.cg; return `<svg class="hrt" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}" fill="${w.fill}" stroke="${w.stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`; };
  const plural = (type, n) => `${n} ${WHO[type].plural[n === 1 ? 0 : 1]}`;
  const when = ts => new Date(ts).toLocaleString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' });

  // The heart jar: one heart per act, oldest at the bottom, coloured by who was loved.
  // cap = how many hearts fill the jar to the top (hearts shrink to fit). animate = hearts drop in one by one.
  let jarSeq = 0;
  const heartName = n => String(n || '').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 12);
  // One stitched fabric heart, centred on (0,0), hs units wide, with an optional name sewn on.
  function fabricHeart(t, hs, id, name) {
    const w = WHO[t] || WHO.cg, k = hs / 24;
    const fs = name.length > 9 ? 5 : 5.8, est = name.length * fs * 0.6, fit = est > 15.5 ? ` textLength="${(15.5 * k).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<g transform="translate(${-hs / 2} ${-hs / 2}) scale(${k})">
        <path d="${HEART_PATH}" fill="${w.fill}" stroke="${w.stroke}" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="${HEART_PATH}" fill="url(#${id}f)"/>
        <path d="${HEART_PATH}" transform="translate(12 12.4) scale(.8) translate(-12 -12.4)" fill="none" stroke="${w.stroke}" stroke-width=".75" stroke-dasharray="1.4 1.1" stroke-linecap="round"/>
        <path d="M6.4 6.6c-1.8.3-2.8 1.8-2.6 3.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>
      </g>${name ? `<text y="${(-hs * 0.02).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${(fs * k).toFixed(2)}" font-weight="900" fill="#4A3440" font-family="inherit"${fit}>${esc(name)}</text>` : ''}`;
  }
  // The heart jar: one stitched heart per act, oldest at the bottom, coloured by who was loved, with the giver's name on it.
  // style = the owner's jar look from the shop (jar shape & skin, neck tag). Tap a heart to read it.
  // cap = how many hearts the jar is sized for (it grows taller to hold more). names = sew names on.
  const JAR_KINDS = {
    // L/R: inside walls, T: where the glass body starts, minH: smallest body height, tagAt: where the tag string starts.
    'jar-mason': { T: 76, L: 22, R: 188, minH: 168, tagAt: [156, 64] },
    'jar-heart': { T: 70, L: 12, R: 198, minH: 176, tagAt: [150, 58] },
    'jar-peanut': { T: 70, L: 16, R: 194, minH: 150, tagAt: [178, 52] },
    'jar-jam': { T: 78, L: 20, R: 190, minH: 160, tagAt: [168, 66] },
    'jar-polka': { T: 76, L: 22, R: 188, minH: 168, tagAt: [156, 64] },
    'jar-choc': { T: 72, L: 18, R: 192, minH: 156, tagAt: [168, 56] },
  };
  function jarSVG(list, size = 160, { cap = 12, animate = false, names = true, style = null } = {}) {
    const id = 'j' + (++jarSeq);
    const kind = JAR_KINDS[style && style.jar] ? style.jar : 'jar-mason', K = JAR_KINDS[kind];
    const hs = names ? 36 : 30, rowH = hs * 0.8;
    // How wide the jar is inside at height y (so hearts follow the shape, e.g. the point of the heart jar).
    const widthAt = (y, T, yb) => {
      if (kind !== 'jar-heart') return [K.L + 4, K.R - 4];
      const h = yb - T, up = (yb - y) / h, half = (K.R - K.L) / 2, cx = (K.L + K.R) / 2;
      const w = up < 0.62 ? half * Math.min(1, up / 0.62) * 0.98 : half * (up > 0.85 ? 0.8 : 0.96);
      return [cx - w + 4, cx + w - 4];
    };
    // Lay hearts out row by row from the bottom; grow the jar until they fit (or it gets too tall).
    const layout = H => {
      const T = K.T, yb = T + H, spots = [];
      for (let r = 0; ; r++) {
        const y = yb - 4 - hs * 0.5 - r * rowH;
        if (y < T + hs * 0.45) break;
        const [xl, xr] = widthAt(y + hs * 0.25, T, yb), n = Math.floor((xr - xl) / (hs * 0.98));
        if (n < 1) continue;
        const step = (xr - xl) / n;
        for (let c = 0; c < n; c++) spots.push([xl + step * (c + 0.5) + (r % 2 ? step * 0.14 : -step * 0.1), y]);
      }
      return { yb, spots };
    };
    let H = K.minH, L = layout(H);
    while (L.spots.length < Math.max(cap, list.length + 4) && H < 420) { H += rowH; L = layout(H); }
    const { yb, spots } = L, VH = yb + 18;
    const shown = list.slice(-spots.length), hidden = list.length - shown.length;
    const spread = Math.min(3.4, shown.length * 0.1);
    const hearts = shown.map((h, i) => {
      const [x0, y0] = spots[i];
      const jx = (((i * 37) % 7) - 3) * 0.6, jy = (((i * 53) % 5) - 2) * 0.6, rot = ((i * 29) % 21) - 10;
      const d = animate ? `style="animation-delay:${(i / Math.max(1, shown.length - 1) * spread).toFixed(2)}s"` : '';
      return `<g class="jh" data-act="${h.id}" transform="translate(${(x0 + jx).toFixed(1)} ${(y0 + jy).toFixed(1)})"><g class="${animate ? 'hd' : ''}" ${d}><g transform="rotate(${rot})">${fabricHeart(h.r, hs, id, names ? heartName(h.name) : '')}</g></g></g>`;
    }).join('');
    const P = jarParts(kind, id, K, yb);
    return `<svg class="jar-svg" viewBox="0 0 210 ${VH}" width="${size}" height="${Math.round(size * VH / 210)}" role="img" aria-label="Heart jar with ${list.length} hearts">
      <defs>
        <clipPath id="${id}c">${P.body('')}</clipPath>
        <linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="${P.glass2}"/><stop offset=".45" stop-color="${P.glass}"/><stop offset="1" stop-color="${P.glass2}"/></linearGradient>
        <pattern id="${id}f" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><path d="M0 0L2.2 2.2M2.2 0L0 2.2" stroke="#fff" stroke-width=".35" opacity=".45"/><circle cx="1.1" cy="1.1" r=".25" fill="#000" opacity=".06"/></pattern>
        ${P.defs || ''}
      </defs>
      <ellipse cx="105" cy="${yb + 6}" rx="86" ry="7" fill="#000" opacity=".08"/>
      ${P.body(`fill="url(#${id}g)"`)}${P.glassBack || ''}
      <g clip-path="url(#${id}c)">${hearts}</g>
      <g pointer-events="none">${P.glassTop || ''}${P.body(`fill="none" stroke="${P.line}" stroke-width="3.5" vector-effect="non-scaling-stroke"`)}
      <g opacity=".55" fill="none" stroke="#fff" stroke-linecap="round"><path d="M${K.L + 11} ${K.T + 42} Q${K.L + 7} ${(K.T + 42 + yb) / 2} ${K.L + 10} ${yb - 30}" stroke-width="6"/></g>
      ${P.lid}${tagSVG(style && style.tag, K.tagAt)}</g>
      ${hidden > 0 ? `<g pointer-events="none"><rect x="67" y="${K.T + 40}" width="76" height="24" rx="12" fill="var(--card)" opacity=".92"/><text x="105" y="${K.T + 56}" text-anchor="middle" font-size="12" font-weight="900" fill="var(--text)">+${hidden} older</text></g>` : ''}
    </svg>`;
  }
  // The glass body, lid and decorations for each jar in the shop.
  function jarParts(kind, id, K, yb) {
    const path = d => attrs => `<path d="${d}" ${attrs}/>`;
    const glass = 'var(--jar-glass)', glass2 = 'var(--jar-glass2)', line = 'var(--jar-line)';
    const masonBody = `M56 76 Q22 84 22 110 V${yb - 20} Q22 ${yb} 42 ${yb} H168 Q188 ${yb} 188 ${yb - 20} V110 Q188 84 154 76 Z`;
    const screwLid = (c1, c2, c3, edge) => `
      <rect x="54" y="62" width="102" height="16" rx="4" fill="${glass}" stroke="${line}" stroke-width="3"/>
      <path d="M54 68 H156 M54 73 H156" stroke="${line}" stroke-width="1.6" opacity=".7"/>
      <defs><linearGradient id="${id}l" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
      <rect x="46" y="30" width="118" height="34" rx="5" fill="url(#${id}l)" stroke="${edge}" stroke-width="3"/>
      <path d="M48 39 H162 M48 47 H162 M48 55 H162" stroke="${edge}" stroke-width="1.8" opacity=".55"/>
      <path d="M52 34 H158" stroke="#fff" stroke-width="2" opacity=".5"/>
      <rect x="50" y="22" width="110" height="10" rx="4" fill="${c1}" stroke="${edge}" stroke-width="2.5"/>`;
    if (kind === 'jar-heart') {
      const sx = (K.R - K.L) / 22.2, sy = (yb - K.T) / 16.5;
      const tr = `transform="translate(${(K.L - 0.9 * sx).toFixed(2)} ${(K.T - 4.5 * sy).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})"`;
      return { glass: 'rgba(255,236,244,.8)', glass2: 'rgba(250,205,225,.85)', line: '#E89AB8',
        body: attrs => `<path d="${HEART_PATH}" ${tr} ${attrs}/>`,
        lid: `<rect x="80" y="50" width="50" height="20" rx="5" fill="rgba(255,236,244,.9)" stroke="#E89AB8" stroke-width="3"/>
          <rect x="72" y="24" width="66" height="28" rx="9" fill="#F7B6CD" stroke="#D97BA0" stroke-width="3"/>
          <path d="M78 33 H132 M78 42 H132" stroke="#D97BA0" stroke-width="1.6" opacity=".6"/><path d="M80 29 H130" stroke="#fff" stroke-width="2" opacity=".6"/>` };
    }
    if (kind === 'jar-peanut') {
      return { glass: 'rgba(240,206,150,.45)', glass2: 'rgba(214,160,90,.5)', line: '#C9974F',
        body: path(`M40 70 H170 Q194 70 194 94 V${yb - 22} Q194 ${yb} 172 ${yb} H38 Q16 ${yb} 16 ${yb - 22} V94 Q16 70 40 70 Z`),
        lid: `<rect x="12" y="30" width="186" height="42" rx="9" fill="#D9473B" stroke="#A42E25" stroke-width="3"/>
          ${Array.from({ length: 23 }, (_, i) => `<line x1="${22 + i * 7.5}" y1="36" x2="${22 + i * 7.5}" y2="66" stroke="#A42E25" stroke-width="2" opacity=".45"/>`).join('')}
          <path d="M20 35 H190" stroke="#fff" stroke-width="2.5" opacity=".45"/>`,
        glassTop: `<path d="M16 ${yb - 60} H194" stroke="#C9974F" stroke-width="1.5" opacity=".35"/>` };
    }
    if (kind === 'jar-jam') {
      return { glass: glass, glass2: glass2, line: line,
        body: path(`M42 78 H168 L190 100 V${yb - 16} Q190 ${yb} 174 ${yb} H36 Q20 ${yb} 20 ${yb - 16} V100 Z`),
        defs: `<pattern id="${id}gh" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff"/><rect width="6" height="12" fill="#E35D6A" opacity=".55"/><rect width="12" height="6" fill="#E35D6A" opacity=".55"/></pattern>`,
        glassTop: `<path d="M64 80 V${yb - 6} M105 80 V${yb - 4} M146 80 V${yb - 6}" stroke="#fff" stroke-width="2" opacity=".35"/>`,
        lid: `<rect x="50" y="56" width="110" height="24" rx="4" fill="${glass}" stroke="${line}" stroke-width="3"/>
          <path d="M40 30 Q105 6 170 30 L184 64 Q176 74 168 66 Q160 78 150 68 Q140 80 130 69 Q120 80 105 69 Q90 80 80 69 Q70 80 60 68 Q50 78 42 66 Q34 74 26 64 Z" fill="url(#${id}gh)" stroke="#B8404D" stroke-width="2.5"/>
          <path d="M44 58 Q105 70 166 58" stroke="#B07A45" stroke-width="3.5" fill="none"/>
          <path d="M160 60 q14 -12 16 2 q-12 4 -16 -2 z M160 60 q-2 16 10 14 q0 -10 -10 -14 z" fill="#D9A46A" stroke="#B07A45" stroke-width="1.5"/>` };
    }
    if (kind === 'jar-polka') {
      return { glass: glass, glass2: glass2, line: line, body: path(masonBody),
        defs: `<pattern id="${id}pd" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="3.2" fill="#fff" opacity=".85"/><circle cx="16" cy="16" r="3.2" fill="#F7A8C4" opacity=".8"/></pattern>`,
        glassBack: path(masonBody)(`fill="url(#${id}pd)" opacity=".8"`),
        lid: screwLid('#FFD3E2', '#F59BBB', '#E07FA4', '#C25C84') };
    }
    if (kind === 'jar-choc') {
      const lt = K.T + 16, lb = Math.min(yb - 50, K.T + 70);
      return { glass: 'rgba(150,100,70,.22)', glass2: 'rgba(110,70,45,.32)', line: '#8A5A3B',
        body: path(`M46 72 H164 Q192 76 192 104 V${yb - 24} Q192 ${yb} 166 ${yb} H44 Q18 ${yb} 18 ${yb - 24} V104 Q18 76 46 72 Z`),
        glassTop: `<rect x="18" y="${lt}" width="174" height="${lb - lt}" fill="#FFF6E8" opacity=".92"/>
          <path d="M18 ${lt + 4} H192 M18 ${lb - 4} H192" stroke="#C99B6D" stroke-width="2"/>
          <path d="M60 ${(lt + lb) / 2 + 6} q12 -18 24 0 t24 0 t24 0 t24 0" fill="none" stroke="#7A4A2A" stroke-width="5" stroke-linecap="round"/>
          <g transform="translate(96 ${(lt + lb) / 2 - 18}) scale(.75)"><path d="${HEART_PATH}" fill="#E07FA4"/></g>`,
        lid: `<rect x="28" y="30" width="154" height="44" rx="10" fill="#FBFBF8" stroke="#C9C3B8" stroke-width="3"/>
          ${Array.from({ length: 19 }, (_, i) => `<line x1="${36 + i * 7.5}" y1="38" x2="${36 + i * 7.5}" y2="66" stroke="#D8D2C6" stroke-width="2"/>`).join('')}
          <path d="M34 35 H176" stroke="#fff" stroke-width="2.5"/>` };
    }
    return { glass: glass, glass2: glass2, line: line, body: path(masonBody), lid: screwLid('#F1D9A4', '#D8B068', '#B98A40', '#9A7032') };
  }
  // A small charm hanging from the jar's neck on a string.
  function tagSVG(tag, [ax, ay]) {
    if (!tag || tag === 'tag-none') return '';
    const tx = Math.min(ax - 2, 152), ty = ay + 28;
    const str = `<path d="M${ax} ${ay} Q${ax + 16} ${ay + 10} ${tx + 22} ${ty + 2}" fill="none" stroke="#9A7032" stroke-width="2.2"/>`;
    const at = inner => `${str}<g transform="translate(${tx} ${ty}) rotate(8) scale(1.5)">${inner}</g>`;
    if (tag === 'tag-letter') return at(`<rect x="0" y="0" width="30" height="21" rx="3" fill="#FFFDF5" stroke="#C9A36A" stroke-width="2"/><path d="M1 2 L15 12 L29 2" fill="none" stroke="#C9A36A" stroke-width="2"/><g transform="translate(9.5 7) scale(.46)"><path d="${HEART_PATH}" fill="#E35D6A"/></g>`);
    if (tag === 'tag-plane') return at(`<path d="M0 12 L32 0 L22 26 L15 17 Z" fill="#fff" stroke="#5B8EC9" stroke-width="2" stroke-linejoin="round"/><path d="M15 17 L32 0 M15 17 L14 25 L19 21" fill="none" stroke="#5B8EC9" stroke-width="2" stroke-linejoin="round"/>`);
    if (tag === 'tag-bear') return at(`<circle cx="6" cy="5" r="5.5" fill="#B07A4A" stroke="#7A4F2A" stroke-width="1.6"/><circle cx="26" cy="5" r="5.5" fill="#B07A4A" stroke="#7A4F2A" stroke-width="1.6"/><circle cx="16" cy="15" r="12" fill="#C68A55" stroke="#7A4F2A" stroke-width="1.8"/><ellipse cx="16" cy="20" rx="6" ry="4.5" fill="#F1D3B0"/><circle cx="11.5" cy="13" r="1.6" fill="#3A2A20"/><circle cx="20.5" cy="13" r="1.6" fill="#3A2A20"/><ellipse cx="16" cy="18.5" rx="2" ry="1.4" fill="#3A2A20"/>`);
    if (tag === 'tag-dog') return at(`<ellipse cx="4" cy="12" rx="4.5" ry="9" fill="#8A5A36" transform="rotate(15 4 12)"/><ellipse cx="28" cy="12" rx="4.5" ry="9" fill="#8A5A36" transform="rotate(-15 28 12)"/><circle cx="16" cy="14" r="11.5" fill="#E9C99A" stroke="#8A5A36" stroke-width="1.8"/><ellipse cx="16" cy="20" rx="6.5" ry="4.5" fill="#FFF3E2"/><circle cx="11.5" cy="12" r="1.6" fill="#3A2A20"/><circle cx="20.5" cy="12" r="1.6" fill="#3A2A20"/><ellipse cx="16" cy="17.5" rx="2.4" ry="1.7" fill="#3A2A20"/><path d="M16 19 v2.5" stroke="#3A2A20" stroke-width="1.2"/>`);
    return '';
  }
  // The background behind someone's jar: a free colour, plus a pattern from the shop.
  const svgUrl = svg => `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;
  const BG_PATTERNS = {
    'bg-dots': 'radial-gradient(circle, rgba(0,0,0,.09) 2.6px, transparent 3.2px) 0 0/18px 18px',
    'bg-stripes': 'repeating-linear-gradient(45deg, rgba(33,122,120,.08) 0 9px, transparent 9px 18px)',
    'bg-hearts': `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'><g transform='translate(3 3) scale(.5)' fill='rgba(232,110,150,.3)'><path d='${HEART_PATH}'/></g><g transform='translate(18 18) scale(.38)' fill='rgba(232,110,150,.24)'><path d='${HEART_PATH}'/></g></svg>`)} 0 0/30px 30px`,
    'bg-gingham': 'linear-gradient(90deg, rgba(120,90,160,.10) 50%, transparent 50%) 0 0/22px 22px, linear-gradient(rgba(120,90,160,.10) 50%, transparent 50%) 0 0/22px 22px',
    'bg-stars': `${svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'><path d='M9 2l2 5 5 .5-4 3.5 1.3 5L9 13.3 4.7 16 6 11 2 7.5 7 7z' fill='rgba(230,170,40,.4)'/><circle cx='26' cy='25' r='1.8' fill='rgba(230,170,40,.4)'/></svg>`)} 0 0/34px 34px`,
  };
  function stageStyle(style) {
    const s = style || {}, color = s.color || '#FFFFFF';
    const pat = BG_PATTERNS[s.bg];
    return `background:${pat ? pat + ', ' : ''}${color};`;
  }
  // A jar on its background, as shown on Me, Ranks, someone's jar page and in the shop.
  const jarStage = (inner, style, cls = '') => `<div class="jar-stage ${cls}" style="${stageStyle(style)}">${inner}</div>`;
  // A single stitched heart (same design as in the jar, no name), for legends.
  function stitchedHeart(type, size = 24) {
    const id = 'sh' + (++jarSeq);
    return `<svg class="hrt" width="${size}" height="${size}" viewBox="-13 -13 26 26" aria-hidden="true"><defs><pattern id="${id}f" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><path d="M0 0L2.2 2.2M2.2 0L0 2.2" stroke="#fff" stroke-width=".35" opacity=".45"/></pattern></defs>${fabricHeart(type, 24, id, '')}</svg>`;
  }
  // Makes every heart in el tappable.
  function bindJar(el) { el.querySelectorAll('[data-act]').forEach(g => g.addEventListener('click', e => { e.stopPropagation(); haptic(); openHeart(Number(g.dataset.act)); })); }

  // What someone shared, shown as a card on top of whatever is open.
  async function openHeart(actId) {
    let a; try { a = await api('/acts/' + actId); } catch (e) { return toast(e.message); }
    const w = WHO[a.recipient];
    const back = document.createElement('div');
    back.className = 'hpop-back';
    back.innerHTML = `<div class="hpop" style="--hf:${w.fill};--hc:${w.stroke}">
      <button class="x" data-x aria-label="Close">✕</button>
      <div class="hpop-heart"><svg viewBox="-24 -24 48 48" width="96" height="96"><defs><pattern id="popf" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><path d="M0 0L2.2 2.2M2.2 0L0 2.2" stroke="#fff" stroke-width=".35" opacity=".45"/></pattern></defs>${fabricHeart(a.recipient, 46, 'pop', heartName(a.user.name))}</svg></div>
      <p class="hpop-who"><b>${esc(a.user.name)}</b> loved ${esc(w.short)}</p>
      <p class="muted small" style="margin:2px 0 10px">${when(a.createdAt)}</p>
      ${a.description != null ? `<p class="desc">${esc(a.description)}</p>` : '<p class="desc muted">They kept the details private 🤫</p>'}
      ${photosHTML(a.photos)}
      ${a.mission ? `<span class="pill rose">${esc(a.mission.emoji || '🎯')} ${esc(a.mission.title)}</span>` : a.task ? `<span class="pill rose">🎯 ${esc(a.task)}</span>` : ''}
    </div>`;
    document.body.appendChild(back);
    back.onclick = e => { if (e.target === back || e.target.closest('[data-x]')) back.remove(); };
    bindViewer(back);
  }

  // "I have loved 3 strangers, 4 friends…" as one sentence; each part is a tappable filter.
  function lovedSentence(byType, who, filter) {
    const LEGEND = { stranger: 'Someone new', friend: 'A friend', family: 'A family member', cg: 'Someone in the CG' };
    const parts = Object.keys(WHO).map(k => `<button class="legend-item ${filter === k ? 'on' : ''}" data-f="${k}" style="--hc:${WHO[k].stroke}">${stitchedHeart(k, 26)}<span>${LEGEND[k]}</span></button>`);
    return `<p class="legend-title">What each heart means</p><div class="legend">${parts.join('')}</div>`;
  }
  // Everything behind the hearts as a scrollable story, newest first, grouped by day.
  function dayLabel(ts) {
    const day = t => new Date(t).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' });
    if (day(ts) === day(Date.now())) return 'Today';
    if (day(ts) === day(Date.now() - 864e5)) return 'Yesterday';
    return new Date(ts).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });
  }
  const timeOf = ts => new Date(ts).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' });
  function storyListHTML(list, filter, mine) {
    if (!list.length) return `<div class="empty"><div>🫙</div>${filter ? `No ${WHO[filter].plural[1]} yet.` : mine ? 'Your memories start with your first heart. Go love someone today!' : 'No hearts here yet.'}</div>`;
    let last = '', out = '';
    for (const a of list) {
      const d = dayLabel(a.createdAt);
      if (d !== last) { out += `<div class="tl-day">${esc(d)}</div>`; last = d; }
      out += `<div class="tl-item" style="--hc:${WHO[a.recipient].stroke};--hf:${WHO[a.recipient].fill}">
        <div class="tl-dot">${heart(a.recipient, 22)}</div>
        <div class="tl-body"><div class="tl-meta"><b>${esc(WHO[a.recipient].label)}</b><span>${timeOf(a.createdAt)}</span></div>
          ${a.description != null ? `<p class="desc">${esc(a.description)}</p>` : '<p class="desc muted">Kept private 🤫</p>'}
          ${photosHTML(a.photos)}
          ${a.mission ? `<span class="pill rose">${esc(a.mission.emoji || '🎯')} ${esc(a.mission.title)}</span>` : a.task ? `<span class="pill rose">🎯 ${esc(a.task)}</span>` : ''}</div></div>`;
    }
    return out;
  }
  // Mounts the sentence + story into root. Tap a coloured part of the sentence to show only those hearts.
  function mountStory(root, userId, j, who, filter = null) {
    const load = async f => {
      filter = f;
      root.querySelector('.loved-wrap').innerHTML = lovedSentence(j.byType, who, f) +
        `<p class="muted small tl-hint">${f ? `Showing only ${WHO[f].plural[1]} · <button class="link" data-clear>Show all</button>` : 'Tap a heart colour to see only those memories'}</p>`;
      root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { haptic(); load(filter === b.dataset.f ? null : b.dataset.f); });
      const c = root.querySelector('[data-clear]'); if (c) c.onclick = () => load(null);
      const list = await api(`/users/${userId}/acts${f ? '?recipient=' + f : ''}`);
      const el = root.querySelector('.tl'); if (!el) return;
      el.innerHTML = storyListHTML(list, f, j.mine);
      bindViewer(el);
    };
    load(filter);
  }

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
      s.textContent = ['💛', '🩵', '🩷', '💜', '✨'][i % 5];
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
    $('#tabs').hidden = false; $('#helpBtn').hidden = false; $('#bellBtn').hidden = false; setBadge(state.me.unread);
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

  async function refreshMe() { state.me = await api('/me'); setBadge(state.me.unread); }
  function setBadge(n) { const b = $('#bellBadge'); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  setInterval(() => { if (state.me && state.me.approved && !document.hidden) api('/notifications/unread').then(r => setBadge(r.unread)).catch(() => {}); }, 60000);

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
    const pct = Math.min(100, Math.round(((g.totalActs || 0) / (g.goal || 1)) * 100));
    view.innerHTML = `
      <div class="hello">
        <button class="av" id="editAv" aria-label="Edit avatar">${face(me.user.avatar)}</button>
        <div><p class="muted small" style="font-weight:800">${greeting()}</p><h1>${esc(me.user.name)}</h1><p class="muted small">How can I love someone better today?</p></div>
      </div>
      <button class="card jar-card" id="myJar" aria-label="Open the AW2 love others jar">
        <div class="jar-wrap" id="homeJar"></div>
        <div class="jar-info"><span class="muted small" style="font-weight:800">My heart jar</span>
          <b class="jar-count">${s.totalStars}<small> heart${s.totalStars === 1 ? '' : 's'}</small></b>
          <div class="jar-legend">${Object.keys(WHO).map(k => `<span>${heart(k, 16)}${s.byType[k] || 0}</span>`).join('')}</div>
          <span class="muted small">${s.streak}🔥 day streak · ⭐ ${me.points || 0} star points</span>
          <span class="jar-cta">See the AW2 jar ›</span></div>
      </button>
      <button class="cta" id="quickLog">
        <span class="cta-icon">💛</span>
        <span class="cta-text"><b>Share how you loved someone today</b><small>Add a heart to your jar 💛</small></span>
        <span class="cta-go" aria-hidden="true">＋</span>
      </button>
      <div class="card verse"><p>“${esc(me.verse.text)}”</p><p class="ref">${esc(me.verse.ref)}</p></div>
      <div class="section-title"><h3>Countdowns</h3></div>
      <div class="countdown" id="cd">${countdownHTML()}</div>
      <div class="section-title"><h3>AW2 love others jar</h3><span class="muted small">${g.members} of us</span></div>
      <button class="card goal-card" id="cgJarBtn">
        <div style="display:flex;justify-content:space-between;font-weight:800"><span>💛 ${g.totalActs || 0} ${(g.totalActs || 0) === 1 ? 'person' : 'people'} loved together</span><span class="muted">Goal ${g.goal}</span></div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <span class="jar-cta">Watch our jar fill up ›</span>
      </button>
      ${me.isAdmin ? `<button class="link small" id="editGoal" style="margin:-4px 4px 10px">✏️ Admin: change the goal</button>` : ''}
      <div class="section-title"><h3>Latest from the group</h3><button class="link" id="seeFeed">See all</button></div>
      <div id="latest"></div>`;
    $('#editAv').onclick = () => openAvatarEditor();
    $('#quickLog').onclick = () => openLog();
    $('#myJar').onclick = $('#cgJarBtn').onclick = () => openCgJar();
    api('/users/' + me.user.id + '/jar').then(j => { const el = $('#homeJar'); if (el) el.innerHTML = jarStage(jarSVG(j.hearts, 104, { names: false, style: me.user.jar }), me.user.jar, 'home-stage'); }).catch(() => {});
    $('#seeFeed').onclick = () => { state.groupSeg = 'feed'; go('group'); };
    if (me.isAdmin) $('#editGoal').onclick = () => {
      openSheet(`<div class="sheet-head"><h2>AW2 jar goal</h2><button class="x" data-close>✕</button></div>
        <p class="muted small" style="margin:4px 0 10px">How many people should the CG aim to love together? Every post counts as one person loved.</p>
        <input type="text" inputmode="numeric" id="goalIn" value="${g.goal}">
        <button class="btn block" id="goalSave" style="margin-top:12px">Save goal</button>`);
      $('#goalSave').onclick = async () => {
        try { await api('/group/goal', { method: 'PUT', body: { goal: $('#goalIn').value } }); closeSheet(); toast('Goal saved 🎯'); await refreshMe(); renderHome(); }
        catch (e) { toast(e.message); }
      };
    };
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
        <div class="grow"><b>${esc(p.user.name)}</b>${handleTag(p.user)}<div class="muted small">loved ${w.short} · ${ago(p.createdAt)}</div></div>
        <span class="post-heart" title="${esc(w.label)}">${heart(p.recipient, 28)}</span></div>
      ${desc}${photosHTML(p.photos || [])}
      <div class="meta">${link}</div>
      <div class="reacts">${reactsHTML(p.reactions || [])}</div>
      ${notesHTML(p)}
      ${p.mine || state.me.isAdmin ? `<div class="actions"><span></span><button class="del" data-del>Delete post</button></div>` : ''}
    </div>`;
  }
  const reactsHTML = list => list.map(r => `<button class="react ${r.mine ? 'on' : ''}" data-react="${r.emoji}">${r.emoji}${r.count ? `<b>${r.count}</b>` : ''}</button>`).join('');
  function noteHTML(n) {
    return `<div class="note" data-note="${n.id}"><div class="mini-av xs">${face(n.user.avatar)}</div>
      <div class="grow"><div class="note-bubble"><b>${esc(n.user.name)}</b> <span class="muted small">${ago(n.createdAt)}</span><div class="note-body">${esc(n.body)}</div></div>
      ${n.mine || state.me.isAdmin ? `<button class="del small" data-del-note>Remove</button>` : ''}</div></div>`;
  }
  function notesHTML(p) {
    return `<div class="notes"><div class="note-list">${(p.notes || []).map(noteHTML).join('')}</div>
      <form class="note-form" data-note-form><textarea rows="1" maxlength="2000" placeholder="Write a note of encouragement…"></textarea><button class="btn small" type="submit">Send</button></form></div>`;
  }
  const emptyFeed = () => `<div class="card empty"><div>🌱</div>Nothing yet. Log the first act of love!</div>`;
  function bindPosts(root) {
    bindViewer(root);
    const bindReacts = box => box.querySelectorAll('[data-react]').forEach(b => b.onclick = async () => {
      const card = b.closest('.post'); haptic();
      const r = await api(`/acts/${card.dataset.id}/react`, { method: 'POST', body: { emoji: b.dataset.react } });
      const row = card.querySelector('.reacts'); row.innerHTML = reactsHTML(r.reactions); bindReacts(row);
    });
    bindReacts(root);
    const bindNoteDel = box => box.querySelectorAll('[data-del-note]').forEach(b => b.onclick = () => confirmThen('Remove this note?', async () => {
      const n = b.closest('.note'); await api(`/notes/${n.dataset.note}`, { method: 'DELETE' }); n.remove();
    }));
    bindNoteDel(root);
    root.querySelectorAll('[data-note-form]').forEach(f => {
      const ta = f.querySelector('textarea');
      ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
      f.onsubmit = async e => {
        e.preventDefault();
        const body = ta.value.trim(); if (!body) return;
        const btn = f.querySelector('button'); btn.disabled = true;
        try {
          const card = f.closest('.post');
          const r = await api(`/acts/${card.dataset.id}/notes`, { method: 'POST', body: { body } });
          const list = card.querySelector('.note-list');
          list.insertAdjacentHTML('beforeend', noteHTML(r.note)); bindNoteDel(list.lastElementChild);
          ta.value = ''; ta.style.height = ''; haptic(); toast('Note sent 💌');
        } catch (err) { toast(err.message || 'Could not send'); }
        btn.disabled = false;
      };
    });
    root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmThen('Delete this act? Its heart will be removed from the jar.', async () => {
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
    view.innerHTML = `<h2 style="margin:4px 4px 4px">Missions</h2><p class="muted small" style="margin:0 4px 14px">Pick one, go do it, then tap “I did it!” to add a heart to your jar.</p>
      <div class="section-title" style="margin-top:6px"><h3>🎯 Your own missions</h3></div>
      <div class="card">
        <p class="muted small" style="margin-bottom:10px">Set your own mission to love someone better. Everyone in the group can see it and cheer you on.</p>
        <div style="display:flex;gap:8px"><input type="text" id="newTask" maxlength="200" placeholder="e.g. Cook dinner for my mum this week"><button class="btn" id="addTask">Add</button></div>
        <div id="myTasks" style="margin-top:8px"></div>
      </div>
      <div id="missionList"><div class="muted small">Loading…</div></div>
      ${state.me.isAdmin ? `<div class="card admin"><h3>Admin: add a mission</h3>
        <select id="mCat" style="width:100%;margin-top:10px;padding:12px;border-radius:14px;border:2px solid var(--line);background:var(--card)"><option value="hear">To love is to hear</option><option value="see">To love is to see</option><option value="delight">To love is to delight</option></select>
        <div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="mEmoji" value="💛" style="width:64px;text-align:center"><input type="text" id="mTitle" placeholder="Mission title"></div>
        <textarea id="mDesc" placeholder="Short description (optional)" style="margin-top:8px;min-height:60px"></textarea>
        <button class="btn block" id="addMission" style="margin-top:8px">Add mission</button></div>` : ''}`;
    $('#addTask').onclick = async () => {
      const title = $('#newTask').value.trim(); if (!title) return;
      try { await api('/tasks', { method: 'POST', body: { title } }); $('#newTask').value = ''; haptic('medium'); toast('Mission added 💪'); loadTasks(); } catch (e) { toast(e.message); }
    };
    if (state.me.isAdmin) $('#addMission').onclick = async () => {
      try { await api('/missions', { method: 'POST', body: { category: $('#mCat').value, emoji: $('#mEmoji').value, title: $('#mTitle').value, description: $('#mDesc').value } }); toast('Mission added'); renderMissions(); } catch (e) { toast(e.message); }
    };
    loadTasks();
    const data = await api('/missions');
    state.missions = data.missions;
    if (state.tab !== 'missions') return;
    const card = m => `<div class="card mission">
      <div class="emoji">${esc(m.emoji || '💛')}</div>
      <div class="grow"><h3>${esc(m.title)}</h3>${m.description ? `<p>${esc(m.description)}</p>` : ''}
        <div class="foot"><button class="btn small" data-mission="${m.id}">I did it!</button>
          ${m.mine ? `<span class="pill">✔ You: ${m.mine}×</span>` : ''}<span class="muted small">${m.everyone} done in group</span>
          ${state.me.isAdmin ? `<span class="admin-acts"><button class="del" data-edit="${m.id}">✏️ Edit</button><button class="del" data-archive="${m.id}">Remove</button></span>` : ''}</div></div></div>`;
    const sections = data.categories.map(c => ({ ...c, list: state.missions.filter(m => m.category === c.key) }));
    const other = state.missions.filter(m => !data.categories.some(c => c.key === m.category));
    if (other.length) sections.push({ key: 'other', emoji: '✨', title: 'More missions', list: other });
    $('#missionList').innerHTML = sections.map(c => `<div class="cat-head"><span class="cat-emoji">${c.emoji}</span><div><h3>${esc(c.title)}</h3>${c.heart ? `<p class="cat-heart">“${esc(c.heart)}”</p>` : ''}${c.about ? `<p class="muted small">${esc(c.about)}</p>` : ''}${state.me.isAdmin && c.key !== 'other' ? `<button class="link small" data-editcat="${c.key}">Edit this section</button>` : ''}</div></div>
      ${c.list.map(card).join('') || '<p class="muted small" style="margin:0 4px 14px">No missions here yet.</p>'}`).join('');
    view.querySelectorAll('[data-mission]').forEach(b => b.onclick = () => openLog({ mission: state.missions.find(m => m.id == b.dataset.mission) }));
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openMissionEditor(state.missions.find(m => m.id == b.dataset.edit), data.categories));
    view.querySelectorAll('[data-editcat]').forEach(b => b.onclick = () => openCategoryEditor(data.categories.find(c => c.key === b.dataset.editcat)));
    view.querySelectorAll('[data-archive]').forEach(b => b.onclick = () => confirmThen('Remove this mission for everyone?', async () => { await api('/missions/' + b.dataset.archive, { method: 'DELETE' }); renderMissions(); }));
  }
  // Admin: change a mission's section, emoji, title or description.
  function openMissionEditor(m, cats) {
    openSheet(`
      <div class="sheet-head"><h2>Edit mission</h2><button class="x" data-close>✕</button></div>
      <label class="field-label">Section</label>
      <select id="eCat" class="field">${cats.map(c => `<option value="${c.key}" ${c.key === m.category ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
      <label class="field-label">Emoji and title</label>
      <div style="display:flex;gap:8px"><input type="text" id="eEmoji" value="${esc(m.emoji || '💛')}" style="width:64px;text-align:center"><input type="text" id="eTitle" maxlength="120" value="${esc(m.title)}"></div>
      <label class="field-label">Description</label>
      <textarea id="eDesc" maxlength="300" style="min-height:80px">${esc(m.description || '')}</textarea>
      <button class="btn block" id="eSave" style="margin-top:12px">Save changes</button>`);
    $('#eSave').onclick = async () => {
      try { await api('/missions/' + m.id, { method: 'PUT', body: { category: $('#eCat').value, emoji: $('#eEmoji').value, title: $('#eTitle').value, description: $('#eDesc').value } });
        closeSheet(); toast('Mission updated ✏️'); renderMissions(); } catch (e) { toast(e.message); }
    };
  }
  // Admin: change a section's heart line and description.
  function openCategoryEditor(c) {
    openSheet(`
      <div class="sheet-head"><h2>${esc(c.emoji)} ${esc(c.title)}</h2><button class="x" data-close>✕</button></div>
      <label class="field-label">Heart line</label>
      <input type="text" id="cHeart" maxlength="120" value="${esc(c.heart || '')}" placeholder="e.g. What you say matters to me">
      <label class="field-label">Description</label>
      <textarea id="cAbout" maxlength="400" style="min-height:80px">${esc(c.about || '')}</textarea>
      <button class="btn block" id="cSave" style="margin-top:12px">Save changes</button>`);
    $('#cSave').onclick = async () => {
      try { await api('/categories/' + c.key, { method: 'PUT', body: { heart: $('#cHeart').value, about: $('#cAbout').value } });
        closeSheet(); toast('Section updated ✏️'); renderMissions(); } catch (e) { toast(e.message); }
    };
  }

  async function loadTasks() {
    state.tasks = await api('/tasks');
    const el = $('#myTasks'); if (!el) return;
    const mine = state.tasks.filter(t => t.user.id === state.me.user.id);
    el.innerHTML = mine.length ? mine.map(t => `<div class="row">
      <span style="font-size:20px">${t.doneAt ? '✅' : '⬜'}</span>
      <div class="grow" style="${t.doneAt ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(t.title)}</div>
      ${t.doneAt ? '' : `<button class="btn small" data-done="${t.id}">Done!</button>`}
      <button class="del" data-deltask="${t.id}" aria-label="Delete">✕</button></div>`).join('') : `<p class="muted small">No missions yet.</p>`;
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = () => openLog({ task: mine.find(t => t.id == b.dataset.done) }));
    el.querySelectorAll('[data-deltask]').forEach(b => b.onclick = () => confirmThen('Delete this mission?', async () => { await api('/tasks/' + b.dataset.deltask, { method: 'DELETE' }); loadTasks(); }));
  }

  // ---------------- log sheet ----------------
  // Questions shown above the text box to help people say more.
  const STORY_PROMPTS = ['What did you notice?', 'What did you do?', 'How did they respond?', 'How did it feel?', 'What did God show you?'];
  function openLog(link = {}) {
    haptic('medium');
    let who = null;
    const openTasks = (state.tasks || []).filter(t => t.user.id === state.me.user.id && !t.doneAt);
    const linked = link.mission ? `${link.mission.emoji || '🎯'} ${link.mission.title}` : link.task ? `🎯 ${link.task.title}` : '';
    openSheet(`
      <div class="sheet-head"><h2>Share how you loved someone today 💛</h2><button class="x" data-close>✕</button></div>
      ${linked ? `<div class="linked" style="margin-top:10px"><span>${esc(linked)}</span></div>` : ''}
      <p class="muted small" style="margin:14px 2px 4px">Not sure what to write? Here are some prompts to help you:</p>
      <ul class="prompt-list">${STORY_PROMPTS.map(p => `<li>${p}</li>`).join('')}</ul>
      <textarea id="desc" class="story-box" placeholder="Write here…"></textarea>
      <label class="lbl">Add photos <span class="muted small" style="font-weight:700">(optional, up to 4)</span></label>
      <div id="logPhotos"></div>
      <label class="lbl">Who did you love?</label>
      <div class="who">${Object.entries(WHO).map(([k, w]) => `<button data-who="${k}" style="--hc:${w.stroke};--hf:${w.fill}"><span class="e">${heart(k, 30)}</span><span><b>${w.label}</b></span></button>`).join('')}</div>
      ${!link.mission && !link.task && openTasks.length ? `<label class="lbl" for="taskSel">Is this one of your own missions? (optional)</label>
        <select id="taskSel" style="width:100%;padding:12px;border-radius:14px;border:2px solid var(--line);background:var(--card)"><option value="">No</option>${openTasks.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>` : ''}
      <label class="check"><input type="checkbox" id="pub" checked> Share the details with the group</label>
      <button class="btn block" id="save" disabled>Choose who you loved</button>`);
    const photos = mountPhotoPicker($('#logPhotos'));
    const desc = $('#desc');
    const grow = () => { desc.style.height = 'auto'; desc.style.height = Math.max(150, desc.scrollHeight + 4) + 'px'; };
    desc.addEventListener('input', grow);
    const save = $('#save');
    $('#sheet').querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
      who = b.dataset.who; haptic();
      $('#sheet').querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b));
      save.disabled = false; save.textContent = 'Add a heart to my jar';
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
        toast(`Heart added to your jar! You have ${r.stats.totalStars} ♥ now`, 3000);
        await refreshMe(); go(state.tab);
      } catch (e) { toast(e.message); save.disabled = false; save.textContent = 'Add a heart to my jar'; }
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
    if (state.groupSeg === 'stories') state.groupSeg = 'feed';
    const seg = state.groupSeg;
    view.innerHTML = `<h2 style="margin:4px 4px 12px">Be Inspired ⭐</h2>
      <div class="seg">${[['feed', '💌 Feed'], ['goals', '🎯 Missions'], ['board', '🏆 Ranks'], ['shop', '🛍️ Shop']].map(([k, l]) => `<button data-seg="${k}" class="${seg === k ? 'on' : ''}">${l}</button>`).join('')}</div>
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
      const item = t => `<div class="row"><div class="mini-av">${face(t.user.avatar)}</div><div class="grow"><b>${esc(t.user.name)}</b>${handleTag(t.user)}<div class="small" style="${t.doneAt ? 'opacity:.7' : ''}">${t.doneAt ? '✅ ' : ''}${esc(t.title)}</div></div><span class="muted small">${ago(t.doneAt || t.createdAt)}</span></div>`;
      body.innerHTML = `<div class="card"><h3>Working on it 💪</h3>${open.length ? open.map(item).join('') : '<p class="muted small" style="margin-top:8px">No open missions. Add your own in Missions!</p>'}</div>
        ${done.length ? `<div class="card"><h3>Done 🎉</h3>${done.slice(0, 30).map(item).join('')}</div>` : ''}
        <button class="btn ghost block" id="toMissions">＋ Add my own mission</button>`;
      $('#toMissions').onclick = () => go('missions');
    } else if (seg === 'shop') {
      await renderShop(body);
    } else {
      body.innerHTML = `<div class="seg" style="box-shadow:none;background:var(--rose-soft)">${[['week', 'This week'], ['all', 'All time']].map(([k, l]) => `<button data-p="${k}" class="${state.boardPeriod === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="card" id="board">Loading…</div>`;
      body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { state.boardPeriod = b.dataset.p; renderGroup(); });
      const rows = await api('/leaderboard?period=' + state.boardPeriod);
      $('#board').innerHTML = rows.length ? rows.map(boardRow).join('') : '<p class="muted">No one here yet.</p>';
      $('#board').querySelectorAll('[data-user]').forEach(r => r.onclick = () => openJar(Number(r.dataset.user)));
    }
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
  // The whole CG's shared jar, as a big card. Hearts drop in one by one.
  async function openCgJar() {
    const j = await api('/group/jar');
    const pct = Math.min(100, Math.round(j.total / (j.goal || 1) * 100));
    openSheet(`
      <div class="sheet-head"><h2>AW2 love others jar</h2><button class="x" data-close>✕</button></div>
      <div class="cg-jar">
        <div class="cg-jar-art">${jarSVG(j.hearts, 270, { animate: true })}</div>
        <p class="muted small" style="margin:-4px 0 6px">Tap a heart to read what was shared</p>
        <p class="cg-count"><b id="cgN">0</b> <span>of ${j.goal} people loved</span></p>
        <div class="progress"><div id="cgBar" style="width:0%"></div></div>
        <p class="loved-title" style="margin-top:16px">Together we have loved…</p><div class="loved-chips">${Object.keys(WHO).map(k => `<span class="hl" style="--hf:${WHO[k].fill};--hc:${WHO[k].stroke}">${heart(k, 18)} ${plural(k, j.byType[k] || 0)}</span>`).join('')}</div>
        <p class="muted small" style="text-align:center">Every time someone in the CG shares how they loved someone, a heart drops in. Let’s fill it up! 💛</p>
      </div>
      <button class="btn block" id="cgShare">Add my heart</button>
      <button class="btn ghost block" id="cgFeed" style="margin-top:8px">Read the stories in Be Inspired</button>`);
    const t0 = performance.now(), dur = Math.min(3400, 400 + j.total * 90);
    const tick = now => { const k = Math.min(1, (now - t0) / dur); const n = $('#cgN'); if (!n) return; n.textContent = Math.round(j.total * k); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => { const b = $('#cgBar'); if (b) b.style.width = pct + '%'; }, 60);
    bindJar($('#sheet'));
    $('#cgShare').onclick = () => { closeSheet(); openLog(); };
    $('#cgFeed').onclick = () => { closeSheet(); state.groupSeg = 'feed'; go('group'); };
  }

  // Someone else's jar (from Ranks): their jar, "has loved…" and their memory lane.
  async function openJar(userId, filter = null) {
    const j = await api(`/users/${userId}/jar`);
    if (j.mine) { closeSheet(); return go('me'); }
    openSheet(`
      <div class="sheet-head"><h2>${esc(j.user.name)}’s heart jar</h2><button class="x" data-close>✕</button></div>
      <div class="story-hero"><div class="jar-big">${jarStage(jarSVG(j.hearts, 220, { animate: true, style: j.user.jar }), j.user.jar)}</div>
        <div class="loved-wrap"></div></div>
      <div class="tl"><p class="muted small">Loading…</p></div>`);
    bindJar($('#sheet'));
    mountStory($('#sheet'), userId, j, `${j.user.name} has`, filter);
  }

  // ---------------- jar shop ----------------
  const SAMPLE_HEARTS = ['stranger', 'friend', 'family', 'cg', 'friend', 'stranger', 'cg', 'family', 'friend'].map(r => ({ id: 0, r, name: '' }));
  const AREAS = [
    { key: 'jar', title: '1 · Jar shape & skin', hint: 'Pick the jar your hearts go into.' },
    { key: 'tag', title: '2 · Tag on the bottle neck', hint: 'A little charm that hangs from your jar.' },
    { key: 'bg', title: '3 · Background', hint: 'Colours are free. Patterns cost star points.' },
  ];
  async function renderShop(body) {
    const [shop, mine] = await Promise.all([api('/shop'), api('/users/' + state.me.user.id + '/jar')]);
    if (state.tab !== 'group' || state.groupSeg !== 'shop') return;
    const st = shop.style, editing = state.me.isAdmin && state.editPrices;
    const preview = (change, size = 74) => { const s = { ...st, ...change }; return jarStage(jarSVG(SAMPLE_HEARTS, size, { names: false, style: s }), s, 'shop-stage'); };
    const itemCard = i => {
      const using = st[i.area] === i.id;
      const label = using ? '✓ Using' : i.owned ? 'Use' : `🔒 ⭐ ${i.price}`;
      return `<button class="shop-item ${using ? 'using' : ''} ${!i.owned ? 'locked' : ''}" data-item="${i.id}">
        ${preview({ [i.area]: i.id, ...(i.area === 'bg' && i.id === 'bg-plain' ? {} : {}) })}
        <b>${esc(i.name)}</b>
        ${editing && i.price >= 0 && !['jar-mason', 'tag-none', 'bg-plain'].includes(i.id) ? `<span class="price-edit">Price <input type="number" min="0" inputmode="numeric" data-price="${i.id}" value="${i.price}"></span>` : `<span class="shop-btn">${label}</span>`}
      </button>`;
    };
    body.innerHTML = `
      <div class="card shop-head">
        ${jarStage(jarSVG(mine.hearts, 120, { names: false, style: st }), st, 'shop-mine')}
        <div><span class="muted small" style="font-weight:800">My star points</span>
          <b class="pts">⭐ ${shop.points.balance}</b>
          <p class="muted small" style="margin:4px 0 0">Every post earns star points:<br>${heart('stranger', 14)} new people +${shop.earnRates.stranger} · ${heart('friend', 14)} friend +${shop.earnRates.friend}<br>${heart('family', 14)} family +${shop.earnRates.family} · ${heart('cg', 14)} CG +${shop.earnRates.cg}</p></div>
      </div>
      ${state.me.isAdmin ? `<div class="admin-price-bar">${editing ? `<button class="btn small" id="savePrices">Save prices</button><button class="link" id="cancelPrices">Cancel</button>` : `<button class="link" id="editPrices">✏️ Admin: edit prices</button>`}</div>` : ''}
      ${AREAS.map(a => `<div class="shop-area"><h3>${a.title}</h3><p class="muted small">${a.hint}</p>
        ${a.key === 'bg' ? `<div class="swatches shop-colours">${shop.colours.map(c => `<button data-color="${c}" class="${st.color === c ? 'on' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>` : ''}
        <div class="shop-grid">${shop.items.filter(i => i.area === a.key).map(itemCard).join('')}</div></div>`).join('')}
      <p class="muted small" style="text-align:center;margin:14px 0 4px">Everyone can see your jar on Ranks 💛</p>`;
    const after = async p => { try { await p; haptic('medium'); renderShop(body); refreshMe(); } catch (e) { toast(e.message); } };
    body.querySelectorAll('[data-color]').forEach(b => b.onclick = () => after(api('/shop/equip', { method: 'POST', body: { color: b.dataset.color } })));
    body.querySelectorAll('[data-item]').forEach(b => b.onclick = e => {
      if (editing) return;
      const i = shop.items.find(x => x.id === b.dataset.item);
      if (st[i.area] === i.id) return;
      if (i.owned) return after(api('/shop/equip', { method: 'POST', body: { [i.area]: i.id } }));
      if (shop.points.balance < i.price) return toast(`You need ${i.price - shop.points.balance} more star points. Keep loving! 💛`);
      confirmThen(`Buy ${i.name} for ${i.price} star points?`, () => after(api('/shop/buy', { method: 'POST', body: { item: i.id } }).then(() => toast(`${i.name} is yours! 🎉`))));
    });
    if ($('#editPrices')) $('#editPrices').onclick = () => { state.editPrices = true; renderShop(body); };
    if ($('#cancelPrices')) $('#cancelPrices').onclick = () => { state.editPrices = false; renderShop(body); };
    if ($('#savePrices')) $('#savePrices').onclick = async () => {
      const map = {}; body.querySelectorAll('[data-price]').forEach(inp => map[inp.dataset.price] = inp.value);
      try { await api('/shop/prices', { method: 'PUT', body: map }); state.editPrices = false; toast('Prices saved'); renderShop(body); } catch (e) { toast(e.message); }
    };
  }

  function boardRow(r, i) {
    const medal = ['🥇', '🥈', '🥉'][i];
    const me = r.id === state.me.user.id;
    return `<button class="row tap ${me ? 'me-row' : ''}" data-user="${r.id}"><div class="rank">${medal || i + 1}</div><div class="mini-av">${face(r.avatar)}</div>
      <div class="grow"><b>${esc(r.name)}${me ? ' (you)' : ''}</b>${handleTag(r)}</div><span class="pill heart-pill">${r.stars} ♥</span><div class="mini-jar">${jarStage(jarSVG(r.hearts || [], 46, { names: false, style: r.jar }), r.jar, 'tiny')}</div></button>`;
  }

  // ---------------- me: stats, avatar, settings, admin ----------------
  async function renderMe() {
    await refreshMe();
    const { me } = state, s = me.stats, g = me.group;
    view.innerHTML = `
      <div class="hello"><button class="av" id="editAv">${face(me.user.avatar)}</button>
        <div class="grow"><h1>${esc(me.user.name)}</h1>${me.user.handle ? `<p class="muted small">@${esc(me.user.handle)}</p>` : ''}<button class="link" id="editAv2">✏️ Edit character & username</button></div></div>
      <div class="card story-hero" id="meStory">
        <div class="jar-big">${jarStage(jarSVG([], 220, { names: false, style: me.user.jar }), me.user.jar)}</div>
        <div class="loved-wrap"></div>
      </div>
      <div class="section-title"><h3>Memory lane</h3></div>
      <div class="tl" id="meTl"><p class="muted small">Loading…</p></div>
      <div class="card"><label class="check" style="margin:0"><input type="checkbox" id="notify" ${me.user.notify ? 'checked' : ''}> Get announcements from the admin</label></div>
      ${me.isAdmin ? `<div class="card admin"><h3>📣 Admin: send a notification</h3>
        <p class="muted small" style="margin:6px 0 10px">It shows in everyone’s 🔔, and can also go out as a Telegram message from the bot.</p>
        <button class="btn block" id="sendB">Write a notification</button></div>` : ''}
      <p class="muted small" style="text-align:center;margin-top:18px">${esc(me.appName)} · made with 💛</p>`;
    $('#editAv').onclick = $('#editAv2').onclick = () => openAvatarEditor();
    api('/users/' + me.user.id + '/jar').then(j => {
      if (state.tab !== 'me') return;
      $('#meStory .jar-big').innerHTML = jarStage(jarSVG(j.hearts, 220, { animate: true, style: me.user.jar }), me.user.jar) +
        `<button class="link small" id="toShop" style="margin-top:8px">✨ Decorate my jar in the Shop</button>`;
      $('#toShop').onclick = () => { state.groupSeg = 'shop'; go('group'); };
      bindJar($('#meStory'));
      mountStory(view, me.user.id, j, 'I have', state.meFilter || null);
      state.meFilter = null;
    }).catch(() => {});
    $('#notify').onchange = async e => { await api('/profile', { method: 'POST', body: { notify: e.target.checked } }); toast(e.target.checked ? 'Announcements on 🔔' : 'Announcements off 🔕'); };
    if (me.isAdmin) $('#sendB').onclick = () => openBell(true);
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

  // ---------------- guided tour: spotlights each real button and says what it does ----------------
  // tab/seg: where to go first. sel: what to point at (null = a card in the middle).
  const TOUR = [
    { sel: null, icon: '💛', title: 'Welcome to Love Better!', text: 'We love because He first loved us. Let me show you around. I’ll point at each button and tell you what it does. It takes about a minute.' },
    { tab: 'home', sel: '#myJar', title: 'Your heart jar', text: `Every time you share how you loved someone, a heart drops into your jar. Its colour shows who you loved: ${heart('stranger', 14)} someone new, ${heart('friend', 14)} a friend, ${heart('family', 14)} family, ${heart('cg', 14)} someone in the CG. You can also see your streak 🔥 and your ⭐ star points here.` },
    { tab: 'home', sel: '#quickLog', title: 'Share how you loved someone', text: 'Tap here after you’ve loved someone, from Home. Write what happened, add photos if you like, and pick who you loved.' },
    { tab: 'home', sel: '#cgJarBtn', title: 'AW2 love others jar', text: () => `Our CG goal is to love ${(state.me.group && state.me.group.goal) || 50} people together, and every post counts as one. Tap here to watch our jar fill up and read what everyone shared.` },
    { tab: 'missions', sel: '.tabs [data-tab=missions]', title: 'Missions', text: 'Need an idea? Tap Missions.' },
    { tab: 'missions', sel: '#missionList .cat-head', title: 'Pick a mission', text: 'Missions come in 3 categories because to love is to <b>hear</b>, <b>see</b> and <b>delight</b>. You can pick a mission to love others!' },
    { tab: 'missions', sel: '#newTask', title: 'Add your own missions', text: 'Type your own missions here and tap <b>Add</b>.' },
    { tab: 'group', seg: 'feed', sel: '.tabs [data-tab=group]', title: 'Be Inspired', text: 'See what everyone in the CG has been doing.' },
    { tab: 'group', seg: 'feed', sel: '.post .reacts', title: 'React to a post', text: 'Tap 💛 🔥 🤯 🙌 🥹 or 🙏 to cheer someone on. Tap it again to take it back.' },
    { tab: 'group', seg: 'feed', sel: '.post .note-form', title: 'Write a note of encouragement', text: 'Type a short note and tap <b>Send</b>.' },
    { tab: 'group', seg: 'feed', sel: '[data-seg=board]', title: 'Ranks', text: 'See everyone’s jars. Tap a person to look inside their jar and read their stories.' },
    { tab: 'group', seg: 'feed', sel: '[data-seg=shop]', title: 'Shop', text: 'Spend your ⭐ star points on a new jar, a charm for the bottle neck or a background. Everyone can see your jar!' },
    { tab: 'me', sel: '#meStory .jar-big', title: 'Me', text: 'Your own jar. Below it, <b>What each heart means</b> and <b>Memory lane</b> keep every post, photo, date and time. Tap a heart colour to see only those memories.' },
    { tab: 'me', sel: '#editAv2', title: 'Your character', text: 'Change your character and username here.' },
    { tab: 'home', sel: '#bellBtn', title: 'Notifications', text: 'Tap the 🔔 to see messages from the admin and every new post from the CG. A red number means there’s something new.' },
    { tab: 'home', sel: '#helpBtn', title: 'Need help?', text: 'Tap <b>?</b> anytime to read the help or replay this tour. Tip: you can also just type what you did to the bot in Telegram and it adds a heart for you.', last: true },
  ];
  let tourN = 0;
  async function startTour(step = 0) {
    const run = ++tourN; // a newer step cancels an older one still loading
    const t = TOUR[step];
    let o = $('#tour');
    if (!o) {
      o = document.createElement('div'); o.className = 'tour'; o.id = 'tour';
      o.innerHTML = '<div class="tour-spot" id="tSpot"></div><div class="tour-card" id="tCard" role="dialog" aria-modal="true"></div>';
      document.body.appendChild(o); document.body.classList.add('touring');
    }
    if (t.tab && (state.tab !== t.tab || (t.seg && state.groupSeg !== t.seg))) {
      if (t.seg) state.groupSeg = t.seg;
      go(t.tab);
    }
    let el = null;
    if (t.sel) for (let i = 0; i < 30 && !(el = document.querySelector(t.sel)); i++) await new Promise(r => setTimeout(r, 100));
    if (run !== tourN) return;
    if (el && !el.closest('.tabs') && el.id !== 'helpBtn' && el.id !== 'bellBtn') { el.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 250)); }
    if (run !== tourN) return;
    const spot = $('#tSpot'), card = $('#tCard');
    card.innerHTML = `<button class="tour-skip" id="tSkip">Skip</button>
      ${el ? '' : `<div class="tour-icon">${t.icon || '💛'}</div>`}
      <p class="tour-step">${step + 1} of ${TOUR.length}</p><h2>${t.title}</h2><p>${typeof t.text === 'function' ? t.text() : t.text}</p>
      <div class="tour-btns">${step ? '<button class="btn ghost" id="tBack">Back</button>' : ''}
        <button class="btn" id="tNext">${t.last ? 'Let’s go! 💛' : 'Next'}</button></div>`;
    card.classList.remove('above', 'below', 'mid');
    if (el) {
      const r = el.getBoundingClientRect(), pad = 6, H = innerHeight;
      const top = Math.max(6, r.top - pad), bottom = Math.min(H - 6, r.bottom + pad);
      Object.assign(spot.style, { display: 'block', left: (r.left - pad) + 'px', top: top + 'px', width: (r.width + pad * 2) + 'px', height: (bottom - top) + 'px' });
      const ptX = Math.min(Math.max(r.left + r.width / 2, 36), innerWidth - 36);
      card.style.setProperty('--ax', (ptX - 16) + 'px');
      if ((top + bottom) / 2 < H / 2) { card.classList.add('below'); card.style.top = (bottom + 14) + 'px'; card.style.bottom = ''; }
      else { card.classList.add('above'); card.style.bottom = (H - top + 14) + 'px'; card.style.top = ''; }
    } else {
      Object.assign(spot.style, { display: 'block', left: '50%', top: '50%', width: '0px', height: '0px' });
      card.classList.add('mid'); card.style.top = ''; card.style.bottom = '';
    }
    haptic();
    $('#tNext').onclick = () => t.last ? endTour() : startTour(step + 1);
    if ($('#tBack')) $('#tBack').onclick = () => startTour(step - 1);
    $('#tSkip').onclick = endTour;
  }
  function endTour() {
    tourN++;
    const o = $('#tour'); if (o) o.remove();
    document.body.classList.remove('touring');
    if (state.tab !== 'home') go('home');
  }

  function openHelp() {
    const sec = (icon, title, body) => `<details class="help"><summary><span>${icon}</span>${title}</summary><div>${body}</div></details>`;
    openSheet(`
      <div class="sheet-head"><h2>How to use Love Better</h2><button class="x" data-close>✕</button></div>
      <button class="btn block" id="replay" style="margin:10px 0 14px">▶️ Show me around again (guided tour)</button>
      ${sec('＋', 'Share how you loved someone', `Tap the gold <b>Share how you loved someone today</b> button on Home. Tell us what you did, add photos if you like (optional, up to 4), choose who you loved, and tap <b>Add a heart to my jar</b>.<br><br>${heart('stranger', 16)} Someone new<br>${heart('friend', 16)} A friend<br>${heart('family', 16)} A family member<br>${heart('cg', 16)} Someone in the CG<br><br>Want to keep the details private? Untick <b>“Share the details with the group”</b>. You still get the heart, and others just see that you loved someone.`)}
      ${sec('🫙', 'My heart jar', `Every act of love adds one heart to your jar, in the colour of who you loved. Tap your jar on <b>Home</b> to watch the <b>AW2 love others jar</b> fill up. Tap any heart to read what was shared. Go to <b>Me</b> to walk down <b>Memory lane</b>, with photos, dates and times. Tap a colour in “I have loved…” to see only those.`)}
      ${sec('🎯', 'Missions and your own missions', `Go to <b>Missions</b>. They come in 3 kinds: <b>to love is to hear</b>, <b>to love is to see</b> and <b>to love is to delight</b>. Pick one, do it, then tap <b>I did it!</b><br><br>To set your own mission, type it under <b>Your own missions</b> and tap <b>Add</b>. When you’ve done it, tap <b>Done!</b>`)}
      ${sec('⭐', 'Cheer others on', `In <b>Be Inspired → Feed</b>, react to someone’s post (💛 🔥 🤯 🙌 🥹 🙏) or write them a note of encouragement. They get a message when you do. In <b>Ranks</b>, tap anyone to look inside their heart jar.`)}
      ${sec('🔔', 'Notifications', `Tap the <b>🔔</b> at the top to see messages from the admin and every new post from the CG. Tap a post to read it. A red number shows how many are new.`)}
      ${sec('🔥', 'What is a streak?', `The number of days in a row you’ve shared at least one act of love. Share something every day to keep it going!`)}
      ${sec('😊', 'Change my character or username', `Go to <b>Me</b> and tap <b>Edit character & username</b>. <b>🎲 Surprise me</b> mixes up your clothes, accessories, pose and expression.`)}
      ${sec('🤖', 'Using the bot in the chat', `You can share without opening the app. Just type what you did to the bot, then choose who you loved. To add a photo, send the photo with a caption saying what you did.<br><br><b>/hearts</b>: my heart jar<br><b>/leaderboard</b>: everyone’s hearts<br><b>/countdown</b>: days to XMAS service and New Year<br><b>/verse</b>: verse of the day<br><b>/mute</b> or <b>/unmute</b>: turn announcements off or on`)}
      ${sec('🗑️', 'I made a mistake', `You can delete your own posts and missions with the <b>Delete</b> button on them. The heart is taken out of your jar too.`)}
      <p class="muted small" style="text-align:center;margin-top:16px">Still stuck? Message Richelle 💛</p>`);
    $('#replay').onclick = () => { closeSheet(); go('home'); startTour(); };
  }
  $('#helpBtn').onclick = () => { haptic(); openHelp(); };

  // ---------------- 🔔 notifications: admin announcements + new posts ----------------
  async function openBell(compose = false) {
    let r; try { r = await api('/notifications'); } catch (e) { return toast(e.message); }
    const list = r.items, lastSeen = r.seenAt; // anything newer than the last visit gets a marker
    setBadge(0);
    const isAdmin = state.me.isAdmin;
    const item = n => n.kind === 'admin'
      ? `<div class="notif admin ${n.createdAt > lastSeen && lastSeen ? 'new' : ''}"><div class="notif-ic">📣</div><div class="grow">
          <div class="notif-title">${esc(n.title)}</div><div class="notif-body">${esc(n.body)}</div>
          <div class="notif-meta"><span>${n.from ? 'From ' + esc(n.from.name) + ' · ' : ''}${ago(n.createdAt)}</span>${isAdmin ? `<button class="del small" data-delnote="${n.id}">Delete</button>` : ''}</div></div></div>`
      : `<button class="notif ${n.createdAt > lastSeen && lastSeen && !n.mine ? 'new' : ''}" data-act="${n.id}"><div class="notif-ic">${face(n.from.avatar)}</div><div class="grow">
          <div class="notif-title">${esc(n.title)} ${heart(n.recipient, 15)}</div>${n.body ? `<div class="notif-body clip">${esc(n.body)}</div>` : ''}
          <div class="notif-meta"><span>${ago(n.createdAt)}</span></div></div></button>`;
    openSheet(`<div class="sheet-head"><h2>🔔 Notifications</h2><button class="x" data-close>✕</button></div>
      ${isAdmin ? `<button class="btn ghost block" id="nNew" style="margin:6px 0 12px" ${compose ? 'hidden' : ''}>📣 Admin: send a notification</button>
        <div class="notif-form" id="nForm" ${compose ? '' : 'hidden'}>
          <label class="lbl" for="nTitle" style="margin-top:0">Header</label><input type="text" id="nTitle" placeholder="e.g. XMAS service this Thursday! 🎄">
          <label class="lbl" for="nBody">Text</label><textarea id="nBody" placeholder="Write as much as you like…"></textarea>
          <label class="check" style="margin-top:10px"><input type="checkbox" id="nTg" checked> Also send it to everyone on Telegram</label>
          <button class="btn block" id="nSend" style="margin-top:10px">Send notification</button></div>` : ''}
      <div id="nList">${list.length ? list.map(item).join('') : '<p class="muted small" style="text-align:center;margin:20px 0">No notifications yet.</p>'}</div>`);
    $('#sheet').querySelectorAll('[data-act]').forEach(b => b.onclick = () => openHeart(Number(b.dataset.act)));
    $('#sheet').querySelectorAll('[data-delnote]').forEach(b => b.onclick = () => confirmThen('Delete this notification for everyone?', async () => {
      await api('/notifications/' + b.dataset.delnote, { method: 'DELETE' }); b.closest('.notif').remove(); toast('Deleted');
    }));
    if (isAdmin) {
      $('#nNew').onclick = () => { $('#nNew').hidden = true; $('#nForm').hidden = false; $('#nTitle').focus(); };
      $('#nSend').onclick = () => {
        const title = $('#nTitle').value.trim(), body = $('#nBody').value.trim(), telegram = $('#nTg').checked;
        if (!title) return toast('Add a header first'); if (!body) return toast('Write the text first');
        confirmThen(telegram ? 'Send this to everyone, in the app and on Telegram?' : 'Post this in everyone’s 🔔?', async () => {
          $('#nSend').disabled = true; $('#nSend').textContent = 'Sending…';
          try {
            const r = await api('/notifications', { method: 'POST', body: { title, body, telegram } });
            const t = r.telegram;
            toast(t && !t.skipped && !t.error ? `🔔 Sent. Telegram: ${t.sent} people${t.failed ? `, ${t.failed} failed` : ''}` : '🔔 Notification sent', 3500);
            openBell();
          } catch (e) { toast(e.message); $('#nSend').disabled = false; $('#nSend').textContent = 'Send notification'; }
        });
      };
    }
  }
  $('#bellBtn').onclick = () => { haptic(); openBell(); };

  boot();
})();
