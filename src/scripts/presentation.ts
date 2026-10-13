/*
  How a project shows up on the stage (and in its hover thumbnail).

  frame:  'phone'  — the Figma phone mock (fixed aspect)
          'window' — a Mac-style window; aspect = whole window, width / height
          'media'  — a bare image or video with rounded corners
  crop:   optional viewport onto the framed content, to focus on part of it.
          aspect = the viewport's width / height; zoom = how much bigger than
          the viewport the framed content is (1 = just fits its width);
          focus = the point of the content to keep in view, 0..1 from the
          top-left ([0.5, 0] = top centre).
*/
export interface Presentation {
  frame: 'phone' | 'window' | 'media';
  aspect?: number;
  src?: string;
  alt?: string;
  crop?: { aspect: number; zoom: number; focus?: [number, number] };
}

export const PHONE_ASPECT = 390 / 816;  // Figma device frame

/** Width / height of the framed content, before any crop. */
export function frameAspect(p: Presentation) {
  if (p.frame === 'phone') return PHONE_ASPECT;
  return p.aspect ?? (p.frame === 'window' ? 16 / 10 : 16 / 9);
}

/** Width / height of what sits on the stage. */
export function subjectAspect(p: Presentation) {
  return p.crop?.aspect ?? frameAspect(p);
}

/**
 * Hover-thumbnail shape. Follows what's on stage, except a whole phone,
 * which would be a sliver at thumbnail size: that gets 3:4.
 */
export function thumbAspect(p: Presentation) {
  if (p.frame === 'phone' && !p.crop) return 3 / 4;
  return subjectAspect(p);
}

/**
 * Where to put the framed content inside a crop viewport, as CSS
 * percentages of the viewport: it's `zoom` × the viewport's width, and
 * the focus point lands on the same relative point of the viewport.
 */
export function cropPlacement(p: Presentation) {
  if (!p.crop) return null;
  const { aspect: A, zoom: z, focus: [fx, fy] = [0.5, 0.5] } = p.crop;
  const heightRatio = (z * A) / frameAspect(p);  // content height / viewport height
  return {
    width: `${z * 100}%`,
    left: `${fx * (1 - z) * 100}%`,
    top: `${fy * (1 - heightRatio) * 100}%`,
  };
}
