// A 3D iPhone 18 Pro, built to Apple's dimensional drawing for it ("iPhone 18
// Pro Dimensional Drawings", Accessory Design Guidelines, 2026-09-09). Units
// are millimetres; the origin is the middle of the phone, +y up (the top of
// the phone), +z out of the display. Every number below is from the drawing
// unless its comment says otherwise.
import * as THREE from 'three';

// --- The drawing --------------------------------------------------------------
const L = 150.01;           // product length
const W = 71.85;            // product width
const T = 8.75;             // product thickness
const HT = T / 2;           // 4.375
// Body outline corner (detail A, all four corners): the curve leaves each edge
// 19.43 from the corner and passes through these points, measured from the
// corner along the two edges.
const CORNER: [number, number][] = [
  [19.43, 0], [13.90, 0.04], [8.46, 0.92], [3.80, 3.80], [0.92, 8.46], [0.04, 13.90], [0, 19.43],
];
// Side profile (detail B, all sides): inset from the outline at each height z.
// Front: the aluminium band rounds over to the cover glass, which starts 1.20 in
// (glass 69.45 wide) and turns flat 2.61 in. Back: the band rounds under to the
// back glass, flat from 3.79 in.
const BAND: [number, number][] = [   // [inset, z]
  [2.35, -HT], [0.97, -4.35], [0.17, -4.01], [0.02, -3.40], [0, -2.86],
  [0, 2.99], [0.03, 3.80], [0.15, 4.24], [0.60, 4.29], [1.20, 4.30],
];
const GLASS: [number, number][] = [[1.20, 4.30], [1.60, 4.345], [2.10, 4.368], [2.61, HT]];
const BACK_FLAT = 3.79;
// Display active area 66.57 x 144.73, centred (2.64 in from the housing all round).
const DISPLAY_W = 66.57, DISPLAY_H = 144.73;
// Display corner radius: not on the drawing; iOS draws this screen's corners at
// 62 pt of its 402 pt width, which is 10.27 mm of 66.57.
const DISPLAY_R = 66.57 * 62 / 402;
// Dynamic Island: centred 7.99 below the top, 6.07 tall (front camera keepout,
// detail M). Its width is iOS's, 126 pt of 402.
const ISLAND = { y: 7.99, h: 6.07, w: 66.57 * 126 / 402 };
// Buttons: [centre from the top, length, width across the band, side].
const BUTTONS = [
  { name: 'action', y: 34.28, len: 6.90, w: 2.66, side: -1 },
  { name: 'volume-up', y: 48.43, len: 11.20, w: 2.66, side: -1 },
  { name: 'volume-down', y: 62.63, len: 11.20, w: 2.66, side: -1 },
  { name: 'side', y: 55.53, len: 17.70, w: 2.66, side: 1 },
];
const CAMERA_CONTROL = { y: 98.40, len: 17.10, w: 3.03 };   // flush sapphire, right side
const SIM = { y: 111.97, len: 19.44, w: 2.56 };             // left side, a seam
// Back: the camera plateau runs the full width from the top down to 58.01, raised
// 2.78 off the back glass; its lower corners R 12.00. Rear camera glass stands
// 2.11 above it. Lenses 3x dia 16.58; flash and sensor dia 6.90; mic dia 1.15.
// Positions are from the top and from the edge nearest the lenses (seen from behind).
const PLATEAU = { bottom: 58.01, rise: 2.78, r: 12.0, inset: 1.2 };
const LENS_RISE = 2.11;
const LENSES = [[14.37, 14.37], [14.37, 33.61], [32.49, 23.99]];
const LENS_D = 16.58;
const FLASH = [58.03, 13.82], SENSOR = [58.03, 34.16], MIC = [58.03, 23.99];
// The dark glass camera island on the plateau: drawn but not dimensioned; read
// off detail D at its scale.
const ISLAND_BACK = { left: 4.7, right: 4.4, top: 4.9, bottom: 46.3, r: 8.5 };
// Bottom edge (detail C): USB-C 9.00 x 3.14 at the centre, 10 speaker and mic
// holes dia 1.53 and 2 screws dia 1.50, along the middle of the band.
const PORT = { w: 9.0, h: 3.14 };
const HOLES = [15.40, 17.65, 19.91, 22.16, 24.42, 47.43, 49.69, 51.94, 54.20, 56.45];
const SCREWS = [29.00, 42.85];

