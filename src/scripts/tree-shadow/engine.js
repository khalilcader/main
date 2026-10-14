// Tree shadow: a WebGL shader of a tree's shadow swaying on a wall, with grain.
// Copied as-is from Khalil's "Tree Shadow" artifact
// (https://claude.ai/artifact/JCnCdtAK5ne1X4kASHin7N): the tree grower, the
// species tables and the shader. The runtime that drives it on a cover is in
// ./index.ts.
// ─────────────── 1. Grow a tree into a texture ───────────────
// R = trunk + limbs, G = twigs, B = leaves. The shader moves each
// layer by a different amount so leaves flutter more than limbs.
const TEX = 2048;
const UP = -Math.PI / 2;

const SPECIES = {
  broadleaf: { max: 9, trunkLen: 0.19, trunkW: 58, spread: [0.34, 0.58], lenK: [0.62, 0.88], widthK: [0.6, 0.72],
               tropism: 0.03, side: 0.13, leafFrom: 2, leafSkip: 0.45, leaf: [8, 15], leafAspect: 0.42, leafReach: 26 },
  birch:     { max: 9, trunkLen: 0.21, trunkW: 34, spread: [0.18, 0.34], lenK: [0.62, 0.8], widthK: [0.62, 0.74],
               tropism: 0.08, side: 0.22, leafFrom: 4, leafSkip: 0.4, leaf: [5, 9], leafAspect: 0.62, leafReach: 20 },
  willow:    { max: 8, trunkLen: 0.17, trunkW: 62, spread: [0.4, 0.72], lenK: [0.74, 0.96], widthK: [0.56, 0.68],
               tropism: 0.03, side: 0.16, droopFrom: 4, droop: 0.2, leafFrom: 4, leafSkip: 0.15,
               leaf: [9, 16], leafAspect: 0.2, leafReach: 10, leafAlign: true },
  bare:      { max: 10, trunkLen: 0.19, trunkW: 58, spread: [0.34, 0.6], lenK: [0.62, 0.86], widthK: [0.62, 0.74],
               tropism: 0.03, side: 0.18, leafFrom: -1 },
};

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Palm varieties. Lengths are fractions of the texture; angles in radians.
//   th   launch angle from vertical, newest frond → oldest
//   bend how far a frond arches over along its length, newest → oldest
//   beta angle between leaflet and rachis, base → tip
const PALMS = {
  palm: {        // coconut: slender curved trunk, long arching fronds, hanging leaflets
    stems: 1, trunkLen: [0.5, 0.5], trunkW: 38, lean: [0.1, 0.26], straighten: 0.35, ring: 3, nuts: 8,
    N: [20, 26], len: [0.34, 0.4], th: [0.1, 1.9], bend: [0.5, 1.4], leaflet: [0.22, 0.27],
    droop: [0.7, 1.2], step: 10, lw: [3.2, 6.2], beta: [1.15, 0.55], lift: [0.34, 0.34], gaps: 0.05,
  },
  palmDate: {    // date: stout rough trunk, dense round crown of stiff, spiky fronds
    stems: 1, trunkLen: [0.44, 0.48], trunkW: 54, lean: [0, 0.05], straighten: 1, ring: 8, nuts: 0,
    N: [36, 46], len: [0.27, 0.33], th: [0.05, 2.15], bend: [0.2, 0.55], leaflet: [0.12, 0.16],
    droop: [0.1, 0.35], step: 9, lw: [2.4, 4.4], beta: [0.95, 0.4], lift: [0.5, 0.7], gaps: 0.03,
  },
  palmRoyal: {   // royal: tall smooth column, crownshaft, a few big feathery fronds
    stems: 1, trunkLen: [0.5, 0.54], trunkW: 46, lean: [0, 0.03], straighten: 1, ring: 0, nuts: 0, shaft: true,
    N: [12, 16], len: [0.36, 0.43], th: [0.2, 1.7], bend: [0.7, 1.3], leaflet: [0.2, 0.25],
    droop: [0.8, 1.4], step: 8, lw: [2.4, 4.6], beta: [1.2, 0.7], lift: [-0.5, 0.9], gaps: 0.04,
  },
  palmFan: {     // fan: round pleated fans on long stalks, skirt of old leaves below
    stems: 1, trunkLen: [0.5, 0.54], trunkW: 36, lean: [0.03, 0.1], straighten: 0.6, ring: 4, nuts: 0, skirt: true,
    fan: true, N: [22, 30], len: [0.12, 0.19], fanR: [0.12, 0.16], th: [0.1, 2.2], bend: [0.2, 0.6], gaps: 0.04,
  },
  palmAreca: {   // areca: a clump of thin canes, each with a few graceful fronds
    stems: [4, 6], trunkLen: [0.2, 0.36], trunkW: 13, lean: [0.1, 0.42], straighten: 0.5, ring: 3, nuts: 0,
    N: [5, 7], len: [0.3, 0.38], th: [0.15, 1.25], bend: [0.8, 1.5], leaflet: [0.2, 0.27],
    droop: [0.4, 0.8], step: 14, lw: [3.4, 7], beta: [1.0, 0.55], lift: [0.3, 0.4], gaps: 0.06,
  },
};

