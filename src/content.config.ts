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
  }),
});

export const collections = { work };
