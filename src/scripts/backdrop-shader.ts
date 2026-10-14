// Backdrop shader: a vivid, mottled studio-backdrop texture behind a cover's
// media, like a painted cloth shot on film. Three tones from tokens.css
// (--color-backdrop-deep, -base, -light, with dark-mode values) drift in very
// slow, soft waves, under film grain and a faint paper tooth.

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

const MAX_DPR = 1.5;  // the cover is large; this keeps the shader light
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

export function mountBackdrop(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;  // no WebGL: the canvas's CSS background (the base tone) shows instead

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uTime', 'uScale', 'uDeep', 'uBase', 'uLight']
    .map((n) => [n, gl.getUniformLocation(prog, n)]));

  let running = false, raf = 0, time = 40, last = 0, lastDraw = 0;
  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    // offsetWidth ignores transforms: the canvas renders at the cover's full size.
    const w = Math.max(1, Math.round(canvas.offsetWidth * dpr));
    const h = Math.max(1, Math.round(canvas.offsetHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uScale, dpr);
    gl.uniform1f(U.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const applyColors = () => {
    const cs = getComputedStyle(canvas);
    gl.uniform3fv(U.uDeep, rgb(cs.getPropertyValue('--color-backdrop-deep')));
    gl.uniform3fv(U.uBase, rgb(cs.getPropertyValue('--color-backdrop-base')));
    gl.uniform3fv(U.uLight, rgb(cs.getPropertyValue('--color-backdrop-light')));
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

  // Reduced motion: one still frame. Otherwise animate only while on screen.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  applyColors();
  new ResizeObserver(() => { if (!running) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => setRunning(e.isIntersecting && !still)).observe(canvas);
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyColors);
}
