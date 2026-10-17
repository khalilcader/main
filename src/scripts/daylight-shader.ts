// Daylight shader: soft light falling into a room. A gradient from a bright
// corner to shade, a glow where the light comes in (off the top left), and
// slow rays fanning down and to the right from it, under a fine grain. Colours
// come from tokens.css (--color-daylight-shade, -sky, -glow; warm daylight in
// light mode, cool moonlight in dark mode).
import { mountShader } from './backdrop-shader';

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform vec3 uShade;
uniform vec3 uSky;
uniform vec3 uGlow;

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

void main() {
  vec2 frag = gl_FragCoord.xy;
  // y up, 0..1 across the height; x scaled to keep the aspect.
  vec2 p = frag / uRes.y;
  float t = uTime;

  // The light comes in from beyond the top left edge.
  vec2 src = vec2(-0.25, 1.15);
  vec2 d = p - src;
  float dist = length(d);
  float ang = atan(d.y, d.x);   // the rays fan out down and to the right

  // Base gradient: bright near the light, falling to shade at the far corner.
  float lit = 1.0 - smoothstep(0.2, 1.6, dist);
  vec3 col = mix(uShade, uSky, lit);

  // Rays: bands across the fan's angle, each slowly brightening and fading,
  // fading out with distance. Two layers at different widths so they don't
  // read as a regular pattern.
  float r1 = vnoise(vec2(ang * 9.0, t * 0.10));
  float r2 = vnoise(vec2(ang * 23.0 + 4.0, -t * 0.07));
  float rays = smoothstep(0.35, 1.0, r1 * 0.65 + r2 * 0.35);
  rays *= smoothstep(1.9, 0.3, dist) * smoothstep(0.05, 0.45, dist);
  col = mix(col, uGlow, rays * 0.55);

  // Soft glow around where the light enters.
  float glow = exp(-dist * dist * 2.2);
  col = mix(col, uGlow, glow * 0.6);

  // Fine grain in CSS pixels, mostly still.
  vec2 c = frag / uScale;
  col += (hash12(floor(c)) - 0.5) * 0.035;

  gl_FragColor = vec4(col, 1.0);
}`;

export function mountDaylight(canvas: HTMLCanvasElement) {
  return mountShader(canvas, FRAG, {
    uShade: '--color-daylight-shade', uSky: '--color-daylight-sky', uGlow: '--color-daylight-glow',
  }, 1);
}
