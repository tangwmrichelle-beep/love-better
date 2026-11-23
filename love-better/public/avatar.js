// Love Better avatar maker: draws a layered SVG character from a small set of choices.
(function () {
  const OPTIONS = {
    base: [['boy', 'Boy'], ['girl', 'Girl']],
    skin: [['#FFE0C7', 'Fair'], ['#F6CBA5', 'Light'], ['#E8B48A', 'Tan'], ['#C98E5F', 'Caramel'], ['#9C6640', 'Brown'], ['#6B4228', 'Deep']],
    hair: [['short', 'Short'], ['spiky', 'Spiky'], ['sidepart', 'Side part'], ['buzz', 'Buzz'], ['curly', 'Curly'],
      ['long', 'Long'], ['ponytail', 'Ponytail'], ['bob', 'Bob'], ['buns', 'Buns'], ['braids', 'Braids'], ['bald', 'None']],
    hairColor: [['#2B1B14', 'Black'], ['#5A3825', 'Brown'], ['#A0642D', 'Chestnut'], ['#E3B55B', 'Blonde'], ['#C2452D', 'Red'], ['#B9A6E8', 'Lilac'], ['#F28DB2', 'Pink'], ['#9AA0A6', 'Grey']],
    eyes: [['round', 'Round'], ['happy', 'Happy'], ['wink', 'Wink'], ['sparkle', 'Sparkle'], ['sleepy', 'Sleepy'], ['hearts', 'Heart eyes']],
    mouth: [['smile', 'Smile'], ['grin', 'Grin'], ['laugh', 'Laugh'], ['small', 'Soft'], ['tongue', 'Cheeky'], ['o', 'Wow']],
    outfit: [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['sweater', 'XMAS sweater'], ['shirt', 'Collar shirt'], ['dress', 'Dress'], ['overalls', 'Overalls']],
    outfitColor: [['#F06292', 'Pink'], ['#E53935', 'Red'], ['#FFB74D', 'Orange'], ['#FDD835', 'Yellow'], ['#66BB6A', 'Green'], ['#4FC3F7', 'Sky'], ['#5C6BC0', 'Indigo'], ['#FFFFFF', 'White'], ['#37474F', 'Charcoal']],
    accessory: [['none', 'None'], ['glasses', 'Glasses'], ['sunglasses', 'Shades'], ['santa', 'Santa hat'], ['antlers', 'Antlers'], ['halo', 'Halo'],
      ['bow', 'Bow'], ['flower', 'Flower'], ['cap', 'Cap'], ['scarf', 'Scarf'], ['headphones', 'Headphones']],
    pose: [['stand', 'Standing'], ['wave', 'Waving'], ['heart', 'Heart hands'], ['cheer', 'Cheering'], ['hug', 'Open arms']],
    background: [['blush', 'Blush'], ['sky', 'Sky'], ['mint', 'Mint'], ['sunset', 'Sunset'], ['hearts', 'Hearts'], ['snow', 'Snowy night'], ['stars', 'Starry'], ['gold', 'Gold']],
  };

  const DEFAULTS = {
    boy: { base: 'boy', skin: '#F6CBA5', hair: 'short', hairColor: '#2B1B14', eyes: 'round', mouth: 'smile', outfit: 'hoodie', outfitColor: '#4FC3F7', accessory: 'none', pose: 'wave', background: 'sky' },
    girl: { base: 'girl', skin: '#F6CBA5', hair: 'long', hairColor: '#5A3825', eyes: 'sparkle', mouth: 'smile', outfit: 'dress', outfitColor: '#F06292', accessory: 'bow', pose: 'heart', background: 'blush' },
  };

  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const heartPath = (x, y, s) => `M${x} ${y + s * 0.35} C${x - s} ${y - s * 0.4} ${x - s * 0.45} ${y - s} ${x} ${y - s * 0.45} C${x + s * 0.45} ${y - s} ${x + s} ${y - s * 0.4} ${x} ${y + s * 0.35} Z`;

  let uid = 0;
  function render(input, opts = {}) {
    const a = Object.assign({}, DEFAULTS[(input && input.base) || 'boy'], input || {});
    const id = 'av' + (++uid);
    const girl = a.base === 'girl';
    const skin = a.skin, skinD = shade(skin, -0.12), hc = a.hairColor, hcD = shade(hc, -0.12);
    const oc = a.outfitColor, ocD = shade(oc, oc === '#FFFFFF' ? -0.12 : -0.15);
    const ink = '#3A2A2A';
    const p = [];

    // ---------- background ----------
    const bg = {
      blush: `<rect width="200" height="240" fill="#FFE4EC"/><circle cx="160" cy="40" r="50" fill="#FFD1DF"/>`,
      sky: `<rect width="200" height="240" fill="#D7EEFF"/><ellipse cx="40" cy="45" rx="26" ry="10" fill="#fff" opacity=".9"/><ellipse cx="165" cy="70" rx="20" ry="8" fill="#fff" opacity=".9"/>`,
      mint: `<rect width="200" height="240" fill="#DDF5EA"/><circle cx="30" cy="200" r="60" fill="#C8EEDC"/>`,
      sunset: `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB88C"/><stop offset="1" stop-color="#DE6262"/></linearGradient></defs><rect width="200" height="240" fill="url(#${id}g)"/><circle cx="100" cy="150" r="60" fill="#FFD27F" opacity=".6"/>`,
      hearts: `<rect width="200" height="240" fill="#FFF0F5"/>` + [[25, 30], [170, 25], [30, 150], [175, 140], [95, 18], [150, 200], [20, 220]].map(([x, y], i) => `<path d="${heartPath(x, y, 10 + (i % 3) * 3)}" fill="#FF8FB1" opacity=".55"/>`).join(''),
      snow: `<rect width="200" height="240" fill="#22305A"/>` + [[20, 20], [60, 40], [150, 18], [180, 60], [30, 90], [170, 120], [110, 30], [15, 160], [185, 180], [80, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff"/>`).join('') + `<path d="M0 215 Q50 200 100 212 T200 208 V240 H0Z" fill="#fff"/>`,
      stars: `<rect width="200" height="240" fill="#2A1B4A"/>` + [[25, 25], [70, 50], [150, 22], [178, 75], [30, 110], [172, 140], [120, 40]].map(([x, y]) => `<path d="M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2}Z" fill="#FFE27A"/>`).join(''),
      gold: `<defs><radialGradient id="${id}r" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#FFF6D5"/><stop offset="1" stop-color="#F7C95C"/></radialGradient></defs><rect width="200" height="240" fill="url(#${id}r)"/>`,
    };
    if (!opts.noBg) p.push(bg[a.background] || bg.blush);

    // ---------- hair (back layer) ----------
    const backHair = {
      long: `<path d="M50 92 Q42 38 100 38 Q158 38 150 92 L158 178 Q130 188 100 184 Q70 188 42 178 Z" fill="${hc}"/>`,
      bob: `<path d="M48 96 Q40 38 100 38 Q160 38 152 96 L154 134 Q100 142 46 134 Z" fill="${hc}"/>`,
      ponytail: `<path d="M140 70 Q178 80 168 140 Q162 170 150 176 Q156 140 146 104 Z" fill="${hc}"/>`,
      braids: [0, 1, 2, 3, 4].map(i => `<circle cx="54" cy="${118 + i * 14}" r="9" fill="${i % 2 ? hcD : hc}"/><circle cx="146" cy="${118 + i * 14}" r="9" fill="${i % 2 ? hcD : hc}"/>`).join(''),
      buns: `<circle cx="62" cy="50" r="19" fill="${hc}"/><circle cx="138" cy="50" r="19" fill="${hc}"/>`,
    };
    if (backHair[a.hair]) p.push(backHair[a.hair]);

    // ---------- body / outfit ----------
    const torso = girl
      ? 'M56 240 L58 188 Q60 156 86 150 L114 150 Q140 156 142 188 L144 240 Z'
      : 'M48 240 L50 186 Q52 154 82 148 L118 148 Q148 154 150 186 L152 240 Z';
    p.push(`<rect x="88" y="128" width="24" height="26" rx="8" fill="${skinD}"/>`);
    if (a.outfit === 'dress') {
      p.push(`<path d="M60 190 Q62 156 86 150 L114 150 Q138 156 140 190 L160 240 L40 240 Z" fill="${oc}"/>`);
      p.push(`<rect x="62" y="186" width="76" height="8" rx="4" fill="${ocD}"/><path d="M86 150 Q100 166 114 150" fill="${skin}"/>`);
    } else if (a.outfit === 'overalls') {
      p.push(`<path d="${torso}" fill="${oc}"/><path d="M86 150 Q100 162 114 150" fill="${skin}"/>`);
      p.push(`<path d="M70 240 L72 182 L128 182 L130 240 Z" fill="#4A6FA5"/><rect x="74" y="150" width="8" height="36" fill="#4A6FA5"/><rect x="118" y="150" width="8" height="36" fill="#4A6FA5"/><circle cx="78" cy="186" r="3" fill="#FDD835"/><circle cx="122" cy="186" r="3" fill="#FDD835"/><rect x="88" y="196" width="24" height="16" rx="3" fill="#3D5E8F"/>`);
    } else {
      p.push(`<path d="${torso}" fill="${oc}"/>`);
      if (a.outfit === 'tee') p.push(`<path d="M84 150 Q100 166 116 150" fill="${skin}"/>`);
      if (a.outfit === 'hoodie') p.push(`<path d="M76 150 Q100 176 124 150 Q100 160 76 150Z" fill="${ocD}"/><path d="M86 158 L84 182 M114 158 L116 182" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M74 210 H126 L120 232 H80Z" fill="${ocD}"/>`);
      if (a.outfit === 'sweater') p.push(`<path d="M86 150 Q100 160 114 150" fill="${ocD}"/><path d="M${girl ? 58 : 50} 196 ${Array.from({ length: 13 }, (_, i) => `L${(girl ? 58 : 50) + (i + 1) * (girl ? 6.6 : 7.7)} ${i % 2 ? 196 : 206}`).join(' ')}" stroke="#fff" stroke-width="3" fill="none"/>` + [[80, 176], [100, 172], [120, 176], [90, 224], [112, 224]].map(([x, y]) => `<path d="M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4} M${x - 3} ${y - 3} L${x + 3} ${y + 3} M${x + 3} ${y - 3} L${x - 3} ${y + 3}" stroke="#fff" stroke-width="1.6"/>`).join(''));
      if (a.outfit === 'shirt') p.push(`<path d="M86 150 L100 164 L114 150" fill="${skin}"/><path d="M84 148 L100 166 L92 172 L80 154Z M116 148 L100 166 L108 172 L120 154Z" fill="#fff"/><path d="M100 166 V240" stroke="${ocD}" stroke-width="2"/>` + [182, 200, 218].map(y => `<circle cx="104" cy="${y}" r="2" fill="${ocD}"/>`).join(''));
    }

    // ---------- arms (pose) ----------
    const sx = girl ? 62 : 56, rx = 200 - sx, sy = 166;
    const poses = {
      stand: [[`M${sx} ${sy} Q${sx - 10} 195 ${sx - 8} 224`], [`M${rx} ${sy} Q${rx + 10} 195 ${rx + 8} 224`], [sx - 8, 226], [rx + 8, 226]],
      wave: [[`M${sx} ${sy} Q${sx - 10} 195 ${sx - 8} 224`], [`M${rx} ${sy} Q${rx + 26} 150 ${rx + 26} 108`], [sx - 8, 226], [rx + 26, 102]],
      heart: [[`M${sx} ${sy} Q${sx - 4} 206 92 198`], [`M${rx} ${sy} Q${rx + 4} 206 108 198`], [92, 196], [108, 196]],
      cheer: [[`M${sx} ${sy} Q${sx - 26} 140 ${sx - 24} 102`], [`M${rx} ${sy} Q${rx + 26} 140 ${rx + 24} 102`], [sx - 24, 98], [rx + 24, 98]],
      hug: [[`M${sx} ${sy} Q${sx - 30} 176 ${sx - 44} 156`], [`M${rx} ${sy} Q${rx + 30} 176 ${rx + 44} 156`], [sx - 46, 152], [rx + 46, 152]],
    };
    const ps = poses[a.pose] || poses.stand;
    const sleeve = a.outfit === 'overalls' ? oc : (a.outfit === 'dress' ? skin : oc);
    [ps[0][0], ps[1][0]].forEach(d => {
      p.push(`<path d="${d}" stroke="${shade(sleeve, -0.06)}" stroke-width="17" fill="none" stroke-linecap="round"/>`);
    });
    p.push(`<circle cx="${ps[2][0]}" cy="${ps[2][1]}" r="9" fill="${skin}"/><circle cx="${ps[3][0]}" cy="${ps[3][1]}" r="9" fill="${skin}"/>`);
    if (a.pose === 'heart') p.push(`<path d="${heartPath(100, 186, 14)}" fill="#FF4D7D" stroke="#fff" stroke-width="2"/>`);
    if (a.pose === 'cheer') p.push(`<path d="M${sx - 34} 82 l-6 -8 M${sx - 24} 78 v-10 M${sx - 14} 82 l6 -8 M${rx + 14} 82 l-6 -8 M${rx + 24} 78 v-10 M${rx + 34} 82 l6 -8" stroke="#FFC23C" stroke-width="3" stroke-linecap="round"/>`);

    // ---------- scarf ----------
    if (a.accessory === 'scarf') p.push(`<rect x="76" y="136" width="48" height="16" rx="8" fill="#E53935"/><path d="M108 146 L116 182 L104 184 L100 148Z" fill="#C62828"/><path d="M80 142 H120" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>`);

    // ---------- head ----------
    p.push(`<circle cx="52" cy="98" r="10" fill="${skinD}"/><circle cx="148" cy="98" r="10" fill="${skinD}"/>`);
    p.push(`<ellipse cx="100" cy="92" rx="48" ry="47" fill="${skin}"/>`);
    p.push(`<ellipse cx="74" cy="112" rx="8" ry="5" fill="#FF8FA3" opacity=".45"/><ellipse cx="126" cy="112" rx="8" ry="5" fill="#FF8FA3" opacity=".45"/>`);

    // ---------- eyes ----------
    const eye = (x, kind) => {
      if (kind === 'round') return `<circle cx="${x}" cy="96" r="6" fill="${ink}"/><circle cx="${x + 2}" cy="94" r="2" fill="#fff"/>`;
      if (kind === 'sparkle') return `<ellipse cx="${x}" cy="96" rx="7" ry="8" fill="${ink}"/><circle cx="${x + 2.5}" cy="93" r="2.6" fill="#fff"/><circle cx="${x - 2.5}" cy="99.5" r="1.3" fill="#fff"/>`;
      if (kind === 'happy') return `<path d="M${x - 7} 98 Q${x} 89 ${x + 7} 98" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      if (kind === 'sleepy') return `<path d="M${x - 7} 95 Q${x} 101 ${x + 7} 95" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      if (kind === 'hearts') return `<path d="${heartPath(x, 96, 9)}" fill="#FF4D7D"/>`;
      return '';
    };
    const eyes = a.eyes === 'wink' ? eye(82, 'round') + eye(118, 'happy') : eye(82, a.eyes) + eye(118, a.eyes);
    p.push(eyes);
    if (girl && ['round', 'sparkle', 'wink'].includes(a.eyes)) {
      p.push(`<path d="M75 91 l-4 -3 M76 88 l-2 -4" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`);
      if (a.eyes !== 'wink') p.push(`<path d="M125 91 l4 -3 M124 88 l2 -4" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`);
    }
    p.push(`<path d="M74 82 Q82 78 90 82 M110 82 Q118 78 126 82" stroke="${shade(hc, -0.05)}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/>`);

    // ---------- mouth ----------
    const mouths = {
      smile: `<path d="M88 114 Q100 126 112 114" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
      grin: `<path d="M86 112 Q100 132 114 112 Z" fill="#8E2C3A"/><path d="M88 113 H112 L110 117 H90Z" fill="#fff"/>`,
      laugh: `<path d="M86 110 Q100 138 114 110 Z" fill="#8E2C3A"/><ellipse cx="100" cy="124" rx="7" ry="4" fill="#FF7A90"/>`,
      small: `<path d="M94 116 Q100 121 106 116" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      tongue: `<path d="M88 114 Q100 124 112 114" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M100 119 q2 10 8 6 q2 -2 0 -8" fill="#FF7A90"/>`,
      o: `<ellipse cx="100" cy="118" rx="6" ry="7" fill="#8E2C3A"/>`,
    };
    p.push(mouths[a.mouth] || mouths.smile);

    // ---------- hair (front layer) ----------
    const bangs = `<path d="M52 96 Q48 44 100 42 Q152 44 148 96 Q140 66 112 64 Q100 72 86 64 Q60 66 52 96 Z" fill="${hc}"/>`;
    const front = {
      short: `<path d="M52 92 Q48 42 100 40 Q152 42 148 92 Q142 66 120 62 Q100 74 80 62 Q58 68 52 92 Z" fill="${hc}"/>`,
      spiky: `<path d="M52 92 L54 58 L68 66 L72 40 L88 58 L100 32 L112 58 L128 40 L132 66 L146 58 L148 92 Q136 66 100 66 Q64 66 52 92 Z" fill="${hc}"/>`,
      sidepart: `<path d="M52 98 Q44 44 100 40 Q156 44 148 98 Q146 72 134 62 Q96 82 62 62 Q54 76 52 98 Z" fill="${hc}"/><path d="M70 50 Q96 44 120 58" stroke="${hcD}" stroke-width="2" fill="none"/>`,
      buzz: `<path d="M54 86 Q54 46 100 44 Q146 46 146 86 Q132 58 100 56 Q68 58 54 86 Z" fill="${hc}" opacity=".85"/>`,
      curly: [[58, 76], [62, 58], [76, 46], [94, 40], [112, 42], [128, 48], [140, 60], [144, 78], [86, 54], [104, 54], [120, 58], [70, 62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="${hc}"/>`).join(''),
      long: bangs,
      ponytail: bangs + `<rect x="140" y="68" width="10" height="9" rx="3" fill="#FF6FA0" transform="rotate(30 145 72)"/>`,
      bob: `<path d="M52 92 Q50 44 100 42 Q150 44 148 92 L146 76 Q100 62 54 76 Z" fill="${hc}"/>`,
      buns: bangs,
      braids: bangs + `<circle cx="54" cy="180" r="5" fill="#FF6FA0"/><circle cx="146" cy="180" r="5" fill="#FF6FA0"/>`,
      bald: '',
    };
    p.push(front[a.hair] || '');

    // ---------- accessories ----------
    const acc = {
      glasses: `<g stroke="${ink}" stroke-width="3" fill="rgba(255,255,255,.25)"><circle cx="82" cy="96" r="13"/><circle cx="118" cy="96" r="13"/></g><path d="M95 95 Q100 91 105 95" stroke="${ink}" stroke-width="3" fill="none"/>`,
      sunglasses: `<rect x="66" y="86" width="30" height="20" rx="8" fill="#1F1F2E"/><rect x="104" y="86" width="30" height="20" rx="8" fill="#1F1F2E"/><path d="M96 94 H104 M66 92 L52 88 M134 92 L148 88" stroke="#1F1F2E" stroke-width="3"/><path d="M72 90 l8 0" stroke="#fff" stroke-width="2" opacity=".6"/>`,
      santa: `<path d="M54 64 Q70 10 132 18 Q160 22 168 54 L150 50 Q136 34 122 40 Q140 52 146 64 Z" fill="#E53935"/><rect x="48" y="56" width="104" height="16" rx="8" fill="#fff"/><circle cx="168" cy="56" r="10" fill="#fff"/>`,
      antlers: `<g stroke="#8D5A3B" stroke-width="5" stroke-linecap="round" fill="none"><path d="M74 50 L60 18 M66 32 L52 26 M63 24 L68 12"/><path d="M126 50 L140 18 M134 32 L148 26 M137 24 L132 12"/></g><circle cx="100" cy="106" r="6" fill="#E53935"/>`,
      halo: `<ellipse cx="100" cy="28" rx="34" ry="8" fill="none" stroke="#FFC93C" stroke-width="5"/>`,
      bow: `<path d="M120 50 L104 38 L106 62Z M120 50 L136 38 L134 62Z" fill="#FF4D7D"/><circle cx="120" cy="50" r="5" fill="#E0336A"/>`,
      flower: [0, 72, 144, 216, 288].map(r => `<ellipse cx="134" cy="46" rx="6" ry="10" fill="#FFB3C8" transform="rotate(${r} 134 56)"/>`).join('') + `<circle cx="134" cy="56" r="5" fill="#FFD54F"/>`,
      cap: `<path d="M52 72 Q54 34 100 32 Q146 34 148 72 Z" fill="${oc === '#FFFFFF' ? '#E53935' : oc}"/><path d="M52 72 Q100 60 148 72" stroke="${ocD}" stroke-width="2" fill="none"/><path d="M118 68 Q160 62 176 74 Q150 80 118 74Z" fill="${shade(oc === '#FFFFFF' ? '#E53935' : oc, -0.15)}"/><circle cx="100" cy="34" r="4" fill="${ocD}"/>`,
      headphones: `<path d="M50 96 Q46 30 100 30 Q154 30 150 96" stroke="#37474F" stroke-width="7" fill="none"/><rect x="40" y="84" width="16" height="28" rx="7" fill="#F06292"/><rect x="144" y="84" width="16" height="28" rx="7" fill="#F06292"/>`,
    };
    if (acc[a.accessory]) p.push(acc[a.accessory]);

    const size = opts.size ? `width="${opts.size}" height="${opts.size * 1.2}"` : '';
    const vb = opts.face ? '30 10 140 140' : '0 0 200 240';
    if (opts.face) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''} role="img" aria-label="avatar">${p.join('')}</svg>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ${size} role="img" aria-label="avatar">${p.join('')}</svg>`;
  }

  window.Avatar = { OPTIONS, DEFAULTS, render };
})();