// --- Outline -------------------------------------------------------------------
// The body outline as a closed polygon, counter-clockwise from the top right,
// N points per corner; `inset` offsets it inward.
function cornerCurve(n: number): [number, number][] {
  const c = new THREE.CatmullRomCurve3(CORNER.map(([a, b]) => new THREE.Vector3(a, b, 0)), false, 'centripetal');
  return c.getSpacedPoints(n).map((p) => [p.x, p.y]);
}
function outline(w: number, h: number, n = 24): THREE.Vector2[] {
  const cc = cornerCurve(n);   // from (19.43, 0) on the top edge to (0, 19.43) on the side
  const hw = w / 2, hh = h / 2, pts: THREE.Vector2[] = [];
  const corner = (sx: number, sy: number, flip: boolean) => {
    const seq = flip ? [...cc].reverse() : cc;
    for (const [a, b] of seq) pts.push(new THREE.Vector2(sx * (hw - a), sy * (hh - b)));
  };
  // counter-clockwise: top-right (side to top), top-left, bottom-left, bottom-right
  corner(1, 1, true); corner(-1, 1, false); corner(-1, -1, true); corner(1, -1, false);
  return pts;
}
function offset(pts: THREE.Vector2[], d: number): THREE.Vector2[] {
  if (!d) return pts.map((p) => p.clone());
  const n = pts.length, out: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const t = new THREE.Vector2().subVectors(b, a).normalize();
    const nrm = new THREE.Vector2(t.y, -t.x);   // outward for a counter-clockwise loop
    out.push(pts[i].clone().addScaledVector(nrm, -d));
  }
  return out;
}
const BASE = outline(W, L, 28);

// A rounded rectangle (plain circular corners, or Figma-style smoothing).
function roundRect(w: number, h: number, r: number, smooth = 0, n = 16): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], hw = w / 2, hh = h / 2;
  const s = 1 + smooth;
  const corners: [number, number, number][] = [[hw, hh, 0], [-hw, hh, 90], [-hw, -hh, 180], [hw, -hh, 270]];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = (a0 + 90 * i / n) * Math.PI / 180;
      // superellipse-ish smoothing: exponent grows with `smooth`
      const e = 2 / (2 + smooth * 1.6);
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = Math.sign(ca) * Math.abs(ca) ** e, y = Math.sign(sa) * Math.abs(sa) ** e;
      pts.push(new THREE.Vector2(cx - Math.sign(cx) * r * s + x * r * s, cy - Math.sign(cy) * r * s + y * r * s));
    }
  }
  return pts;
}

// --- Geometry builders ---------------------------------------------------------
// A ring surface swept through a list of [inset, z] stations around an outline.
function sweep(base: THREE.Vector2[], stations: [number, number][], subdiv = 3): THREE.BufferGeometry {
  // densify the stations with a smooth curve
  const curve = new THREE.CatmullRomCurve3(stations.map(([i, z]) => new THREE.Vector3(i, z, 0)), false, 'centripetal');
  const st = curve.getPoints((stations.length - 1) * subdiv).map((p) => [p.x, p.y] as [number, number]);
  const rings = st.map(([i, z]) => offset(base, i).map((p) => new THREE.Vector3(p.x, p.y, z)));
  const n = base.length, pos: number[] = [], idx: number[] = [];
  rings.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)));
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + i, d = (k + 1) * n + (i + 1) % n;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function flat(pts: THREE.Vector2[], z: number, facing: 1 | -1): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
  g.translate(0, 0, z);
  if (facing < 0) { g.scale(1, 1, -1); g.translate(0, 0, 2 * z); const ix = g.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i); ix.setX(i, ix.getX(i + 2)); ix.setX(i + 2, a); } g.computeVertexNormals(); }   // face -z, keep x
  // ShapeGeometry's UVs are in shape units; map them 0..1 over the shape's bounds
  g.computeBoundingBox();
  const bb = g.boundingBox!, uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  return g;
}
function extrude(pts: THREE.Vector2[], depth: number, bevel = 0, segs = 4): THREE.BufferGeometry {
  return new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 24,
  }).translate(0, 0, bevel);
}
const capsule = (len: number, w: number) => roundRect(w, len, w / 2 - 0.001, 0, 12);