// Every tree is grown as a 3D model (x right, y up, z out from the wall toward
// the sun), spun and tilted, then flattened onto the wall. rotY spins it about
// its trunk; rotX tips it toward or away from the wall.
function buildTree(type, seed, rotY = 0, rotX = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, TEX, TEX);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';

  // Depth map, half-res: R = distance from the wall × coverage, G = coverage.
  // The shader divides one by the other to get how far the nearby foliage sits
  // from the wall, and blurs its shadow to match.
  const dc = document.createElement('canvas');
  dc.width = dc.height = TEX / 2;
  const gd = dc.getContext('2d');
  gd.fillStyle = '#000';
  gd.fillRect(0, 0, TEX / 2, TEX / 2);
  gd.scale(0.5, 0.5);
  gd.lineCap = 'round';
  c.depth = dc;
  let z = 0.5;  // 0 = against the wall, 1 = far out toward the sun

  const rnd = mulberry32(seed * 7919 + type.length * 104729);
  const R = (a, b) => a + (b - a) * rnd();
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const TAU = Math.PI * 2;

  // ── 2D drawing, onto the shadow texture and the depth map together
  const both = (col, draw) => {
    g.strokeStyle = g.fillStyle = col; draw(g);
    gd.strokeStyle = gd.fillStyle = `rgb(${Math.round(clamp01(z) * 255)},255,0)`; draw(gd);
  };
  const line = (x0, y0, x1, y1, w, col) => both(col, k => {
    k.lineWidth = Math.max(1.2, w);
    k.beginPath(); k.moveTo(x0, y0); k.lineTo(x1, y1); k.stroke();
  });
  const leaf = (x, y, len, aspect, rot) => both('#00f', k => {
    k.beginPath(); k.ellipse(x, y, len, len * aspect, rot, 0, TAU); k.fill();
  });
  const blade = (x0, y0, mx, my, x1, y1, w) => both('#00f', k => {
    k.lineWidth = w;
    k.beginPath(); k.moveTo(x0, y0); k.quadraticCurveTo(mx, my, x1, y1); k.stroke();
  });
  const dot = (x, y, r, col) => both(col, k => {
    k.beginPath(); k.arc(x, y, r, 0, TAU); k.fill();
  });

  // ── 3D helpers
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const UPV = [0, 1, 0], DOWNV = [0, -1, 0];
  // turn d by `ang`, toward the side at azimuth `az` around it
  const perturb = (d, ang, az) => {
    let u = cross(d, UPV);
    if (Math.hypot(u[0], u[1], u[2]) < 1e-3) u = [1, 0, 0];
    u = norm(u);
    const v = cross(d, u);
    const s = Math.sin(ang), co = Math.cos(ang), ca = Math.cos(az), sa = Math.sin(az);
    return norm([d[0] * co + (u[0] * ca + v[0] * sa) * s,
                 d[1] * co + (u[1] * ca + v[1] * sa) * s,
                 d[2] * co + (u[2] * ca + v[2] * sa) * s]);
  };
  const bx = TEX * 0.5, by = TEX - 48, ZREF = TEX * 0.42;
  const cyw = Math.cos(rotY), syw = Math.sin(rotY), cpt = Math.cos(rotX), spt = Math.sin(rotX);
  // model → wall: spin, tilt, then cast along slightly oblique light.
  // Returns [x, y, depth 0..1].
  const P = v => {
    const x = v[0] * cyw + v[2] * syw, z1 = -v[0] * syw + v[2] * cyw;
    const y = v[1] * cpt - z1 * spt, z2 = v[1] * spt + z1 * cpt;
    return [bx + x + z2 * 0.3, by - (y + z2 * 0.14), 0.5 + z2 / (2 * ZREF)];
  };
  const seg3 = (p, q, w, col) => {
    const a = P(p), b = P(q);
    z = (a[2] + b[2]) / 2;
    line(a[0], a[1], b[0], b[1], w, col);
    return b;
  };
  const dirOnWall = (p, d) => {
    const a = P(p), b = P(add(p, d, 10));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };

  if (type === 'pine') growPine();
  else if (PALMS[type]) growPalm(PALMS[type]);
  else if (type === 'blinds') growBlinds();
  else if (type !== 'none') growBranching(SPECIES[type] || SPECIES.broadleaf);

  // keep a clean black border so clamped sampling stays empty
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#000';
  g.lineWidth = 24;
  g.strokeRect(0, 0, TEX, TEX);
  return c;

  function growBranching(sp) {
    function leaves(p, d, depth) {
      const n = depth >= sp.max - 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        if (rnd() < sp.leafSkip) continue;
        const a = P(add(p, [R(-1, 1), R(-1, 1), R(-1, 1)], sp.leafReach * 0.8));
        z = a[2];
        const rot = sp.leafAlign ? dirOnWall(p, d) + R(-0.25, 0.25) : R(0, TAU);
        // leaves face every which way, so some are seen nearly edge-on
        const aspect = sp.leafAspect * (sp.leafAlign ? 1 : R(0.45, 1.1));
        leaf(a[0], a[1], R(sp.leaf[0], sp.leaf[1]), aspect, rot);
      }
    }
    function branch(p, d, len, w, depth) {
      const drooping = sp.droopFrom !== undefined && depth >= sp.droopFrom;
      const segs = drooping ? 7 : 5;
      const col = depth < 3 ? '#f00' : '#0f0';
      for (let i = 0; i < segs; i++) {
        d = perturb(d, R(0, 0.13), R(0, TAU));
        d = norm(add(d, drooping ? DOWNV : UPV, drooping ? sp.droop * 1.3 : sp.tropism * 1.6));
        const q = add(p, d, len / segs);
        seg3(p, q, w * (1 - 0.3 * i / segs), col);
        p = q;
        if (sp.leafFrom >= 0 && depth >= sp.max - sp.leafFrom) leaves(p, d, depth);
        if (depth >= 2 && depth + 2 <= sp.max && rnd() < sp.side) {
          branch(p, perturb(d, R(0.5, 1.0), R(0, TAU)), len * R(0.45, 0.62), w * 0.5, depth + 2);
        }
      }
      if (depth >= sp.max) return;
      const n = depth < 2 && rnd() < 0.6 ? 3 : 2;
      const spread = R(sp.spread[0], sp.spread[1]);
      const az0 = R(0, TAU);
      for (let i = 0; i < n; i++) {
        branch(p, perturb(d, spread * R(0.75, 1.15), az0 + i * TAU / n + R(-0.5, 0.5)),
               len * R(sp.lenK[0], sp.lenK[1]), w * R(sp.widthK[0], sp.widthK[1]), depth + 1);
      }
    }
    branch([0, 0, 0], norm([R(-0.05, 0.05), 1, R(-0.05, 0.05)]), TEX * sp.trunkLen, sp.trunkW, 0);
  }

  function growPalm(v) {
    const pick = r => Array.isArray(r) ? R(r[0], r[1]) : r;
    const nStems = Math.round(pick(v.stems));
    for (let sIdx = 0; sIdx < nStems; sIdx++) {
      // trunk
      const az = R(0, TAU) + sIdx * TAU / nStems;
      const lean = pick(v.lean);
      let d = norm([Math.sin(lean) * Math.cos(az), Math.cos(lean), Math.sin(lean) * Math.sin(az)]);
      let p = nStems > 1 ? [R(-22, 22), 0, R(-22, 22)] : [0, 0, 0];
      const steps = 48, stepLen = TEX * pick(v.trunkLen) / steps;
      for (let i = 0; i < steps; i++) {
        const f = i / steps;
        d = norm(add(perturb(d, R(0, 0.012), R(0, TAU)), UPV, v.straighten * 0.03));
        const q = add(p, d, stepLen);
        seg3(p, q, v.trunkW * (1 - 0.15 * f) + v.trunkW * 0.5 * Math.pow(1 - f, 6) + (i % 2 ? v.ring : 0), '#f00');
        p = q;
      }
      if (v.shaft) {  // smooth crownshaft: a swollen sleeve the fronds emerge from
        for (let i = 0; i < 8; i++) {
          const q = add(p, d, TEX * 0.011);
          seg3(p, q, v.trunkW * (1.2 - 0.09 * i), '#f00');
          p = q;
        }
      }
      const crown = p;
      const cp = P(crown);
      if (sIdx === 0) c.crown = [cp[0] / TEX, 1 - cp[1] / TEX];
      z = cp[2];
      for (let k = 0; k < v.nuts; k++) dot(cp[0] + R(-34, 34), cp[1] + R(-4, 40), R(13, 21), '#f00');
      if (v.skirt) {  // old fans folded down against the trunk
        for (let k = 0; k < 46; k++) {
          const a = P(add(crown, [R(-40, 40), -R(0, TEX * 0.13), R(-40, 40)]));
          z = a[2];
          leaf(a[0], a[1], R(40, 85), R(0.2, 0.34), Math.PI / 2 + R(-0.35, 0.35));
        }
      }

      const N = Math.round(pick(v.N));
      const phase = R(0, TAU);
      const Lmax = TEX * pick(v.len);
      for (let k = 0; k < N; k++) {
        const age = (k + 0.5) / N;                         // 0 = newest spear, 1 = oldest
        const phi = phase + k * 2.39996 + R(-0.25, 0.25);  // spiral phyllotaxis
        const th0 = v.th[0] + (v.th[1] - v.th[0]) * Math.pow(age, 0.85) + R(-0.1, 0.1);
        const bend = (v.bend[0] + (v.bend[1] - v.bend[0]) * age) * R(0.8, 1.25);
        const len = Lmax * (0.55 + 0.45 * Math.min(1, age / 0.35)) * R(0.9, 1.05);
        const gaps = v.gaps + 0.4 * Math.pow(age, 4);
        if (v.fan) fanLeaf(crown, phi, th0, bend, len, TEX * pick(v.fanR), gaps);
        else frond(crown, phi, th0, bend, len, gaps);
      }
    }

    // a stalk that arches under gravity; calls each(p, T, H, f) along it
    function stalk(from, phi, th0, bend, len, step, w0, each) {
      const cph = Math.cos(phi), sph = Math.sin(phi);
      const H = [-sph, 0, cph];
      const segs = Math.max(4, Math.round(len / step));
      let p = from, T;
      for (let i = 0; i < segs; i++) {
        const f = i / segs;
        const th = Math.min(th0 + bend * Math.pow(f, 1.4), 2.9);
        T = [Math.sin(th) * cph, Math.cos(th), Math.sin(th) * sph];
        const q = add(p, T, step);
        seg3(p, q, w0 * (1 - f) + 1.5, '#0f0');
        p = q;
        if (each && i >= 4) each(p, T, H, f);
      }
      return [p, T, H];
    }

    // feather frond: leaflets down both sides of the rachis
    function frond(from, phi, th0, bend, len, gaps) {
      const lmax = len * pick(v.leaflet);
      const droop = pick(v.droop);
      stalk(from, phi, th0, bend, len, v.step, 6.5, (p, T, H, f) => {
        const b = P(p);
        z = b[2];
        const up = cross(H, T);
        const beta = v.beta[0] + (v.beta[1] - v.beta[0]) * f;  // leaflets sweep forward toward the tip
        const l0 = 14 + lmax * Math.pow(Math.sin(Math.PI * Math.pow(f, 0.6)), 0.8);
        for (const side of [-1, 1]) {
          if (rnd() < gaps) continue;  // wind-torn gaps, more on old fronds
          const l = l0 * R(0.85, 1.1);
          const lift = pick(v.lift);
          const out = norm(add([up[0] * lift, up[1] * lift, up[2] * lift], H, side));
          const d0 = norm(add([T[0] * Math.cos(beta), T[1] * Math.cos(beta), T[2] * Math.cos(beta)], out, Math.sin(beta)));
          const m = add(p, d0, l * 0.45);
          const e = add(m, norm(add(d0, DOWNV, droop * R(0.8, 1.2))), l * 0.55);
          const m2 = P(m), e2 = P(e);
          blade(b[0], b[1], m2[0], m2[1], e2[0], e2[1], v.lw[0]);
          // fatter toward the rachis, so the blade tapers
          blade(b[0], b[1], (b[0] + m2[0]) / 2, (b[1] + m2[1]) / 2, m2[0], m2[1], R(v.lw[1] * 0.88, v.lw[1] * 1.12));
        }
      });
    }

    // fan leaf: a long bare stalk, then pleated segments radiating from its tip
    function fanLeaf(from, phi, th0, bend, len, radius, gaps) {
      const [p, T, H] = stalk(from, phi, th0, bend, len, 12, 5, null);
      const b = P(p);
      z = b[2];
      const up = cross(H, T);
      const M = 30, droop = R(0.4, 1.1);
      for (let j = 0; j < M; j++) {
        if (rnd() < gaps) continue;
        const a = (j / (M - 1) * 2 - 1) * 1.85;
        const fold = 0.18 * Math.cos(a * 2);
        const d0 = norm(add(add([T[0] * Math.cos(a), T[1] * Math.cos(a), T[2] * Math.cos(a)], H, Math.sin(a)), up, fold));
        const l = radius * (0.72 + 0.28 * Math.cos(a * 0.8)) * R(0.92, 1.06);
        const m = add(p, d0, l * 0.6);
        const e = add(m, norm(add(d0, DOWNV, droop * R(0.7, 1.2))), l * 0.4);
        const m2 = P(m), e2 = P(e);
        blade(b[0], b[1], m2[0], m2[1], e2[0], e2[1], 3);
        // segments are fused for the inner half of the fan
        blade(b[0], b[1], (b[0] + m2[0]) / 2, (b[1] + m2[1]) / 2, m2[0], m2[1], 11);
      }
    }
  }

  function growBlinds() {
    // slats of a window blind, each hanging a little differently, plus two cords
    z = 0.35;
    const pitch = R(64, 78), thick = pitch * R(0.48, 0.6);
    const x0 = TEX * 0.06, x1 = TEX * 0.94;
    for (let y = TEX * 0.1; y < TEX * 0.95; y += pitch) {
      const tilt = R(-3, 3), sag = R(1, 5);
      g.fillStyle = '#f00';
      gd.fillStyle = 'rgb(89,255,0)';
      for (const k of [g, gd]) {
        k.beginPath();
        k.moveTo(x0, y - tilt);
        k.quadraticCurveTo(TEX / 2, y + sag, x1, y + tilt);
        k.lineTo(x1, y + tilt + thick * R(0.92, 1.08));
        k.quadraticCurveTo(TEX / 2, y + sag + thick, x0, y - tilt + thick);
        k.fill();
      }
    }
    for (const cx of [TEX * 0.24, TEX * 0.76]) line(cx, TEX * 0.08, cx + R(-6, 6), TEX * 0.97, 5, '#f00');
  }

  function growPine() {
    function tuft(p, d) {
      const a = P(p);
      z = a[2];
      const ang = dirOnWall(p, d);
      for (let i = 0; i < 5; i++) {
        const an = ang + R(-1.3, 1.3);
        const len = R(13, 24);
        leaf(a[0] + Math.cos(an) * len * 0.8, a[1] + Math.sin(an) * len * 0.8, len, 0.1, an);
      }
    }
    function bough(p, d, len, w, depth) {
      const segs = 6;
      const lift = R(0.0, 0.05);  // tips curl upward
      for (let i = 0; i < segs; i++) {
        d = norm(add(perturb(d, R(0, 0.06), R(0, TAU)), UPV, lift));
        const q = add(p, d, len / segs);
        seg3(p, q, w * (1 - 0.6 * i / segs), '#0f0');
        p = q;
        tuft(p, d);
        if (depth < 2 && rnd() < 0.6) {
          // side shoots fan out roughly level with the bough
          bough(p, perturb(d, R(0.4, 0.85), (rnd() < 0.5 ? 0 : Math.PI) + R(-0.5, 0.5)), len * R(0.3, 0.5), w * 0.5, depth + 1);
        }
      }
    }
    // trunk
    const H = TEX * 0.86;
    let p = [0, 0, 0];
    const pts = [];
    while (p[1] < H) {
      const f = p[1] / H;
      const q = [p[0] + R(-2.2, 2.2), p[1] + 24, p[2] + R(-2.2, 2.2)];
      seg3(p, q, 46 * (1 - f) + 4, '#f00');
      pts.push([q, f]);
      p = q;
    }
    // whorls of boughs all round the trunk, shorter towards the crown
    let next = 0.24;
    for (const [pt, f] of pts) {
      if (f < next) continue;
      next = f + R(0.022, 0.04);
      const reach = Math.pow(1 - f, 0.9) * TEX * 0.23 + 22;
      const n = Math.round(R(3, 5));
      const az0 = R(0, TAU);
      for (let i = 0; i < n; i++) {
        const phi = az0 + i * TAU / n + R(-0.4, 0.4);
        const tilt = R(0.08, 0.4);  // drooping from the trunk
        bough(pt, [Math.cos(phi) * Math.cos(tilt), -Math.sin(tilt), Math.sin(phi) * Math.cos(tilt)],
              reach * R(0.65, 1.1), 9 * (1 - f) + 3, 0);
      }
    }
    tuft(p, UPV);
  }
}

