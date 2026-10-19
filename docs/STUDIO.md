# WVR Studio (the admin)

Matthew's login for managing galleries: **https://wvr-admin.vercel.app**
(Vercel project `wvr-admin`, team `modern-apex`; code in `admin/`).

## The layers

Like his old Wix portfolio (Gallery, then Wentworth, then "Winner's Circle One
Day 7-25" with its photos), with albums on top: albums hold galleries,
galleries hold the galleries inside them, and those hold the photos.

- Studio: **Albums** list, tap an album to see its galleries and its details
  (name, a line about it, cover, delete when empty), tap a gallery to see the
  galleries inside it, tap one of those to see and add its photos. The back
  button always goes up one layer.
- New galleries are made on the first two layers (**New gallery in this
  album**, then **New gallery in Wentworth Real Estate**); photos are added on
  the third. Creating a gallery in an album goes straight on to making the
  first gallery inside it. One level of galleries inside galleries, no deeper.
- A gallery from before this change can keep photos of its own, shown under
  its galleries. Select them and tap **Make galleries** (or tap one photo,
  **Make it its own gallery**) to give each photo its own gallery inside,
  with the photo as cover and its caption as the title.
- Each gallery has a **Project type**, **Date** and **Location** (all
  optional), shown on its page the way the Wix project pages showed them.
- **Inside** in a gallery's details moves it into another gallery or back out
  to its album.
- Site: the **Galleries** menu opens to every album with its galleries (a panel
  on desktop that opens on hover or with the arrow button, an accordion in the
  phone menu). `/portfolio/` lists the albums, `/portfolio/<album>/` lists that
  album's galleries, `/portfolio-collections/<gallery>/` shows the
  galleries inside it as cards (then any photos of its own), and each of
  those has its own `/portfolio-collections/<slug>/` page with its photos,
  project type, date and location, and breadcrumbs Galleries / album /
  gallery / inner gallery.
- An album only appears on the site once it has a published gallery with photos
  (or with a published gallery inside it). A gallery inside another only
  shows while the outer one is published. A gallery cannot be deleted while
  galleries sit inside it.
- The three original groups (Businesses and events, Sports and action, People
  and places) became the first three albums.

## What he can do

- Sign in once per device with the passphrase (Keychain: service `apex-memory`,
  account `wvr_admin_password`). Sessions last 120 days.
- Create a gallery (title, section, type of work). It starts hidden and the
  photo picker opens straight away.
- Add photos: any number at once, from a phone's library or by dragging files
  onto the page on a computer. Each photo is turned upright and resized to
  2400px in his browser (a 24 MP camera file becomes about 1 MB), then
  uploaded straight to the Blob store with a 640px thumbnail. The screen stays
  awake while uploading and warns before closing.
- Tap a photo: caption, description for screen readers, make it the cover,
  move earlier or later, move to another gallery, remove.
- Select several photos: move them or remove them together.
- Create albums, rename them, write a line about them, pick the cover,
  reorder them, delete them once empty.
- Reorder galleries within an album (and the galleries inside a gallery), move
  a gallery to another album or into another gallery, publish or hide it,
  delete it.
- Everything saves by itself. The header says when the website has caught up.

## How a change reaches the site

1. The studio saves `content/manifest.json` in the Blob store (ETag checked, so
   a stale phone cannot overwrite the computer; every version is also kept
   under `content/history/`, newest 80). Right after a save the store can
   briefly hand back the previous copy; reads always carry the ETag of the copy
   actually read, so a save made from an old copy is refused as a conflict,
   never written over newer work.
2. `https://wvr-admin.vercel.app/api/site` serves only what is published.
3. The site workflow (`.github/workflows/deploy.yml`) checks every five minutes;
   if the published fingerprint differs from the live
   `gallery-version.txt`, it runs `scripts/sync-gallery.mjs` (downloads new
   photos, cached between runs), builds and deploys. A build with new photos
   takes a few minutes; GitHub's five-minute schedule is best effort, so
   "live in 5 to 15 minutes" is what the studio tells him.
4. Optional, instant: create a fine-grained GitHub token with **Actions:
   write** on `nradachy-web/wvr-photography` only, and add it to the Vercel
   project as `GITHUB_DISPATCH_TOKEN`. Every publish then starts the build at
   once.

## Rules built in

- Text he types is shown as plain text. Long dashes are turned into commas at
  build time. The house copy checks (prices, guarantees, dashes) skip his
  text, so a caption can never block a publish; structure checks still run.
- Gallery page titles and descriptions are generated to fit search limits.
- A build fails, and the live site stays as it was, if the studio cannot be
  reached or a photo cannot be downloaded.
- Old Wix addresses stay: galleries live at `/portfolio-collections/<slug>/`.
  The address is fixed when a gallery is created; renaming keeps it.

## Upkeep

- Unused photos (removed from every gallery, not in the last 30 days of saved
  versions): `cd admin && vercel env pull .env.local` then
  `node --env-file=.env.local scripts/cleanup-orphans.mjs` (dry run) and add
  `--delete`. Delete `.env.local` afterwards.
- Change the passphrase: generate a new scrypt hash (format in `lib/auth.ts`)
  into `ADMIN_PASSWORD_HASH`, redeploy. Rotating `SESSION_SECRET` signs every
  device out.
- Deploy the admin: `cd admin && vercel deploy --prod --token <token> --scope modern-apex`.
- Size: GitHub Pages sites are limited to 1 GB. Each gallery photo costs
  roughly 0.5 MB of sized copies, so about 1,500 published photos fit. Past
  that, serve gallery images from the Blob store instead.
- Cost: Blob storage at about 1 MB per photo, cents per month at this scale.