// --- Materials ----------------------------------------------------------------
export interface Finish { name: string; metal: string; back: string }
// Apple's four finishes (Apple Newsroom, Sept 9 2026: Deep Black, Silver,
// Glacier Blue, Burgundy). Apple gives no colour values: these are the
// anodised aluminium (metal) and matching Ceramic Shield back, read from
// Apple's product photography.
export const FINISHES: Record<string, Finish> = {
  black: { name: 'Deep Black', metal: '#2a2b2e', back: '#222326' },
  silver: { name: 'Silver', metal: '#d9dadc', back: '#e3e4e6' },
  glacier: { name: 'Glacier Blue', metal: '#a9bccd', back: '#b8c8d6' },
  burgundy: { name: 'Burgundy', metal: '#4e1a22', back: '#4a1b23' },
};

export interface Phone { group: THREE.Group; screen: THREE.Mesh; setScreen(tex: THREE.Texture | null): void; setFinish(f: keyof typeof FINISHES): void }

export function buildIPhone18Pro(finish: keyof typeof FINISHES = 'black'): Phone {
  const group = new THREE.Group(); group.name = 'iPhone 18 Pro';
  const metal = new THREE.MeshPhysicalMaterial({ color: FINISHES[finish].metal, metalness: 1, roughness: 0.28, clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1.1 });   // bead-blasted aluminium: soft, broad highlights
  const backGlass = new THREE.MeshPhysicalMaterial({ color: FINISHES[finish].back, metalness: 0, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.5 });
  const frontGlass = new THREE.MeshPhysicalMaterial({ color: '#050506', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
  const black = new THREE.MeshBasicMaterial({ color: '#000' });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: '#0b0d14', metalness: 0.2, roughness: 0.05, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.4 });
  const darkGlass = new THREE.MeshPhysicalMaterial({ color: '#16171b', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  const hole = new THREE.MeshBasicMaterial({ color: '#000' });
  for (const m of [metal, backGlass, frontGlass, black, lensGlass, darkGlass, hole]) m.side = THREE.DoubleSide;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string) => { const o = new THREE.Mesh(g, m); o.name = name; group.add(o); return o; };

  // Band (aluminium unibody sides) and back.
  add(sweep(BASE, BAND), metal, 'band');
  add(flat(offset(BASE, BACK_FLAT), -HT, -1), backGlass, 'back');
  add(sweep(BASE, [[BACK_FLAT, -HT], [2.35, -HT]], 1), backGlass, 'back-edge');
  // Front cover glass: its rounded edge, then the flat.
  add(sweep(BASE, GLASS), frontGlass, 'cover-glass-edge');
  add(flat(offset(BASE, 2.61), HT, 1), frontGlass, 'cover-glass');

  // Display: a rounded rectangle just under the glass's surface, the screen texture on it.
  const screenMat = new THREE.MeshBasicMaterial({ color: '#000', toneMapped: false });
  const screen = add(flat(roundRect(DISPLAY_W, DISPLAY_H, DISPLAY_R, 0.6, 20), HT + 0.02, 1), screenMat, 'screen') as THREE.Mesh;
  // The cover glass's reflection over the screen, drawn additively so it only
  // ever adds light: each point reflects the view direction about the glass's
  // normal (in world space, so it moves as the phone turns) and picks up a large
  // softbox fixed above-left of the scene and a long strip light to the right,
  // with Fresnel making the glass brighter toward grazing angles.
  const glare = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {
      uKey: { value: new THREE.Vector3(-0.30, 0.36, 0.88).normalize() },
      uStrip: { value: new THREE.Vector3(0.47, 0.0, 0.88).normalize() },
      uStrength: { value: 1 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vP;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uKey; uniform vec3 uStrip; uniform float uStrength; varying vec3 vN; varying vec3 vP;
      void main() {
        vec3 V = normalize(cameraPosition - vP); vec3 N = normalize(vN);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        vec3 R = reflect(-V, N);
        float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        // softbox: a soft-edged patch around its direction; strip: long vertically
        float key = smoothstep(0.978, 0.996, dot(R, uKey));
        float broad = smoothstep(0.55, 1.0, dot(R, uKey));
        vec3 s = R - uStrip * dot(R, uStrip);
        float strip = smoothstep(0.93, 0.985, dot(R, uStrip)) + 0.0 * s.x;
        float stripLong = smoothstep(0.988, 0.998, dot(normalize(vec3(R.x, 0.0, R.z)), normalize(vec3(uStrip.x, 0.0, uStrip.z)))) * smoothstep(0.6, 0.25, abs(R.y));
        float l = (key * 0.42 + stripLong * 0.30 + broad * 0.025) * (0.6 + fres * 2.0) + fres * 0.10;
        gl_FragColor = vec4(vec3(l * uStrength), 1.0);
      }`,
  });
  add(flat(offset(BASE, 2.61), HT + 0.06, 1), glare, 'cover-glass-reflection').renderOrder = 2;
  // Dynamic Island, over the screen.
  const isl = add(flat(roundRect(ISLAND.w, ISLAND.h, ISLAND.h / 2 - 0.001, 0, 16), HT + 0.04, 1), black, 'dynamic-island');
  isl.position.y = L / 2 - ISLAND.y;

  // Buttons.
  for (const b of BUTTONS) {
    const g = extrude(capsule(b.len, b.w), 0.55, 0.2);
    g.rotateY(b.side * Math.PI / 2);
    const m = add(g, metal, `button-${b.name}`);
    m.position.set(b.side * (W / 2 - 0.1), L / 2 - b.y, 0);
  }
  const cc = extrude(capsule(CAMERA_CONTROL.len, CAMERA_CONTROL.w), 0.12, 0.05);
  cc.rotateY(Math.PI / 2);
  add(cc, darkGlass, 'camera-control').position.set(W / 2 - 0.08, L / 2 - CAMERA_CONTROL.y, 0);
  const sim = flat(capsule(SIM.len, SIM.w), 0, 1); sim.rotateY(-Math.PI / 2);
  add(sim, hole, 'sim-seam').position.set(-W / 2 - 0.01, L / 2 - SIM.y, 0);

  // Camera plateau: full width, top of the back down to 58.01.
  const ph = PLATEAU.bottom - PLATEAU.inset;
  const plat = roundRect(W - 2 * PLATEAU.inset, ph, PLATEAU.r, 0.6, 20);
  const pg = extrude(plat, PLATEAU.rise + 0.2, 0.9);
  pg.rotateY(Math.PI); pg.translate(0, L / 2 - PLATEAU.inset - ph / 2, -HT + 0.2);
  add(pg, metal, 'camera-plateau');
  const zp0 = -HT - PLATEAU.rise;   // the plateau's outer face
  const zp = zp0 - 0.45;            // the island step on it, where the lenses and flash sit
  // Back-view x (from the edge nearest the lenses) -> model x: seen from the front, that edge is +x.
  const bx = (x: number) => W / 2 - x, by = (y: number) => L / 2 - y;
  const iw = W - ISLAND_BACK.left - ISLAND_BACK.right, ih = ISLAND_BACK.bottom - ISLAND_BACK.top;
  const ig = flat(roundRect(iw, ih, ISLAND_BACK.r, 0.6, 16), 0, -1);
  // drawn as an outline around the lenses: a low step in the aluminium (its height isn't given; 0.45)
  const ie = extrude(roundRect(iw, ih, ISLAND_BACK.r, 0.6, 16), 0.45, 0.15); ie.rotateY(Math.PI);
  add(ie, metal, 'camera-island').position.set(bx(ISLAND_BACK.left + iw / 2), by(ISLAND_BACK.top + ih / 2), zp0 + 0.05);
  // Lenses: an aluminium ring standing 2.11 proud, dark glass in it.
  LENSES.forEach(([x, y], i) => {
    const ring = new THREE.CylinderGeometry(LENS_D / 2, LENS_D / 2 + 0.3, LENS_RISE, 64, 1, false);
    ring.rotateX(Math.PI / 2);
    const r = add(ring, metal, `lens-${i + 1}-ring`); r.position.set(bx(x), by(y), zp - LENS_RISE / 2);
    const gl = new THREE.CircleGeometry(LENS_D / 2 - 1.1, 64); gl.rotateY(Math.PI);
    const g = add(gl, lensGlass, `lens-${i + 1}-glass`); g.position.set(bx(x), by(y), zp - LENS_RISE - 0.06);
    const inner = new THREE.RingGeometry(LENS_D * 0.24, LENS_D / 2 - 1.1, 64); inner.rotateY(Math.PI);
    add(inner, new THREE.MeshPhysicalMaterial({ color: '#1b1e27', metalness: 0.6, roughness: 0.25, clearcoat: 1, side: THREE.DoubleSide }), `lens-${i + 1}-barrel`).position.set(bx(x), by(y), zp - LENS_RISE - 0.09);
    const pupil = new THREE.CircleGeometry(LENS_D * 0.17, 48); pupil.rotateY(Math.PI);
    add(pupil, black, `lens-${i + 1}-aperture`).position.set(bx(x), by(y), zp - LENS_RISE - 0.12);
  });
  const dot = (d: number, at: number[], m: THREE.Material, name: string, raise = 0.05) => {
    const c = new THREE.CircleGeometry(d / 2, 40); c.rotateY(Math.PI);
    add(c, m, name).position.set(bx(at[0]), by(at[1]), zp - raise);
  };
  dot(6.9, FLASH, new THREE.MeshPhysicalMaterial({ color: '#f1ead8', roughness: 0.4, clearcoat: 1 }), 'flash');
  dot(6.9, SENSOR, darkGlass, 'lidar');
  dot(1.15, MIC, hole, 'rear-mic');

  // Bottom edge: USB-C, speaker and mic holes, screws.
  const bottom = (shape: THREE.Vector2[], x: number, name: string, m: THREE.Material = hole) => {
    const g = flat(shape, 0, 1); g.rotateX(Math.PI / 2);
    add(g, m, name).position.set(x, -L / 2 - 0.01, 0);
  };
  bottom(roundRect(PORT.w, PORT.h, PORT.h / 2 - 0.001, 0, 12), 0, 'usb-c');
  HOLES.forEach((x, i) => bottom(roundRect(1.53, 1.53, 0.764, 0, 8), x - W / 2, `bottom-hole-${i + 1}`));
  SCREWS.forEach((x, i) => bottom(roundRect(1.5, 1.5, 0.749, 0, 8), x - W / 2, `screw-${i + 1}`, new THREE.MeshStandardMaterial({ color: '#8a8b8e', metalness: 1, roughness: 0.4 })));

  return {
    group, screen,
    setScreen(tex) {
      screenMat.map = tex; screenMat.color.set(tex ? '#fff' : '#000'); screenMat.needsUpdate = true;
      if (tex) { tex.colorSpace = THREE.SRGBColorSpace; }
    },
    setFinish(f) { metal.color.set(FINISHES[f].metal); backGlass.color.set(FINISHES[f].back); },
  };
}