// ───────────────────────── 2. Shader ─────────────────────────
const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTree;
uniform sampler2D uDepth;
uniform float uProg;
uniform float uDepthAmt;
uniform float uGradient;
uniform float uRays;
uniform float uStreak;
uniform float uRayAngle;
uniform float uFlare;
uniform float uBeams;
uniform float uFlip;
uniform float uBlinds;
uniform float uBlindAngle;
uniform float uBlindSize;
uniform float uBlindSoft;
uniform float uLeaves;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uPaper;
uniform vec3  uShadow;
uniform float uStrength;
uniform float uWind;
uniform float uGrain;
uniform float uAngle;
uniform float uZoom;
uniform float uSoft;
uniform float uDistort;
uniform vec2  uOffset;
uniform vec2  uCrown;
uniform float uFrond;
out vec4 outColor;

const vec2  BASE = vec2(0.5, 0.0234);   // trunk base in tree-texture space
const float TEXSIZE = 2048.0;
const int   TAPS = 14;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Slow gusts that drift across the canopy, 0..1
float gust(vec2 q, float t) {
  float a = 0.5 + 0.5 * sin(t * 0.42 + q.x * 2.2 + sin(t * 0.13) * 1.5);
  float b = vnoise(vec2(q.x * 1.6 - t * 0.25, q.y * 1.2 + t * 0.06));
  return mix(a, b, 0.55);
}

