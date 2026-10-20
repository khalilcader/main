import { defineConfig } from 'astro/config';

// Vercel builds every push to main and serves it at khalilcader.com, from the root.
// If the repo is renamed to khalilcader.github.io (or a custom domain is added),
// BASE becomes "/" and nothing here needs to change.
export default defineConfig({
  site: process.env.SITE || 'https://khalilcader.com',
  base: process.env.BASE || '/',
  // The dev toolbar sits over the page dots; it only ever shows in `npm run dev`.
  devToolbar: { enabled: false },
});
