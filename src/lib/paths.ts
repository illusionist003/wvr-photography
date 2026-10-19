/* Internal links go through href() so the same source builds for the bare
   domain and for the /wvr-photography/ preview. Data files always write
   site-relative paths ("/event-photography/"). */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function href(path: string): string {
  if (/^(https?:|tel:|sms:|mailto:|#)/.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}`;
}

export const isExternal = (path: string) => /^https?:/.test(path);
