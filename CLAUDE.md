# Khalil's portfolio

Personal portfolio site for Khalil Cader, a product designer. The design is done by Khalil in Figma; code should implement it faithfully, not reinterpret it.

## Stack
- Astro (static site), plain CSS. No CSS framework, no UI library.
- Case studies are markdown files in `src/content/work/` (schema in `src/content.config.ts`).
- Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main` (khalilcader.github.io/main). Moving to Vercel on Khalil's own domain: there, set the `SITE` env var to the domain (link previews and canonical URLs use it); `BASE` stays unset (`/`).
- Case-study pages are shelved: `src/pages/work/_[slug].astro` (the underscore keeps Astro from building it). Rename it back to `[slug].astro` once the write-ups are real.

## Working from Figma
- Figma is the source of truth. Match spacing, type, and color exactly; if the design is ambiguous, ask instead of guessing.
- All design values live as CSS custom properties in `src/styles/tokens.css`. Pull them from the Figma variables first, then build components that only reference tokens; no hard-coded colors or sizes in components.
- Build reusable pieces as Astro components in `src/components/`.
- Every page must work at phone width with no horizontal scroll.

## Conventions
- Internal links must prefix `import.meta.env.BASE_URL` (the site may be served from a subpath).
- Images go in `public/images/`; use descriptive alt text.
- Keep JavaScript to a minimum; use it only where an interaction needs it.
- Run `npm run build` before committing to make sure the site builds.

## Project videos
- Adding or adjusting a project cover video: follow `.claude/skills/project-video/SKILL.md` (cropping, bottom room, touch circle, camera, thumbnail, background). Show options before committing judgement calls.
