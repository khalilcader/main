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
      }).optional(),
      // A still image filling the cover.
      image: z.string().optional(),
      // Describes the cover for screen readers.
      alt: z.string(),
    }),
  }),
});

export const collections = { work };
