// Khalil's photo (public/images/khalil.jpg), the one asset that can't be
// pulled from Figma automatically. Its URL carries a fingerprint of the
// file, so a new photo never hides behind a cached old one.
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = 'public/images/khalil.jpg';

export const photo = existsSync(file)
  ? `${import.meta.env.BASE_URL}images/khalil.jpg?v=${createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8)}`
  : null;
