import { defineConfig } from 'astro/config';

// Vercel serves khalilcader.com at the root, with nothing to set. The GitHub
// Pages copy (khalilcader.github.io/main) gets SITE and BASE from its workflow.
// If the repo is renamed to khalilcader.github.io (or a custom domain is added),
// BASE becomes "/" and nothing here needs to change.
export default defineConfig({
  site: process.env.SITE || 'https://khalilcader.com',   // the live domain (Vercel); the GitHub Pages workflow sets its own
  base: process.env.BASE || '/',
  // The dev toolbar sits over the page dots; it only ever shows in `npm run dev`.
  devToolbar: { enabled: false },
});