// Bend the tree about its base: rigid near the trunk, loose at the tips,
// plus a small high-frequency flutter for foliage.
vec2 bend(vec2 q, float amp, float flutter, float t) {
  vec2 r = q - BASE;
  float h = length(r);
  float g = gust(q, t);
  float th = uWind * amp * pow(h, 1.8) * (0.2 + g + 0.22 * sin(t * 1.15 + h * 5.0));
  float c = cos(th), s = sin(th);
  r = mat2(c, -s, s, c) * r;
  vec2 f = vec2(vnoise(q * 13.0 + vec2(t * 0.9, 0.0)),
                vnoise(q * 13.0 + vec2(5.2, t * 1.1))) - 0.5;
  return BASE + r + f * flutter * uWind * (0.35 + g);
}

float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.8660254, 0.5)), p.y);
}

// Window-blind slats: soft parallel bands, each hanging a little differently,
// sharper at one end than the other.
float blindShade(vec2 p, float t) {
  vec2 al = vec2(cos(uBlindAngle), sin(uBlindAngle));
  float u = dot(p, al);
  float v = dot(p, vec2(-al.y, al.x));
  float pitch = 0.1 * uBlindSize;
  float row = floor(v / pitch);
  v += (vnoise(vec2(u * 0.9, row * 1.7)) - 0.5) * pitch * 0.22
     + sin(t * 0.45 + row * 0.8) * 0.0025 * uWind;
  row = floor(v / pitch);
  float f = abs(fract(v / pitch) - 0.5) * 2.0;        // 0 mid-slat, 1 mid-gap
  float soft = clamp(0.2 * uBlindSoft * mix(0.6, 1.5, smoothstep(-0.8, 0.8, u)), 0.01, 0.6);
  float weight = 0.55 + 0.45 * hash12(vec2(row, 3.0));
  return smoothstep(0.58 + soft, 0.58 - soft, f) * weight;
}

