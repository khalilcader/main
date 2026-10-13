/*
  Stage shader: a soft, grainy, dreamy wash behind preview content.
  Borrows the grain, light streaks and gradient from the tree-shadow shader's
  "Daylight" look. Underneath, slow liquid blobs merge and split in a warped
  flow field. The motion runs continuously; switching projects changes only
  the colours, which spread in like ink from where you pointed.

  Colours come from CSS tokens (--vibe-<name>-1..3, --vibe-paper): -1 is the
  base, -2 and -3 colour the blobs.
*/

const WAVE = 1.4;      // seconds for a new palette to spread across the stage
const MAX_LAYERS = 4;  // palettes mid-transition at once (rapid hovering)

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uDpr;
uniform vec3  uPaper;
uniform float uFeather;  // edge softness, CSS px
uniform float uRadius;   // corner radius, CSS px
uniform float uRipple;   // edge ripple amount, CSS px
// Palette layers, oldest first. Layer 0 is fully shown; each later one
// spreads over the ones below from its origin, uAge seconds into its wave.
uniform int   uCount;
uniform vec3  uPal[12];  // 3 colours per layer
uniform float uAge[4];
uniform vec2  uOrigin[4];
out vec4 outColor;

const float WAVE = ${WAVE.toFixed(2)};

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
float fbm(vec2 p) {
  return vnoise(p) * 0.6 + vnoise(p * 2.1 + 3.7) * 0.28 + vnoise(p * 4.3 + 7.1) * 0.12;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Metaballs drifting on slow Lissajous paths: where they meet they merge,
// where they part they pinch off.
float blobs(vec2 q, float t, float seed) {
  float f = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i) + seed * 4.0;
    vec2 c = vec2(0.26 * sin(t * (0.11 + 0.03 * fi) + fi * 2.1),
                  0.38 * cos(t * (0.08 + 0.025 * fi) + fi * 1.7));
    float r = 0.11 + 0.04 * sin(t * 0.2 + fi);
    vec2 d = q - c;
    f += r * r / (dot(d, d) + 1e-4);
  }
  return f;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float t = uTime;
  float s = max(uRes.x, uRes.y);
  vec2 p = (frag - 0.5 * uRes) / s;

  // ── edge: feathered rounded rect, its boundary breathing a little
  vec2 px = (frag - 0.5 * uRes) / uDpr;          // CSS px from centre
  vec2 hb = 0.5 * uRes / uDpr;
  float ang = atan(px.y, px.x);
  float rip = (vnoise(vec2(ang * 3.0, t * 0.35)) - 0.5) * 0.7
            + (vnoise(vec2(ang * 9.0 + 4.0, t * 0.6)) - 0.5) * 0.3;
  float d = sdRoundBox(px, hb - uFeather - uRipple, uRadius) + rip * uRipple * 2.0;
  float alpha = smoothstep(uFeather, -uFeather * 0.35, d);
  // stipple the feather so the edge reads noisy, not airbrushed
  alpha += (hash12(frag + floor(t * 12.0) * 13.0) - 0.5) * 0.35 * alpha * (1.0 - alpha) * 4.0;
  alpha = clamp(alpha, 0.0, 1.0);
  if (alpha <= 0.0) { outColor = vec4(0.0); return; }

  // ── shape: liquid blobs in a slowly turning flow field (palette-free,
  // so it never changes when the project does)
  vec2 q = p;
  vec2 w1 = vec2(fbm(q * 1.5 + vec2(t * 0.04, 0.0)), fbm(q * 1.5 + vec2(5.2, -t * 0.035))) - 0.5;
  vec2 w2 = vec2(fbm((q + w1) * 2.2 + vec2(1.7, t * 0.05)), fbm((q + w1) * 2.2 + vec2(8.3, 2.8))) - 0.5;
  q += w1 * 0.35 + w2 * 0.12;
  float b2 = blobs(q, t, 0.0);
  float b3 = blobs(q * vec2(1.1, 0.9) + vec2(0.05, -0.03), t * 0.9 + 20.0, 1.0);
  float f2 = smoothstep(0.7, 1.9, b2);        // soft-edged, dreamy rather than cartoon
  float f3 = smoothstep(0.8, 2.1, b3) * (1.0 - 0.5 * f2);
  float core = smoothstep(2.0, 5.0, max(b2, b3));  // glow where blobs are densest

  // ── colour: fold the palette layers, each spreading in like ink
  vec3 col = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= uCount) break;
    vec3 c = uPal[i * 3];
    c = mix(c, uPal[i * 3 + 1], f2 * 0.6);
    c = mix(c, uPal[i * 3 + 2], f3 * 0.55);
    if (i == 0) { col = c; continue; }
    float k = clamp(uAge[i] / WAVE, 0.0, 1.0);
    k = 1.0 - pow(1.0 - k, 3.0);                                // ease out
    float dist = length(p - uOrigin[i]) + (fbm(p * 3.0 + vec2(t * 0.3, float(i) * 7.0)) - 0.5) * 0.35;
    float front = k * 1.9 - 0.15;                               // reaches the far corner
    float m = smoothstep(front + 0.04, front - 0.16, dist);
    m = max(m, step(1.0, uAge[i] / WAVE));
    col = mix(col, c, m);
  }
  col = mix(col, vec3(1.0), core * 0.18);

  // ── daylight: bright on the side the light comes from, dimmer away from it
  float a = radians(20.0);
  vec2 gDir = vec2(cos(a + 0.3), sin(a + 0.3));
  float ramp = smoothstep(-0.5, 0.7, dot(p, gDir) + 0.12 * (vnoise(p * 1.1 + 3.0) - 0.5));
  col *= 1.0 - 0.1 * ramp;
  col = mix(col, vec3(1.0), 0.1 * (1.0 - ramp));

  // ── rays: soft flecks of light stretched along the light direction
  vec2 rd = vec2(cos(a), sin(a));
  vec2 rp = vec2(dot(p, rd), dot(p, vec2(-rd.y, rd.x)));
  float r1 = vnoise(vec2(rp.x * 1.1 - t * 0.035, rp.y * 7.0 + 2.0));
  float r2 = vnoise(vec2(rp.x * 3.4 + t * 0.05, rp.y * 24.0 - 4.0));
  float r3 = vnoise(vec2(rp.x * 0.6 + t * 0.02, rp.y * 2.6 + 9.0));
  float band = smoothstep(0.5, 0.85, r1);
  float dash = smoothstep(0.56, 0.8, r2 * 0.75 + r1 * 0.25);
  float fleck = max(band * 0.55, dash) * smoothstep(0.2, 0.65, r3);
  col = mix(col, vec3(1.0), 0.5 * fleck * (0.2 + 0.8 * (1.0 - ramp)) * 0.3);

  col = mix(col, uPaper, 0.04);

  // ── paper tooth (static) + film grain (stepped at ~12fps)
  float fibre = vnoise(frag * 0.85) * 0.55 + vnoise(frag * vec2(0.09, 0.7)) * 0.45;
  col *= 1.0 + (fibre - 0.5) * 0.05;
  col += (hash12(frag + floor(t * 12.0) * 37.0) - 0.5) * 0.07;  // Figma stage is visibly grainy

  outColor = vec4(col * alpha, alpha);  // premultiplied
}`;

function hexToRgb(hex: string): number[] {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export interface StageOptions {
  feather: number;
  radius: number;
  ripple: number;
}

interface Layer {
  vibe: string;
  colors: number[];        // 9 floats: base, accent, accent
  born: number;            // performance.now() in ms
  origin: [number, number];
}

export function createStage(canvas: HTMLCanvasElement, opts: StageOptions) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => hexToRgb(css.getPropertyValue(name) || '#ffffff');
  const paper = token('--vibe-paper');
  const colorsFor = (name: string) =>
    [1, 2, 3].flatMap((i) => token(`--vibe-${name}-${i}`));

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    res: u('uRes'), time: u('uTime'), dpr: u('uDpr'), paper: u('uPaper'),
    feather: u('uFeather'), radius: u('uRadius'), ripple: u('uRipple'),
    count: u('uCount'), pal: u('uPal'), age: u('uAge'), origin: u('uOrigin'),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let layers: Layer[] = [];
  let time = 7;
  let last = performance.now();
  let raf = 0;
  let visible = true;
  let dpr = 1;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  // Once a wave has covered the stage, everything under it is hidden: drop it.
  const prune = (now: number) => {
    for (let i = layers.length - 1; i > 0; i--) {
      if (now - layers[i].born >= WAVE * 1000) { layers = layers.slice(i); break; }
    }
    return layers.length > 1;  // still spreading?
  };

  const draw = (now: number) => {
    const pal = new Float32Array(MAX_LAYERS * 9);
    const age = new Float32Array(MAX_LAYERS);
    const origin = new Float32Array(MAX_LAYERS * 2);
    layers.forEach((l, i) => {
      pal.set(l.colors, i * 9);
      age[i] = (now - l.born) / 1000;
      origin.set(l.origin, i * 2);
    });
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.dpr, dpr);
    gl.uniform3fv(U.paper, paper);
    gl.uniform1f(U.feather, opts.feather);
    gl.uniform1f(U.radius, opts.radius);
    gl.uniform1f(U.ripple, reduced.matches ? 0 : opts.ripple);
    gl.uniform1i(U.count, layers.length);
    gl.uniform3fv(U.pal, pal);
    gl.uniform1fv(U.age, age);
    gl.uniform2fv(U.origin, origin);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const spreading = prune(now);
    if (!reduced.matches) time += dt;
    draw(now);
    // Under reduced motion, stop once the colour change has finished.
    raf = visible && (spreading || !reduced.matches) ? requestAnimationFrame(frame) : 0;
  };
  const start = () => {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  new ResizeObserver(() => { resize(); draw(performance.now()); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    if (visible) start();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start();
  });

  resize();

  return {
    /**
     * Switch to a vibe's colours. `from` is the viewport point (client px)
     * the new colour spreads out from; defaults to the stage's centre.
     */
    setVibe(name: string, from?: { x: number; y: number }) {
      if (layers.at(-1)?.vibe === name) return;
      const now = performance.now();
      const r = canvas.getBoundingClientRect();
      const s = Math.max(r.width, r.height) || 1;
      const x = from ? from.x : r.left + r.width / 2;
      const y = from ? from.y : r.top + r.height / 2;
      // Same space as the shader's p: centred, y up, scaled by the long side.
      const origin: [number, number] = [(x - r.left - r.width / 2) / s, (r.top + r.height / 2 - y) / s];
      const first = layers.length === 0;
      // Reduced motion, or the very first paint: no spreading, just show it.
      const born = first || reduced.matches ? now - WAVE * 1000 : now;
      layers.push({ vibe: name, colors: colorsFor(name), born, origin });
      // Very fast hovering: fold the oldest pending wave down so we stay in budget.
      while (layers.length > MAX_LAYERS) {
        layers.shift();
        layers[0].born = now - WAVE * 1000;
      }
      prune(now);
      start();
    },
  };
}
