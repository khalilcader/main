import { defineConfig } from 'astro/config';

// GitHub Pages: the deploy workflow sets SITE and BASE automatically.
// If the repo is renamed to khalilcader.github.io (or a custom domain is added),
// BASE becomes "/" and nothing here needs to change.
export default defineConfig({
  site: process.env.SITE || 'https://khalilcader.github.io',
  base: process.env.BASE || '/',
});