// A leaf now and then, tumbling down through the light. Each of three slots
// rolls the dice once per cycle, so most of the time nothing is falling.
float fallingLeaves(vec2 p, float t, float halfW) {
  float acc = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float period = 9.0 + 7.0 * hash12(vec2(fi, 1.0));
    float tt = t + fi * 4.3;
    float k = floor(tt / period);
    float tau = tt - k * period;
    float ra = hash12(vec2(fi, k)), rb = hash12(vec2(k, fi + 7.0));
    if (hash12(vec2(fi + 3.0, k + 11.0)) > uLeaves) continue;
    float dur = min(5.0 + 3.0 * rb, period);
    float f = tau / dur;
    if (f > 1.0) continue;
    float size = 0.035 + 0.045 * ra;
    vec2 c = vec2((ra * 2.0 - 1.0) * halfW * 0.9 + 0.08 * sin(tau * 1.5 + rb * 6.28) + 0.02 * tau * uWind,
                  0.62 - f * 1.24);
    vec2 d = p - c;
    float th = ra * 6.28 + tau * (0.9 + rb) * (ra > 0.5 ? 1.0 : -1.0);
    d = mat2(cos(th), -sin(th), sin(th), cos(th)) * d;
    d.y /= max(0.22, abs(cos(tau * 1.9 + rb * 5.0)));  // tumbling: the leaf turns edge-on
    float x = d.x / size;
    float w = size * 0.42 * (1.0 - x * x) * (1.0 + 0.25 * x);  // fatter toward the stem
    float blur = size * (0.12 + 0.55 * rb);                     // some close and crisp, some far and soft
    float cov = smoothstep(blur, -blur, abs(d.y) - w) * smoothstep(1.0 + blur / size, 1.0 - blur / size, abs(x));
    acc = max(acc, cov * (1.0 - 0.55 * rb));
  }
  return acc;
}

