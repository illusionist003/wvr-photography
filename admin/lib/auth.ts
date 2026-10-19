/* One login for the studio: a passphrase checked against a scrypt hash in
   ADMIN_PASSWORD_HASH, then a signed cookie that lasts 120 days, so Matthew
   signs in once per phone or computer. SESSION_SECRET signs the cookie. */
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'wvr_session';
const DAYS = 120;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSession() {
  const payload = b64(JSON.stringify({ u: 'studio', exp: Date.now() + DAYS * 864e5 }));
  return { value: `${payload}.${sign(payload)}`, maxAge: DAYS * 86400 };
}

export function validSession(value: string | undefined | null): boolean {
  if (!value) return false;
  const [payload, mac] = value.split('.');
  if (!payload || !mac) return false;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

/** Format: scrypt$N$r$p$saltB64$hashB64 */
export function checkPassword(given: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = scryptSync(given.trim().toLowerCase(), Buffer.from(salt, 'base64'), want.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function isSignedIn() {
  const jar = await cookies();
  return validSession(jar.get(COOKIE)?.value);
}

export function sessionFromRequest(req: Request) {
  const raw = req.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return validSession(m ? decodeURIComponent(m[1]) : null);
}
