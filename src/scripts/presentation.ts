/*
  How a project shows up on the stage (and in its hover thumbnail).

  frame:  'phone'  — the Figma phone mock (fixed aspect)
          'window' — a Mac-style window; aspect = whole window, width / height
          'media'  — a bare image or video with rounded corners
  crop:   optional, to focus on part of the content. The content is scaled
          up and bleeds off the stage, fading into its soft edge.
          zoom  = size relative to its normal fitted size (2 = twice as big)
          focus = the point of the content that lands in the stage's centre,
                  0..1 from its top-left ([0.2, 0.2] = near the top-left corner)
*/
export interface Presentation {
  frame: 'phone' | 'window' | 'media';
  aspect?: number;
  src?: string;
  alt?: string;
  crop?: { zoom: number; focus?: [number, number] };
}

export const PHONE_ASPECT = 390 / 816;  // Figma device frame

/** Width / height of the framed content, before any crop. */
export function frameAspect(p: Presentation) {
  if (p.frame === 'phone') return PHONE_ASPECT;
  return p.aspect ?? (p.frame === 'window' ? 16 / 10 : 16 / 9);
}

/**
 * Hover-thumbnail shape: follows the content, except a whole phone (a
 * sliver at thumbnail size) and crops (which fill the stage): 3:4 and 4:5.
 */
export function thumbAspect(p: Presentation) {
  if (p.crop) return 4 / 5;
  if (p.frame === 'phone') return 3 / 4;
  return frameAspect(p);
}