float edgeMask(vec2 q, float w) {
  vec2 m = smoothstep(vec2(0.0), vec2(w), q) * smoothstep(vec2(1.0), vec2(1.0 - w), q);
  return m.x * m.y;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  if (uFlip > 0.5) frag.x = uRes.x - frag.x;
  float t = uTime;
  float s = max(uRes.y, uRes.x * 0.62);
  vec2 p = (frag - 0.5 * uRes) / s;

  // ── distortion: warp where the shadow lands (uneven wall / old glass)
  vec2 w1 = vec2(vnoise(p * 2.6 + vec2(0.0, t * 0.03)), vnoise(p * 2.6 + vec2(9.1, -t * 0.03))) - 0.5;
  vec2 w2 = vec2(vnoise(p * 7.3 + 2.0), vnoise(p * 7.3 + 6.4)) - 0.5;
  vec2 ps = p + (w1 + 0.45 * w2) * uDistort * 0.14;

  // ── place the tree: rotate about its base, keep the canopy near centre
  float ca = cos(uAngle), sa = sin(uAngle);
  vec2 base = vec2(-0.10, 0.18) + uOffset - vec2(sa, ca) * 0.80 * uZoom;
  vec2 pb = ps - base;
  pb.x -= pb.y * 0.10;
  vec2 q = BASE + mat2(ca, sa, -sa, ca) * pb * (0.60 / uZoom);

  q.y = max(q.y, 0.036);                 // trunk runs on below the texture
  float h = length(q - BASE);
  vec2 qBranch = bend(q, 0.030, 0.0012, t);
  vec2 qLeaf   = bend(q, 0.036, mix(0.0075, 0.0022, uFrond), t);
  if (uFrond > 0.5) {
    // palms: each frond swings on its own about the crown, more at the tip
    vec2 r = qLeaf - uCrown;
    float dist = length(r);
    vec2 dir = r / max(dist, 1e-4);
    float n = vnoise(dir * 1.7 + vec2(t * 0.33, 4.0)) - 0.5
            + 0.18 * sin(t * 1.3 + dir.x * 4.0 + dist * 9.0);
    float th = uWind * 0.22 * n * (0.35 + gust(q, t)) * smoothstep(0.0, 0.25, dist);
    float c = cos(th), sn = sin(th);
    qLeaf = uCrown + mat2(c, -sn, sn, c) * r;
  }

  // ── progressive blur. The sun is a disc ~0.53° wide, so a shadow's edge
  // softens in proportion to how far the thing casting it is from the wall.
  // Two distances add up: along the shadow from its foot, and each branch's own
  // depth toward or away from the wall (read from the depth map).
  vec2 z0 = textureLod(uDepth, qLeaf, 3.0).rg;
  vec2 z1 = textureLod(uDepth, qLeaf, 5.5).rg;
  vec2 zz = z0 + z1 * 0.35;
  float dep = mix(0.5, zz.r / max(zz.g, 1e-4), smoothstep(0.0, 0.02, zz.g));
  float prog = smoothstep(0.0, 0.95, h);
  float rB = 0.0011 + uProg * 0.0036 * prog
           + uDepthAmt * 0.0105 * (dep - 0.36) * (0.3 + 0.7 * prog);
  rB = max(rB, 0.0005) * uSoft;
  float rL = rB * mix(1.5, 1.0, uFrond);
  // streak blur: stretch the blur disc along the ray direction, as if the
  // light were raking across the wall
  vec2 rayDir = vec2(cos(uRayAngle), sin(uRayAngle));
  vec2 sAlong = mat2(ca, sa, -sa, ca) * rayDir;
  vec2 sAcross = vec2(-sAlong.y, sAlong.x);
  float stretch = 1.0 + uStreak * 9.0;
  float lodS = log2(stretch) * 0.55;
  float lodB = max(log2(rB * TEXSIZE) - 0.6 + lodS, 0.0);
  float lodL = max(log2(rL * TEXSIZE) - 0.6 + lodS, 0.0);

  // stochastic disc blur: few taps, rotated per pixel → a stippled penumbra
  float jitter = fract(ign(frag) + hash12(frag + 3.7)) * 6.2831853;
  float acc = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = (float(i) + 0.5) / float(TAPS);
    float a = float(i) * 2.3999632 + jitter;
    vec2 o = vec2(cos(a), sin(a)) * sqrt(fi);
    o = sAlong * o.x * stretch + sAcross * o.y;
    vec3 A = textureLod(uTree, qBranch + o * rB, lodB).rgb;
    vec2 L = textureLod(uTree, qLeaf + o * rL, lodL).gb;
    acc += max(max(A.r, mix(A.g, L.x, uFrond)), L.y * 0.88);
  }
  float d = acc / float(TAPS);
  d = min(d * 1.06, 1.0) * edgeMask(vec2(q.x, max(q.y, 0.5)), 0.03);
  // extra grain only where the shadow is partial
  d += (hash12(frag + 17.0) - 0.5) * 0.22 * uGrain * d * (1.0 - d) * 4.0;
  d = clamp(d, 0.0, 1.0);

  // ── a second, far-out-of-focus canopy for depth
  float l2 = 0.5 - uAngle * 0.5;
  mat2 rot2 = mat2(cos(l2), -sin(l2), sin(l2), cos(l2));
  vec2 q2 = vec2(0.5, 0.60) + rot2 * (ps - vec2(0.40, 0.25)) * 0.30;
  q2.x = 1.0 - q2.x;
  q2 = bend(q2, 0.06, 0.012, t * 0.8 + 11.0);
  vec3 F = textureLod(uTree, q2, 6.0).rgb;
  float d2 = smoothstep(0.02, 0.75, F.b + F.g * 0.6 + F.r * 0.4) * edgeMask(q2, 0.3);

  float shade = 1.0 - (1.0 - d * uStrength) * (1.0 - d2 * 0.22 * uStrength);
  if (uBlinds > 0.001) shade = 1.0 - (1.0 - shade) * (1.0 - blindShade(ps, t) * uBlinds * uStrength);

  // ── light: soft falloff + very slow drift, like thin cloud passing
  float fall = dot(p - vec2(0.18, 0.12), p - vec2(0.18, 0.12));
  float light = 1.0 - 0.16 * fall * (1.0 - 0.85 * uGradient) + 0.022 * (vnoise(p * 1.4 + t * 0.05) - 0.5);

  // ── gradient wash: bright on the side the light comes from, dim on the other
  vec2 gDir = vec2(cos(uRayAngle + 0.3), sin(uRayAngle + 0.3));
  vec2 pg = (frag - 0.5 * uRes) / (uRes.x * 0.62);  // spans the frame width at any aspect
  float ramp = smoothstep(-0.35, 0.9, dot(pg, gDir) + 0.14 * (vnoise(p * 1.1 + 3.0) - 0.5));
  light *= 1.0 - uGradient * 0.36 * ramp;
  shade *= mix(1.0, 0.1 + 0.9 * ramp, uGradient);  // the lit side stays clean

  // ── rays: soft flecks of light stretched along the ray direction
  vec2 rp = vec2(dot(ps, rayDir), dot(ps, vec2(-rayDir.y, rayDir.x)));
  float r1 = vnoise(vec2(rp.x * 1.1 - t * 0.035, rp.y * 7.0 + 2.0));     // broad bands
  float r2 = vnoise(vec2(rp.x * 3.4 + t * 0.05, rp.y * 24.0 - 4.0));     // short dashes
  float r3 = vnoise(vec2(rp.x * 0.6 + t * 0.02, rp.y * 2.6 + 9.0));      // where they gather
  float band = smoothstep(0.5, 0.85, r1);
  float dash = smoothstep(0.56, 0.8, r2 * 0.75 + r1 * 0.25);
  float fleck = max(band * 0.55, dash) * smoothstep(0.2, 0.65, r3);
  float rays = uRays * fleck * (0.15 + 0.85 * ramp);

  if (uLeaves > 0.001) {
    float lf = fallingLeaves(ps, t, 0.5 * uRes.x / s) * mix(1.0, 0.3 + 0.7 * ramp, uGradient);
    shade = 1.0 - (1.0 - shade) * (1.0 - lf * uStrength * 0.9);
  }

  vec3 col = mix(uPaper, uShadow, shade * (1.0 - 0.7 * rays)) * light;
  col = mix(col, uPaper, rays * 0.6);

  // ── lens flare: a glow at the light source (just off-frame on the lit side),
  // faint beams fanning from it, and soft hexagonal ghosts strung along the
  // line from the source through the middle of the frame
  if (uFlare + uBeams > 0.001) {
    vec2 src = -gDir * 0.95 + vec2(-gDir.y, gDir.x) * 0.55 + 0.04 * vec2(sin(t * 0.11), cos(t * 0.09));
    vec2 axis = vec2(0.10 * sin(t * 0.07), 0.08 * cos(t * 0.05)) - src;
    vec2 an = normalize(axis);
    vec2 dv = pg - src;
    float dist = length(dv);
    float ang = atan(an.x * dv.y - an.y * dv.x, dot(an, dv));

    float beam = vnoise(vec2(ang * 9.0, t * 0.06)) * 0.6 + vnoise(vec2(ang * 23.0 + 4.0, t * 0.09)) * 0.4;
    beam = smoothstep(0.4, 0.9, beam) * exp(-dist * 1.1);
    vec3 fl = vec3(1.0, 0.97, 0.92) * (beam * 0.22 * uBeams + exp(-dist * 2.4) * 0.4 * uFlare);

    float hr = 0.35 + t * 0.015;
    mat2 hrot = mat2(cos(hr), -sin(hr), sin(hr), cos(hr));
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float tt = 0.32 + fi * 0.26 + 0.06 * sin(fi * 2.1 + t * 0.05);
      float r = 0.03 + 0.1 * fract(sin(fi * 12.9898 + 1.3) * 43758.5453) + 0.012 * fi;
      float hd = hexDist(hrot * (pg - (src + axis * tt)));
      float soft = fract(sin(fi * 78.233 + 2.1) * 43758.5453);  // some ghosts crisp, some just a blur
      float fill = smoothstep(r, r * (0.45 + 0.45 * soft), hd);
      float rim = smoothstep(r * 0.22, 0.0, abs(hd - r * 0.86)) * soft * soft;
      float breathe = 0.55 + 0.45 * sin(t * 0.3 + fi * 1.7);
      vec3 tint = mix(vec3(1.0, 0.95, 0.86), vec3(0.88, 0.94, 1.0), fract(fi * 0.618));
      fl += tint * (fill * 0.17 + rim * 0.06) * breathe * uFlare;
    }
    col = 1.0 - (1.0 - col) * (1.0 - clamp(fl, 0.0, 1.0));
  }

  // ── paper tooth (static) + film grain (stepped at ~12fps)
  float fibre = vnoise(frag * 0.85) * 0.55 + vnoise(frag * vec2(0.09, 0.7)) * 0.45;
  col *= 1.0 + (fibre - 0.5) * 0.045 * uGrain;
  float film = hash12(frag + floor(t * 12.0) * 37.0) - 0.5;
  col += film * 0.032 * uGrain;

  outColor = vec4(col, 1.0);
}`;

export { buildTree, VERT, FRAG };
