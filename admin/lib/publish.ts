/* Getting changes onto the public site. The site's GitHub workflow checks
   every five minutes whether the published content changed and rebuilds if it
   did, so nothing here is required. If GITHUB_DISPATCH_TOKEN is set (a
   fine-grained token with Actions: write on the site repository only), a
   change also starts the build at once. */

export async function dispatchBuild() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO || 'nradachy-web/wvr-photography';
  if (!token) return false;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main' }),
  });
  return res.ok;
}

export const SITE_URL = (process.env.SITE_URL || 'https://nradachy-web.github.io/wvr-photography').replace(/\/$/, '');
