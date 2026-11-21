(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ---------- headline: split into animated letters ---------- */
  const line = document.getElementById('line');
  const NAME = (line.dataset.name || '').trim();
  const phrase = line.textContent.trim();
  line.setAttribute('aria-label', NAME ? `${phrase} ${NAME}` : phrase);
  line.textContent = '';
  let n = 0;
  const addWord = (word, extra) => {
    const w = document.createElement('span');
    w.className = 'w' + extra;
    w.setAttribute('aria-hidden', 'true');
    const stretch = /^so{2,}$/i.test(word);   // "soooo": the o's get their own wave
    let k = 0;
    [...word].forEach((c, j) => {
      const s = document.createElement('span');
      const isO = stretch && j > 0;
      s.className = 'ch' + (isO ? ' o' : '');
      s.style.setProperty('--i', n++);
      if (isO) s.style.setProperty('--k', k++);
      s.textContent = c;
      w.appendChild(s);
    });
    line.appendChild(w);
  };
  phrase.split(' ').forEach((word) => addWord(word, ''));
  if (NAME) {                                   // the name sits on its own line, with a little beating heart
    const br = document.createElement('span');
    br.className = 'brk'; br.setAttribute('aria-hidden', 'true');
    line.appendChild(br);
    addWord(NAME, ' nm');
  }

  /* ---------- canvas setup ---------- */
  const cv = document.getElementById('scene');
  const ctx = cv.getContext('2d');
  const F = 5.2;                               // camera distance (world units)
  let W, H, DPR, cx, cy, U, dot, rs;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const tall = H > W * 1.1;
    U = tall ? Math.min(W * 0.33, H * 0.24) : Math.min(W * 0.17, H * 0.215);   // heart half-width, px
    cx = W / 2; cy = H * (tall ? 0.46 : 0.42);
    dot = clamp(U / 115, 0.8, 1.7);
    rs = Math.min(1, (W * 0.41) / (U * 1.62));   // keep the text ring inside the screen
  };

  /* ---------- 3D heart: inflated, made of gold particles ---------- */
  const outline = (t) => [
    Math.sin(t) ** 3,
    (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16 + 0.19
  ];
  // sample the outline evenly by area (inside) or by arc length (edge) so no streak forms down the middle
  const M = 720, OX = [], OY = [];
  for (let i = 0; i <= M; i++) { const [x, y] = outline((i / M) * TAU); OX.push(x); OY.push(y); }
  const cdf = (wf) => { const c = [0]; for (let i = 0; i < M; i++) c.push(c[i] + wf(i)); return c; };
  const areaC = cdf((i) => Math.abs(OX[i] * OY[i + 1] - OY[i] * OX[i + 1]));
  const arcC = cdf((i) => Math.hypot(OX[i + 1] - OX[i], OY[i + 1] - OY[i]));
  const pick = (c) => {
    const v = Math.random() * c[M]; let lo = 0, hi = M;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= v) lo = m; else hi = m; }
    const f = (v - c[lo]) / ((c[lo + 1] - c[lo]) || 1);
    return [OX[lo] + (OX[lo + 1] - OX[lo]) * f, OY[lo] + (OY[lo + 1] - OY[lo]) * f];
  };
  const COL = ['#f8ebc3', '#ecd5a0', '#dbbb73', '#c29a45', '#8cc4c1', '#fff9ea', '#ffeec6'];
  const WGT = [0.26, 0.32, 0.22, 0.12, 0.04, 0.04];
  const SP = COL.map((c) => {                                   // one soft glow sprite per colour
    const s = document.createElement('canvas'); s.width = s.height = 32;
    const g = s.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, c); gr.addColorStop(0.35, c + 'aa'); gr.addColorStop(1, c + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return s;
  });
  let groups = COL.map(() => []);
  const build = () => {
    const N = W < 700 ? 3300 : 5800;
    for (let i = 0; i < N; i++) {
      const rim = Math.random() < 0.15;                         // crisp glowing edge
      const r = rim ? rnd(0.97, 1) : Math.sqrt(Math.random()) * 0.97;
      const [hx, hy] = pick(rim ? arcC : areaC);
      const side = Math.random() < 0.5 ? -1 : 1;
      const z = side * 0.44 * Math.sqrt(Math.max(0, 1 - r * r)) + rnd(-0.015, 0.015);
      if (nameMask && inName(hx * r, hy * r)) continue;     // leave a soft dark halo around the name
      let b = 0, a = Math.random(), acc = 0;
      for (; b < WGT.length - 1; b++) { acc += WGT[b]; if (a < acc) break; }
      const ang = rnd(0, TAU), rad = rnd(1.6, 2.6);
      groups[b].push({
        x: hx * r + rnd(-0.012, 0.012), y: hy * r + rnd(-0.012, 0.012), z,
        sx: Math.cos(ang) * rad, sy: rnd(-1, 1) * rad * 0.8, sz: Math.sin(ang) * rad,   // scattered start
        d: rnd(0, 1.1), du: 1.9, wb: 0.012, s: rnd(0.7, 1.7), ph: rnd(0, TAU), rim
      });
    }
  };
  /* ---------- the name, written in light on the face of the heart ---------- */
  const NAME_FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
  const NY = 0.1;                                    // vertical centre of the name on the heart
  const RHO = new Array(360).fill(0);                // heart radius by angle → surface height under any (x, y)
  for (let i = 0; i < M; i++) {
    const b = Math.floor(((Math.atan2(OY[i], OX[i]) + Math.PI) / TAU) * 360) % 360;
    RHO[b] = Math.max(RHO[b], Math.hypot(OX[i], OY[i]));
  }
  for (let k = 0; k < 2; k++) for (let b = 0; b < 360; b++) if (!RHO[b]) RHO[b] = RHO[(b + 359) % 360] || RHO[(b + 1) % 360];
  const faceZ = (x, y) => {
    const b = Math.floor(((Math.atan2(y, x) + Math.PI) / TAU) * 360) % 360;
    const r = Math.min(0.985, Math.hypot(x, y) / (RHO[b] || 1));
    return 0.44 * Math.sqrt(1 - r * r);
  };
  let nameMask = null;
  const inName = (x, y) => {
    const m = nameMask;
    const u = Math.round(x / m.sc + m.mx), v = Math.round((NY - y) / m.sc + m.my);
    return u >= 0 && u < m.cw && v >= 0 && v < m.ch && m.halo[(v * m.cw + u) * 4 + 3] > 40;
  };
  const buildName = () => {
    if (!NAME) return;
    const cw = 480, ch = 190;
    const raster = (stroke) => {
      const o = document.createElement('canvas'); o.width = cw; o.height = ch;
      const g = o.getContext('2d');
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = g.strokeStyle = '#fff';
      g.lineJoin = 'round'; g.lineWidth = stroke;
      g.font = `italic 500 ${ch * 0.86}px ${NAME_FONT}`;
      const fit = Math.min(1, (cw * 0.92) / g.measureText(NAME).width);
      g.font = `italic 500 ${ch * 0.86 * fit}px ${NAME_FONT}`;
      g.fillText(NAME, cw / 2, ch * 0.55);
      if (stroke) g.strokeText(NAME, cw / 2, ch * 0.55);
      return g.getImageData(0, 0, cw, ch).data;
    };
    const ink = raster(0), halo = raster(22);
    let x0 = cw, x1 = 0, y0 = ch, y1 = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (ink[(y * cw + x) * 4 + 3] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 <= x0) return;
    const sc = Math.min(1.12 / (x1 - x0 + 1), 0.52 / (y1 - y0 + 1));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    nameMask = { halo, cw, ch, sc, mx, my };
    const step = W < 700 ? 3 : 2;
    for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
      if (ink[(y * cw + x) * 4 + 3] < 130) continue;
      const wx = (x - mx) * sc, wy = NY - (y - my) * sc, wz = faceZ(wx, wy) + 0.035;
      const dl = 1.5 + ((x - x0) / (x1 - x0 + 1)) * 1.1 + rnd(0, 0.25);      // writes itself left → right
      [[wx, wz]].forEach(([X, Z]) => {                                       // front face only; it fades as the heart turns away
        const ang = rnd(0, TAU), rad = rnd(1.6, 2.6);
        groups[6].push({
          x: X + rnd(-0.004, 0.004), y: wy + rnd(-0.004, 0.004), z: Z,
          sx: Math.cos(ang) * rad, sy: rnd(-1, 1) * rad * 0.8, sz: Math.sin(ang) * rad,
          d: dl, du: 1.3, wb: 0.003, s: rnd(0.72, 1.12), ph: rnd(0, TAU), rim: false
        });
      });
    }
  };
  const beatAt = (t) => {                                        // lub-dub
    const p = (t % 1.7) / 1.7;
    return 0.07 * Math.exp(-(((p - 0.08) / 0.05) ** 2)) + 0.045 * Math.exp(-(((p - 0.27) / 0.06) ** 2));
  };

  /* ---------- orbiting 3D love text ---------- */
  const RINGS = [
    { text: '', R: 1.62, tilt: -0.34, roll: 0.14, spd: 0.34, fs: 15, fill: 'rgb(248,236,200)' },
    { text: 'ALWAYS  •  FOREVER  •  YOURS  •  ALWAYS  •  FOREVER  •  YOURS  •  ', R: 1.3, tilt: 0.5, roll: -0.22, spd: -0.26, fs: 10, fill: 'rgb(140,196,193)' }
  ];
  const FONT = '"Manrope","Helvetica Neue",Arial,sans-serif';
  const prepRings = () => {
    const unit = NAME ? `I LOVE YOU  •  ${NAME.toUpperCase()}  •  ` : 'I LOVE YOU  •  ';
    RINGS[0].text = unit.repeat(NAME ? (W < 700 ? 2 : 3) : (W < 700 ? 3 : 4));
    RINGS.forEach((r) => {
      ctx.font = `500 ${r.fs}px ${FONT}`;
      const chars = [...r.text];
      const ws = chars.map((c) => ctx.measureText(c).width + r.fs * 0.28);
      const total = ws.reduce((a, b) => a + b, 0);
      let acc = 0;
      r.g = chars.map((c, i) => { const th = ((acc + ws[i] / 2) / total) * TAU; acc += ws[i]; return { c, th }; });
    });
  };
  const A = {}, B = {};
  const ringPt = (r, th, o) => {
    const R = r.R * rs, x = Math.cos(th) * R, z = -Math.sin(th) * R;      // increasing th reads left → right at the front
    const y1 = -z * Math.sin(r.tilt), z1 = z * Math.cos(r.tilt);
    const x2 = x * Math.cos(r.roll) - y1 * Math.sin(r.roll), y2 = x * Math.sin(r.roll) + y1 * Math.cos(r.roll);
    const s = Math.min(2.4, F / (F - z1));
    o.x = cx + x2 * U * s; o.y = cy - y2 * U * s; o.z = z1; o.s = s;
  };
  const drawRing = (r, t, front, fade) => {
    if (!r.g) return;
    ctx.font = `500 ${r.fs * dot * Math.max(rs, 0.85)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = r.fill;
    const rot = reduce ? 0 : t * r.spd;
    for (const g of r.g) {
      const th = g.th + rot;
      ringPt(r, th, A);
      if ((A.z >= 0) !== front) continue;
      ringPt(r, th + 0.02, B);
      const vx = B.x - A.x, vy = B.y - A.y;
      const ratio = clamp(Math.hypot(vx, vy) / (0.02 * r.R * rs * U * A.s), 0, 1.1);
      if (ratio < 0.14) continue;                                // edge-on glyphs vanish
      let ang = Math.atan2(vy, vx), flip = 1;
      if (vx < 0) { ang += Math.PI; flip = -1; }                 // back side reads mirrored, like real 3D text
      ctx.globalAlpha = (0.2 + 0.8 * clamp(0.5 + A.z / (r.R * rs * 2.2))) * fade;
      ctx.save();
      ctx.translate(A.x, A.y); ctx.rotate(ang); ctx.scale(flip * ratio * A.s, A.s);
      ctx.fillText(g.c, 0, 0);
      ctx.restore();
    }
  };

  /* ---------- stars, sparks, input ---------- */
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.5, 1.4), ph: rnd(0, TAU), sp: rnd(0.6, 1.8) }));
  const sparks = [];
  let px = 0, py = 0, tx = 0, ty = 0, kick = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / W - 0.5) * 2; ty = (e.clientY / H - 0.5) * 2; });
  addEventListener('pointerdown', () => {
    kick = 1;
    for (let i = 0; i < 46; i++) {
      const a = rnd(0, TAU), v = rnd(0.5, 2.1);
      sparks.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.3, life: 1, k: rnd(0.8, 1.6) });
    }
  });

  /* ---------- render ---------- */
  let last = 0;
  const draw = (t) => {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    ctx.clearRect(0, 0, W, H);
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    kick *= 0.93;
    const beat = reduce ? 0 : beatAt(t) + kick * 0.09;
    const sc = 1 + beat;
    const ry = (reduce ? 0.35 : Math.sin(t * 0.55) * 0.95 + Math.sin(t * 0.23) * 0.3) + px * 0.5;
    const rx = 0.1 + py * 0.3 + (reduce ? 0 : Math.sin(t * 0.6) * 0.04);
    const cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#f3e8c8';
    for (const s of stars) {
      ctx.globalAlpha = reduce ? 0.35 : 0.12 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.fillRect(s.x * W - px * 8 * s.r, s.y * H - py * 8 * s.r, s.r, s.r);
    }
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, U * 2.3);
    gr.addColorStop(0, `rgba(236,208,140,${0.16 + beat * 1.2})`);
    gr.addColorStop(0.5, 'rgba(70,130,140,0.07)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = gr;
    ctx.fillRect(cx - U * 2.3, cy - U * 2.3, U * 4.6, U * 4.6);

    const fade = clamp((t - 1.6) / 1.4);
    RINGS.forEach((r) => drawRing(r, t, false, fade));          // back half of the rings

    ctx.globalCompositeOperation = 'lighter';
    const faceA = clamp((cY * cX + 0.1) / 0.45);                 // how squarely the name faces you
    for (let g = 0; g < groups.length; g++) {
      if (g === 6 && faceA < 0.02) continue;
      const spr = SP[g];
      for (const p of groups[g]) {
        const e = reduce ? 1 : clamp((t - p.d) / p.du);
        const k = 1 - (1 - e) ** 3;
        let x = p.sx + (p.x - p.sx) * k, y = p.sy + (p.y - p.sy) * k, z = p.sz + (p.z - p.sz) * k;
        if (e >= 1 && !reduce) { const w = Math.sin(t * 1.4 + p.ph) * p.wb; x += w; y += w * 0.7; z += w; }
        x *= sc; y *= sc; z *= sc;
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        const y2 = y * cX - z1 * sX, z2 = y * sX + z1 * cX;
        const s = Math.min(2.4, F / (F - z2));
        const a = clamp(0.22 + (z2 + 0.7) * 0.55) * (p.rim ? 1.1 : 1) * (0.35 + 0.65 * k) * (g === 6 ? faceA * 0.8 : 1);
        ctx.globalAlpha = a > 1 ? 1 : a;
        const r = p.s * dot * s * (p.rim ? 1.15 : 1);
        const d = r * 2.7;
        ctx.drawImage(spr, cx + x1 * U * s - d / 2, cy - y2 * U * s - d / 2, d, d);
      }
    }

    ctx.fillStyle = '#fff3cf';
    for (let i = sparks.length - 1; i >= 0; i--) {              // tap sparks
      const s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.985; s.vy *= 0.985; s.life -= dt * 0.9;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = s.life;
      const d = s.k * dot * 5;
      ctx.drawImage(SP[5], cx + s.x * U - d / 2, cy - s.y * U - d / 2, d, d);
    }

    ctx.globalCompositeOperation = 'source-over';
    RINGS.forEach((r) => drawRing(r, t, true, fade));           // front half of the rings
    ctx.globalAlpha = 1;
  };

  /* ---------- start ---------- */
  resize();
  let t0 = 0;
  const loadFont = (f) => (document.fonts && document.fonts.load ? document.fonts.load(f) : Promise.resolve());
  const fontsReady = Promise.race([
    Promise.all([loadFont('500 15px Manrope'), loadFont('italic 500 100px "Cormorant Garamond"')]),
    new Promise((r) => setTimeout(r, 1500))
  ]);
  fontsReady.catch(() => {}).then(() => {
    prepRings(); buildName(); build();
    if (reduce) { draw(9); addEventListener('resize', () => { resize(); draw(9); }); return; }
    addEventListener('resize', resize);
    t0 = performance.now();
    const loop = (now) => { draw((now - t0) / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
})();