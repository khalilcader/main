import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Case studies: one markdown file per project in src/content/work/
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    year: z.string(),
    order: z.number().default(99),
    // The cover shown in the work strip on the home page.
    cover: z.object({
      // Width / height. Figma's row covers are 422 × 617 (portrait) and 771 × 617 (wide).
      aspect: z.number().positive(),
      // A screen recording shown in the glass device frame. Paths are relative
      // to public/, e.g. "images/work/name.mp4".
      video: z.object({
        webm: z.string().optional(),
        mp4: z.string(),
        poster: z.string(),
        // Seconds into the video the cover rests on; it plays from here on
        // hover or when the cover is open.
        start: z.number().min(0).default(0),
        // Which device frame it plays in.
        device: z.enum(['iphone', 'ipad']).default('iphone'),
        // Optional camera that follows the interaction while it plays:
        // [seconds, x, y, zoom] keyframes, x/y being the point on the device
        // (0..1 across it) brought to the middle of the cover. The device also
        // drops out and back in around the loop (src/scripts/camera.ts).
        camera: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).optional(),
      }).optional(),
      // An animated background behind the media: "backdrop" is a grainy
      // studio-backdrop shader (src/scripts/backdrop-shader.ts).
      shader: z.enum(['backdrop', 'gradient']).optional(),
      // The gradient's colours: warm (stone rising to an ember glow), cool
      // (shades of sage) or violet (lavender grey rising to a dusky violet glow).
      palette: z.enum(['warm', 'cool', 'violet']).optional(),
      // A still image filling the cover.
      image: z.string().optional(),
      // Describes the cover for screen readers.
      alt: z.string(),
    }),
  }),
});

export const collections = { work };
