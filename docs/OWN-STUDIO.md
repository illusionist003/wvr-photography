# Your own copy of WVR Studio

WVR Studio (the admin at https://wvr-admin.vercel.app, code in `admin/`) runs
on Nick's Vercel team. These steps put an identical copy on Matthew's own
Vercel account, with his own passphrase and his own photo storage, then point
the website at it. Same screens, same login page, same features. About 20
minutes. Nothing changes for the live site until step 7.

## 1. Vercel account

Sign up at https://vercel.com with the GitHub account `illusionist003` (the
free Hobby plan is enough). Allow Vercel to see the `wvr-photography`
repository when it asks.

## 2. The project

**Add New → Project**, import `illusionist003/wvr-photography`, and before
deploying:

- **Root Directory**: `admin`
- Framework: Next.js (picked automatically)
- Name it, for example `wvr-studio`. Its address becomes
  `https://wvr-studio.vercel.app` (or whatever name is free).

Deploy. The first deploy shows the login page but cannot sign in yet; that is
expected.

## 3. Photo storage

In the project: **Storage → Create → Blob**, name it `wvr-photos`, access
**Public**, and connect it to the project (all environments). This adds
`BLOB_READ_WRITE_TOKEN` to the project by itself.

## 4. Your passphrase

On a computer with Node 22 and this repository:

```
cd admin
node scripts/make-login.mjs
```

Type the passphrase you want (12 characters or more; a few words is easiest;
capitals and spaces at the ends do not matter). It prints two lines.

In the project: **Settings → Environment Variables**, add (Production):

| Name | Value |
| --- | --- |
| `ADMIN_PASSWORD_HASH` | the `scrypt$…` value it printed |
| `SESSION_SECRET` | the other value it printed |
| `SITE_URL` | `https://illusionist003.github.io/wvr-photography` (later `https://wvrphotography.com`) |
| `GITHUB_REPO` | `illusionist003/wvr-photography` |

Paste the values exactly as printed. Then **Deployments → … → Redeploy**.

## 5. Bring the galleries across

Copy every album, gallery (hidden ones too), caption and photo from the old
store into yours. The old store is only read.

```
cd admin
npx vercel link            # pick the project from step 2
npx vercel env pull .env.local
node --env-file=.env.local scripts/copy-store.mjs
rm .env.local
```

## 6. Sign in

Open your project's address, sign in with your passphrase, and check the
albums and galleries are all there. Sessions last 120 days per device.

## 7. Point the website at your studio

In GitHub: `illusionist003/wvr-photography` → **Settings → Secrets and
variables → Actions → Variables → New repository variable**:

- Name: `GALLERY_API`
- Value: `https://<your project>.vercel.app/api/site`

Within five minutes the site builds from your studio. From then on, make
changes only in your copy; the old one is no longer read.

## Optional

- Instant publishing: create a fine-grained GitHub token with **Actions: write**
  on `illusionist003/wvr-photography` only and add it to the Vercel project as
  `GITHUB_DISPATCH_TOKEN`, then redeploy.
- Own address: in the project's **Domains**, add `studio.wvrphotography.com`
  and the CNAME record it shows, once the domain is yours.
- New passphrase later: run `make-login.mjs` again, replace
  `ADMIN_PASSWORD_HASH`, redeploy. Replacing `SESSION_SECRET` signs every
  device out.
