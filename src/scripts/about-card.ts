// The About card (AboutCard.astro). Clicking the avatar grows the card out of
// the avatar's About side: it moves and scales from the avatar to the centre of
// the screen while turning 180° in 3D, so the book side turns away and the
// card's front comes round. Closing runs the same motion backwards, and either
// can be interrupted mid-way and reverses smoothly from where it is.

const DURATION = 700;                                // ms
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';       // quick start, long soft landing
const PERSPECTIVE = 1600;                            // px

const dialog = document.getElementById('about');
const card = document.getElementById('about-card');
const scrim = document.getElementById('about-scrim');
const closeBtn = document.getElementById('about-close');
const who = document.querySelector<HTMLAnchorElement>('.site-header .who');
const avatar = who?.querySelector<HTMLElement>('.photo');

if (dialog && card && scrim && closeBtn && who && avatar) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let anims: Animation[] = [];

  // Keyframes from the small state (on the avatar, book side up) to the open card.
  function keyframes() {
    const a = avatar!.getBoundingClientRect();
    card!.style.transform = 'none';
    const c = card!.getBoundingClientRect();
    card!.style.transform = '';
    const sx = a.width / c.width, sy = a.height / c.height;
    const dx = a.left + a.width / 2 - (c.left + c.width / 2);
    const dy = a.top + a.height / 2 - (c.top + c.height / 2);
    // The book side's icon matches the avatar's 24px at the small end.
    card!.style.setProperty('--about-back-icon', `${(24 / sx).toFixed(1)}px`);
    const rSmall = parseFloat(getComputedStyle(avatar!).getPropertyValue('--photo-radius')) || 14;
    const rBig = parseFloat(getComputedStyle(card!).borderTopLeftRadius) || 24;
    if (reduce) {
      return { card: [{ opacity: 0 }, { opacity: 1 }], scrim: [{ opacity: 0 }, { opacity: 1 }] };
    }
    return {
      card: [
        {
          transform: `perspective(${PERSPECTIVE}px) translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotateY(-180deg)`,
          borderRadius: `${rSmall / sx}px / ${rSmall / sy}px`,
        },
        {
          transform: `perspective(${PERSPECTIVE}px) translate(0px, 0px) scale(1, 1) rotateY(0deg)`,
          borderRadius: `${rBig}px / ${rBig}px`,
        },
      ],
      scrim: [{ opacity: 0 }, { opacity: 1 }],
    };
  }

  function run(direction: 'open' | 'close') {
    // Mid-way the other direction: turn the running animation around.
    if (anims.length && (state === 'opening' || state === 'closing')) {
      anims.forEach((an) => an.reverse());
      state = direction === 'open' ? 'opening' : 'closing';
      return;
    }
    const k = keyframes();
    const opts: KeyframeAnimationOptions = { duration: reduce ? 200 : DURATION, easing: reduce ? 'ease-out' : EASE, fill: 'both' };
    anims = [card!.animate(k.card, opts), scrim!.animate(k.scrim, opts)];
    if (direction === 'close') anims.forEach((an) => an.reverse());
    state = direction === 'open' ? 'opening' : 'closing';
    Promise.all(anims.map((an) => an.finished)).then(settle, () => {});
  }

  function settle() {
    anims.forEach((an) => an.cancel());
    anims = [];
    if (state === 'opening') {
      state = 'open';
      scrim!.style.opacity = '1';
    } else if (state === 'closing') {
      state = 'closed';
      dialog!.hidden = true; scrim!.hidden = true;
      scrim!.style.opacity = '';
      avatar!.style.visibility = '';
      who!.focus({ preventScroll: true });
    }
  }

  function open() {
    if (state === 'open' || state === 'opening') return;
    if (state === 'closed') {
      dialog!.hidden = false; scrim!.hidden = false;
      avatar!.style.visibility = 'hidden';   // the card takes its place
    }
    scrim!.style.opacity = '';
    run('open');
    closeBtn!.focus({ preventScroll: true });
  }
  function close() {
    if (state === 'closed' || state === 'closing') return;
    scrim!.style.opacity = '';
    run('close');
  }

  who.addEventListener('click', (e) => { e.preventDefault(); open(); });
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  // While open, the card owns the keyboard: Esc closes, Tab stays inside, and
  // the strip's shortcuts (arrows, G, T, Esc) don't fire underneath.
  window.addEventListener('keydown', (e) => {
    if (state === 'closed') return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn!.focus(); }
    e.stopImmediatePropagation();
  }, { capture: true });
}
