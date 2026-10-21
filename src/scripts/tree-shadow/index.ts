// Runs the tree shadow shader on a canvas (the About card's stand-in), from
// Khalil's Tree Shadow artifact. Colours (--color-daylight-paper, -shadow)
// and the light preset (--daylight-preset) follow the theme.
// @ts-expect-error: plain JS copied from the artifact
import { buildTree, VERT, FRAG } from './engine.js';

// Shared settings from Khalil's Tree Shadow artifact (Flip X, no falling
// leaves), plus a light preset per theme, picked by --daylight-preset:
// daylight with sun beams and a lens flare in light mode, softer beams and a
// faint flare at night. Colours come from tokens.
const SETTINGS = {
  type: 'broadleaf', seed: 12, posX: 0.5, posY: -0.6, angle: -38, rotY: 0, rotX: 0, flipX: true,
  blinds: 0, blindAngle: 0, blindSize: 1, blindSoft: 1, leaves: 0,
  wind: 1.8, speed: 1.3, distortion: 0.15,
};
type Light = { zoom: number; softness: number; blurFalloff: number; depthBlur: number; strength: number;
  gradient: number; rays: number; streak: number; rayAngle: number; flare: number; beams: number;
  vignette: number; grain: number };
const PRESETS: Record<'light' | 'dark', Light> = {
  light: { zoom: 3.2, softness: 4, blurFalloff: 1.3, depthBlur: 1.2, strength: 0.5,
    gradient: 0.12, rays: 1.6, streak: 1, rayAngle: 26, flare: 1.2, beams: 3,
    vignette: 0.25, grain: 0.6 },   // airy: barely any falloff, fine grain
  dark: { zoom: 4, softness: 6, blurFalloff: 3, depthBlur: 3, strength: 1,
    gradient: 0.29, rays: 1.1, streak: 1, rayAngle: 20, flare: 0.5, beams: 1.5,
    vignette: 0.6, grain: 1.5 },   // night: softer beams and a faint flare
};
const MAX_DPR = 1.5;   // the card is large; this keeps the shader light

const UNIFORMS = ['uTree', 'uRes', 'uTime', 'uPaper', 'uShadow', 'uStrength', 'uWind', 'uGrain',
  'uAngle', 'uZoom', 'uSoft', 'uDistort', 'uOffset', 'uCrown', 'uFrond', 'uDepth', 'uProg', 'uDepthAmt',
  'uGradient', 'uVignette', 'uRays', 'uStreak', 'uRayAngle', 'uFlare', 'uBeams', 'uFlip', 'uBlinds', 'uBlindAngle',
  'uBlindSize', 'uBlindSoft', 'uLeaves'];

// "rgb(r, g, b)" or "#rrggbb" → [0..1, 0..1, 0..1]
function parseColor(css: string): number[] {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.fillStyle = css.trim() || '#000';
  const hex = probe.fillStyle as string;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

export function mountTreeShadow(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return;  // no WebGL2: the canvas's CSS background (the paper colour) shows instead
  const S = SETTINGS;

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

  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n);

  // The tree texture is grown in a worker where possible (it takes a moment
  // and would freeze the page), else here. Until it arrives nothing is drawn
  // and the canvas's CSS background (the paper colour) shows.
  let ready = false;
  type Img = TexImageSource;
  const upload = (treeImg: Img, depthImg: Img, crown: number[] | null) => {
    ([[0, treeImg], [1, depthImg]] as const).forEach(([unit, src]) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
    });
    gl.uniform2fv(U.uCrown, crown || [0.5, 0.5]);
    gl.uniform1f(U.uFrond, crown ? 1 : 0);
    ready = true;
    draw();
  };
  const rotY = S.rotY * Math.PI / 180, rotX = S.rotX * Math.PI / 180;
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    const worker = new Worker(new URL('./tree-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { upload(e.data.tree, e.data.depth, e.data.crown); worker.terminate(); };
    worker.postMessage({ type: S.type, seed: S.seed, rotY, rotX });
  } else {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // a canvas needs flipping here; the worker's bitmaps come flipped
    const tree = buildTree(S.type, S.seed, rotY, rotX);
    upload(tree, tree.depth, tree.crown || null);
  }
  gl.uniform1i(U.uTree, 0);
  gl.uniform1i(U.uDepth, 1);

  gl.uniform1f(U.uWind, S.wind);
  gl.uniform1f(U.uAngle, S.angle * Math.PI / 180);
  gl.uniform1f(U.uFlip, S.flipX ? 1 : 0);
  gl.uniform1f(U.uBlinds, S.blinds);
  gl.uniform1f(U.uBlindAngle, S.blindAngle * Math.PI / 180);
  gl.uniform1f(U.uBlindSize, S.blindSize);
  gl.uniform1f(U.uBlindSoft, S.blindSoft);
  gl.uniform1f(U.uLeaves, S.leaves);
  gl.uniform1f(U.uDistort, S.distortion);
  gl.uniform2f(U.uOffset, S.posX * 0.6, S.posY * 0.6);

  // Colours follow the theme.
  const applyColors = () => {
    const cs = getComputedStyle(canvas);
    gl.uniform3fv(U.uPaper, parseColor(cs.getPropertyValue('--color-daylight-paper')));
    gl.uniform3fv(U.uShadow, parseColor(cs.getPropertyValue('--color-daylight-shadow')));
    // The light itself follows the theme too.
    const L = PRESETS[cs.getPropertyValue('--daylight-preset').trim() === 'dark' ? 'dark' : 'light'];
    gl.uniform1f(U.uZoom, L.zoom);
    gl.uniform1f(U.uSoft, L.softness);
    gl.uniform1f(U.uProg, L.blurFalloff);
    gl.uniform1f(U.uDepthAmt, L.depthBlur);
    gl.uniform1f(U.uStrength, L.strength);
    gl.uniform1f(U.uGradient, L.gradient);
    gl.uniform1f(U.uVignette, L.vignette);
    gl.uniform1f(U.uGrain, L.grain);
    gl.uniform1f(U.uRays, L.rays);
    gl.uniform1f(U.uStreak, L.streak);
    gl.uniform1f(U.uRayAngle, L.rayAngle * Math.PI / 180);
    gl.uniform1f(U.uFlare, L.flare);
    gl.uniform1f(U.uBeams, L.beams);
    if (!running) draw();
  };

  const resize = () => {
    // offsetWidth ignores transforms: the canvas renders at the card's full size.
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(canvas.offsetWidth * dpr));
    const h = Math.max(1, Math.round(canvas.offsetHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
  };

  // Reduced motion: one still frame. Otherwise animate only while on screen.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = 20, last = performance.now(), raf = 0, running = false, visible = false;
  function draw() {
    if (!ready) return;
    resize();
    gl!.uniform1f(U.uTime, time);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
  function frame(now: number) {
    time += Math.min(0.1, (now - last) / 1000) * S.speed;
    last = now;
    draw();
    if (running) raf = requestAnimationFrame(frame);
  }
  function setRunning(on: boolean) {
    if (on === running) return;
    running = on;
    cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  applyColors();
  draw();
  new ResizeObserver(() => { if (!running) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRunning(visible && !still); }).observe(canvas);
  new MutationObserver(applyColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyColors);
}
