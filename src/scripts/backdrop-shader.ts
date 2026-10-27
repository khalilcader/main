// Cover shaders behind a cover's media (cover.shader in the content):
//   backdrop  a vivid, mottled studio-backdrop texture, like a painted cloth
//             shot on film: three tones drift in very slow, soft waves, under
//             film grain and a faint paper tooth.
//   gradient  a calm, soft gradient: three colours pool and drift very
//             slowly, their edges bent into broad, gentle folds, under a
//             fine, faintly flickering grain.
// Each takes three colours from tokens.css (--color-<kind>-deep, -base,
// -light, with dark-mode values); data-palette="cool", "violet", "blue", "rose", "stone", "indigo", "cobalt", "orchid" or "lemon" switches
// the gradient to --color-gradient-<palette>-*.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;   // device pixels per CSS pixel at the cover's full size
uniform vec3 uDeep;
uniform vec3 uBase;
uniform vec3 uLight;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p = (frag - 0.5 * uRes) / uRes.y * 1.6;
  float t = uTime;

  // Soft folds of the backdrop: domain-warped noise that drifts very slowly.
  vec2 q = vec2(fbm(p * 0.9 + vec2(0.0, t * 0.03)), fbm(p * 0.9 + vec2(5.2, 1.3) - t * 0.025));
  float folds = fbm(p * 1.3 + q * 1.6 + vec2(t * 0.02, 0.0));
  // Long waves of colour rolling across, bent by the folds.
  float wave = 0.5 + 0.5 * sin(dot(p, vec2(0.9, 1.4)) * 1.6 + folds * 3.5 + t * 0.12);
  // Stretch the contrast so the moving light and dark patches carry the
  // texture, rather than the still grain on top.
  float tone = clamp((mix(folds, wave, 0.45) - 0.5) * 1.9 + 0.55, 0.0, 1.0);

  // Lit like a studio backdrop: brighter up top, falling off to one corner.
  float light = 1.0 - 0.35 * smoothstep(0.15, 1.15, length(uv - vec2(0.3, 0.85)));
  tone *= light;

  vec3 col = tone < 0.5 ? mix(uDeep, uBase, tone * 2.0) : mix(uBase, uLight, (tone - 0.5) * 2.0);

  // Texture in CSS pixels so it reads the same at any resolution: blotchy
  // mottling, a faint paper tooth, then film grain (mostly still, with a
  // whisper of movement).
  vec2 c = frag / uScale;
  vec2 drift = vec2(t * 2.0, t * -1.2);   // the mottling drifts too, in CSS px
  float mottle = vnoise((c + drift) * 0.035) * 0.6 + vnoise((c - drift) * 0.11) * 0.4;
  col *= 1.0 + (mottle - 0.5) * 0.10;
  float tooth = vnoise(c * 0.9) * 0.55 + vnoise(c * vec2(0.1, 0.75)) * 0.45;
  col *= 1.0 + (tooth - 0.5) * 0.05;
  float grain = hash12(floor(c * 1.2)) - 0.5;
  float flicker = hash12(floor(c * 1.2) + floor(t * 3.2) * 37.0) - 0.5;  // ~8 changes a second at SPEED 2.5
  col += grain * 0.075 + flicker * 0.02;

  gl_FragColor = vec4(col, 1.0);
}`;

const GRADIENT_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec3 uDeep;
uniform vec3 uBase;
uniform vec3 uLight;
uniform float uAngle;   // radians: turns the whole gradient, so covers don't all glow from the bottom

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.02 + 11.7; a *= 0.5; }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float ar = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * ar, uv.y);
  vec2 ctr = vec2(ar * 0.5, 0.5);
  float sa = sin(uAngle), ca = cos(uAngle);
  p = ctr + mat2(ca, -sa, sa, ca) * (p - ctr);
  float t = uTime * 1.6;   // its own pace: a little livelier than the backdrop's

  // Broad, gentle folds: the colour fields are bent by large, slow noise, so
  // their edges flow instead of reading as round pools (no fine curls).
  vec2 q = vec2(fbm(p * 0.7 + vec2(0.0, t * 0.015)), fbm(p * 0.7 + vec2(4.1, 2.3) - t * 0.012));
  vec2 w = p + (q - 0.5) * 0.45;

  vec2 c1 = vec2(ar * (0.22 + 0.16 * sin(t * 0.040)), 0.78 + 0.12 * cos(t * 0.032));
  vec2 c2 = vec2(ar * (0.78 + 0.14 * cos(t * 0.036 + 1.7)), 0.50 + 0.18 * sin(t * 0.028 + 0.6));
  vec2 c3 = vec2(ar * (0.42 + 0.18 * sin(t * 0.024 + 3.1)), 0.14 + 0.12 * cos(t * 0.040 + 2.2));
  float w1 = exp(-dot(w - c1, w - c1) * 4.0);
  float w2 = exp(-dot(w - c2, w - c2) * 4.0);
  float w3 = exp(-dot(w - c3, w - c3) * 4.0);
  vec3 col = (uDeep * w1 + uBase * w2 + uLight * w3 + uBase * 0.08) / (w1 + w2 + w3 + 0.08);

  // Soft light: two or three broad, glowing bands, bent by the folds,
  // sweeping slowly across, with a gentle dip between them. This is what
  // carries the motion; the shades alone are too close to see move.
  vec2 dir = normalize(vec2(0.55, 1.0));
  float band = 0.5 + 0.5 * sin(dot(w, dir) * 8.0 - t * 0.22 + (q.x - 0.5) * 4.0);
  band = smoothstep(0.2, 1.0, band);
  float dark = 1.0 - dot(col, vec3(0.3, 0.59, 0.11));   // dark colours need more lift to show it
  col = col * (0.97 + 0.06 * band) + (uLight + 0.1) * 0.08 * band * dark * dark;

  // Fine grain, in CSS pixels: mostly still, with a faint film flicker
  // (stepped about 8 times a second) while it plays.
  vec2 c = frag / uScale;
  float grain = hash12(floor(c * 1.2)) - 0.5;
  float flicker = hash12(floor(c * 1.2) + floor(uTime * 3.2) * 37.0) - 0.5;
  col += grain * 0.03 + flicker * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

const MAX_DPR = 1;    // soft gradients don't need more; a dozen of these at
                      // 1.5x ran the GPU short of memory and tiles went blank
const FPS = 30;       // the motion is slow, so 30fps is plenty
const SPEED = 2.5;    // how fast the folds and colour waves drift

// Any CSS colour → [0..1, 0..1, 0..1]
const probe = document.createElement('canvas').getContext('2d')!;
function rgb(css: string): number[] {
  probe.fillStyle = '#000';
  probe.fillStyle = css.trim() || '#000';
  const hex = probe.fillStyle as string;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

// One WebGL context for every cover. A dozen covers each with their own
// context, under glass (backdrop filters), made the GPU drop and redraw
// layers: covers flickered whenever another one changed. Each cover is a
// plain 2D canvas; the shared context renders a frame and it is copied in.
let shared: null | { canvas: HTMLCanvasElement; gl: WebGLRenderingContext; progs: Record<string, { prog: WebGLProgram; U: Record<string, WebGLUniformLocation | null> }> } = null;
function getShared() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
    return sh;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const progs: NonNullable<typeof shared>['progs'] = {};
  for (const [kind, frag] of [['backdrop', FRAG], ['gradient', GRADIENT_FRAG]] as const) {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    const U = Object.fromEntries(['uRes', 'uTime', 'uScale', 'uDeep', 'uBase', 'uLight', 'uAngle']
      .map((n) => [n, gl.getUniformLocation(prog, n)]));
    progs[kind] = { prog, U };
  }
  return (shared = { canvas, gl, progs });
}

export function mountBackdrop(canvas: HTMLCanvasElement) {
  const sh = getShared();
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!sh || !ctx) return null;  // no WebGL: the canvas's CSS background (the base tone) shows instead
  const { gl } = sh;
  const kind = canvas.dataset.shader === 'gradient' ? 'gradient' : 'backdrop';
  const palette = canvas.dataset.palette;
  const tokens = kind === 'gradient' && palette && palette !== 'warm' ? `gradient-${palette}` : kind;
  const { prog, U } = sh.progs[kind];
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const angle = (parseFloat(canvas.dataset.angle || '0') || 0) * Math.PI / 180;
  let colors = { deep: [0, 0, 0], base: [0, 0, 0], light: [0, 0, 0] };

  let running = false, raf = 0, time = 40, last = 0, lastDraw = 0;
  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // offsetWidth ignores transforms: the canvas renders at the cover's full size.
    const w = Math.max(1, Math.round(canvas.offsetWidth * dpr));
    const h = Math.max(1, Math.round(canvas.offsetHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const sc = sh.canvas;
    if (sc.width < w || sc.height < h) { sc.width = Math.max(sc.width, w); sc.height = Math.max(sc.height, h); }
    gl.useProgram(prog);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uScale, dpr);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uAngle, angle);
    gl.uniform3fv(U.uDeep, colors.deep);
    gl.uniform3fv(U.uBase, colors.base);
    gl.uniform3fv(U.uLight, colors.light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // The viewport sits at the bottom left of the shared canvas (GL's origin).
    ctx.drawImage(sc, 0, sc.height - h, w, h, 0, 0, w, h);
  };
  const applyColors = () => {
    const cs = getComputedStyle(canvas);
    colors = {
      deep: rgb(cs.getPropertyValue(`--color-${tokens}-deep`)),
      base: rgb(cs.getPropertyValue(`--color-${tokens}-base`)),
      light: rgb(cs.getPropertyValue(`--color-${tokens}-light`)),
    };
    if (!running) draw();
  };
  const frame = (now: number) => {
    time += Math.min(0.1, (now - last) / 1000) * SPEED;
    last = now;
    if (now - lastDraw >= 1000 / FPS - 1) { lastDraw = now; draw(); }
    if (running) raf = requestAnimationFrame(frame);
  };
  const setRunning = (on: boolean) => {
    if (on === running) return;
    running = on;
    cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };

  // Reduced motion, and Safari (html.safari, work-strip.ts), which drops
  // frames copying a moving gradient in: one still frame. Otherwise animate
  // only while on screen.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('safari');
  applyColors();
  new ResizeObserver(() => { if (!running) draw(); }).observe(canvas);
  // Runs while on screen and not paused by the page (e.g. while blurred).
  let visible = false, paused = false;
  const update = () => setRunning(visible && !paused && !still);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }).observe(canvas);
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyColors);
  return { setPaused(p: boolean) { if (p !== paused) { paused = p; update(); } } };
}
