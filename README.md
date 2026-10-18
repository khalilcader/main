# Portfolio

Khalil Cader's personal site, built with Astro.

- `npm install` then `npm run dev` to run locally at http://localhost:4321
- The dev server keeps running in the background (Ctrl+C doesn't stop it).
  `npx astro dev stop` stops it and `npx astro dev status` shows if one is
  running. Restart it after pulling changes to `src/content.config.ts`, or the
  old settings stay cached.
- Case studies: add a markdown file to `src/content/work/`. Its `cover` field
  sets the cover in the home page's work strip (aspect, plus a video or image).
- Design tokens: `src/styles/tokens.css`
- Pushing to `main` deploys to GitHub Pages.

## Home page: the work strip

Built from the Figma layout frame (53:253) and the interaction prototype on the
`claude/fervent-hopper-kdahc3` branch (`prototype/index.html`, `HANDOFF.md`).

- Drag, scroll or use the arrow keys to move the row; it glides and rubber-bands at the ends.
- Pull a cover down to squish it; its neighbors follow in a chain reaction.
- Pull a cover up (or tap it) to open the focus strip: near full-screen covers,
  one per swipe. Drag a focused cover away (or press Esc) to go back.
- G or the grid button: packed grid; tap a cover for a lightbox.
- T or the theme button: switch between light and dark (follows the system until toggled).

Code: `src/components/WorkStrip.astro` (markup and styles) and
`src/scripts/work-strip.ts` (motion). Motion tuning values are at the top of the script.

The profile photo goes at `public/images/khalil.jpg`; the header picks it up automatically.
