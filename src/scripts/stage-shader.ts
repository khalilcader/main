/*
  Stage shader: a soft, grainy, dreamy wash behind preview content.
  Borrows the noise, grain, rays and gradient from the tree-shadow shader's
  "Daylight" look, swaps the tree for a vibrant base colour with two accents
  drifting through it, and draws
  its own feathered, slightly rippling edge so the container has no hard border.

  Colours come from CSS tokens (--vibe-<name>-1..3, --vibe-paper). The numbers in
  VIBES shape the motion and light per preview; colours are never set here.
*/

export interface Vibe {
  warp: number;   // how much the colour fields swirl
  scale: number;  // size of the accent clouds (bigger = broader)
  speed: number;  // drift speed
  angle: number;  // degrees; direction light rakes across
  rays: number;   // soft streaks of light, 0..1
  wash: number;   // pull toward the page colour, 0..1 (higher = softer)
}

export const VIBES: Record<string, Vibe> = {
  sky:   { warp: 0.55, scale: 1.0, speed: 0.6,  angle: 20,  rays: 0.5, wash: 0.04 },
  ember: { warp: 0.6,  scale: 1.1, speed: 0.55, angle: 10,  rays: 0.6, wash: 0.06 },
  bloom: { warp: 0.8,  scale: 0.8, speed: 0.7,  angle: -30, rays: 0.3, wash: 0.08 },
  grove: { warp: 0.4,  scale: 1.3, speed: 0.5,  angle: 60,  rays: 0.7, wash: 0.06 },
  dusk:  { warp: 0.9,  scale: 0.9, speed: 0.45, angle: -10, rays: 0.4, wash: 0.04 },
  tide:  { warp: 0.7,  scale: 1.2, speed: 0.65, angle: 40,  rays: 0.5, wash: 0.06 },
};

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uDpr;
uniform vec3  uPaper;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform float uWarp;
uniform float uScale;
uniform float uAngle;
uniform float uRays;
uniform float uWash;
uniform float uFeather;  // edge softness, CSS px
uniform float uRadius;   // corner radius, CSS px
uniform float uRipple;   // edge ripple amount, CSS px
out vec4 outColor;

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

  // ── colour: the vibe's base colour, with its two accents drifting
  // through it as soft, domain-warped clouds
  vec2 q = p / uScale;
  vec2 w = vec2(fbm(q * 1.4 + vec2(t * 0.05, 0.0)), fbm(q * 1.4 + vec2(5.2, -t * 0.04))) - 0.5;
  q += w * uWarp;
  float f2 = smoothstep(0.38, 0.78, fbm(q * 1.3 + vec2(t * 0.03, 1.7)));
  float f3 = smoothstep(0.42, 0.82, fbm(q * 1.7 + vec2(4.1, -t * 0.025)));
  vec3 col = uC1;
  col = mix(col, uC2, f2 * 0.55);
  col = mix(col, uC3, f3 * 0.45);
  col = mix(col, uPaper, uWash);

  // ── daylight: bright on the side the light comes from, dimmer away from it
  float a = radians(uAngle);
  vec2 gDir = vec2(cos(a + 0.3), sin(a + 0.3));
  float ramp = smoothstep(-0.5, 0.7, dot(p, gDir) + 0.12 * (vnoise(p * 1.1 + 3.0) - 0.5));
  col *= 1.0 - 0.1 * ramp;
  col = mix(col, vec3(1.0), 0.12 * (1.0 - ramp));

  // ── rays: soft flecks of light stretched along the light direction
  vec2 rd = vec2(cos(a), sin(a));
  vec2 rp = vec2(dot(p, rd), dot(p, vec2(-rd.y, rd.x)));
  float r1 = vnoise(vec2(rp.x * 1.1 - t * 0.035, rp.y * 7.0 + 2.0));
  float r2 = vnoise(vec2(rp.x * 3.4 + t * 0.05, rp.y * 24.0 - 4.0));
  float r3 = vnoise(vec2(rp.x * 0.6 + t * 0.02, rp.y * 2.6 + 9.0));
  float band = smoothstep(0.5, 0.85, r1);
  float dash = smoothstep(0.56, 0.8, r2 * 0.75 + r1 * 0.25);
  float fleck = max(band * 0.55, dash) * smoothstep(0.2, 0.65, r3);
  col = mix(col, vec3(1.0), uRays * fleck * (0.2 + 0.8 * (1.0 - ramp)) * 0.3);

  // ── paper tooth (static) + film grain (stepped at ~12fps)
  float fibre = vnoise(frag * 0.85) * 0.55 + vnoise(frag * vec2(0.09, 0.7)) * 0.45;
  col *= 1.0 + (fibre - 0.5) * 0.05;
  col += (hash12(frag + floor(t * 12.0) * 37.0) - 0.5) * 0.07;  // Figma stage is visibly grainy

  outColor = vec4(col * alpha, alpha);  // premultiplied
}`;

type Params = Vibe & { c1: number[]; c2: number[]; c3: number[] };
const NUM_KEYS = ['warp', 'scale', 'speed', 'angle', 'rays', 'wash'] as const;

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

export function createStage(canvas: HTMLCanvasElement, opts: StageOptions) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => hexToRgb(css.getPropertyValue(name) || '#ffffff');
  const paper = token('--vibe-paper');
  const paramsFor = (name: string): Params => ({
    ...(VIBES[name] ?? VIBES.sky),
    c1: token(`--vibe-${name}-1`),
    c2: token(`--vibe-${name}-2`),
    c3: token(`--vibe-${name}-3`),
  });

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
    c1: u('uC1'), c2: u('uC2'), c3: u('uC3'),
    warp: u('uWarp'), scale: u('uScale'), angle: u('uAngle'), rays: u('uRays'), wash: u('uWash'),
    feather: u('uFeather'), radius: u('uRadius'), ripple: u('uRipple'),
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let cur = paramsFor('sky');
  let target = cur;
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

  const draw = () => {
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.dpr, dpr);
    gl.uniform3fv(U.paper, paper);
    gl.uniform3fv(U.c1, cur.c1);
    gl.uniform3fv(U.c2, cur.c2);
    gl.uniform3fv(U.c3, cur.c3);
    gl.uniform1f(U.warp, cur.warp);
    gl.uniform1f(U.scale, cur.scale);
    gl.uniform1f(U.angle, cur.angle);
    gl.uniform1f(U.rays, cur.rays);
    gl.uniform1f(U.wash, cur.wash);
    gl.uniform1f(U.feather, opts.feather);
    gl.uniform1f(U.radius, opts.radius);
    gl.uniform1f(U.ripple, reduced.matches ? 0 : opts.ripple);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // Ease every parameter toward the target; colours blend in sRGB, which is
  // fine at these washed-out levels.
  const step = (dt: number) => {
    const k = 1 - Math.exp(-dt * 4);
    const mix = (a: number, b: number) => a + (b - a) * k;
    const next = { ...cur } as Params;
    for (const key of NUM_KEYS) next[key] = mix(cur[key], target[key]);
    next.c1 = cur.c1.map((v, i) => mix(v, target.c1[i]));
    next.c2 = cur.c2.map((v, i) => mix(v, target.c2[i]));
    next.c3 = cur.c3.map((v, i) => mix(v, target.c3[i]));
    cur = next;
    return Math.abs(cur.wash - target.wash) + Math.abs(cur.c1[0] - target.c1[0]) + Math.abs(cur.c2[1] - target.c2[1]) > 1e-3;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const moving = step(dt);
    if (!reduced.matches) time += dt * cur.speed;
    draw();
    // Under reduced motion, stop once the transition has settled.
    raf = visible && (moving || !reduced.matches) ? requestAnimationFrame(frame) : 0;
  };
  const start = () => {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && !document.hidden;
    if (visible) start();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start();
  });

  resize();
  start();

  return {
    setVibe(name: string) {
      target = paramsFor(name);
      start();
    },
  };
}
