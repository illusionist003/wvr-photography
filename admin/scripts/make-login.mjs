/* The two login settings for a new copy of the studio: ADMIN_PASSWORD_HASH
   (from the passphrase you choose, in the scrypt format lib/auth.ts checks)
   and SESSION_SECRET (random, signs the 120-day sign-in cookie). Paste both
   into the Vercel project's environment variables. The passphrase itself is
   never stored; it is not case sensitive and spaces at either end are ignored.
   Run from admin/: node scripts/make-login.mjs */
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pass = (await rl.question('Choose a passphrase (12 characters or more): ')).trim().toLowerCase();
rl.close();
if (pass.length < 12) {
  console.error('Too short: use 12 characters or more, a few words is easiest to remember.');
  process.exit(1);
}
const [N, r, p] = [32768, 8, 1];
const salt = randomBytes(16);
const hash = scryptSync(pass, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
console.log(`\nADMIN_PASSWORD_HASH=scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
