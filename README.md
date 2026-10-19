# WVR Photography

Website for WVR Photography (Matthew Weaver, Fenton, MI), rebuilt by Modern Apex
Strategies from his Wix site at wvrphotography.com.

- Preview: https://nradachy-web.github.io/wvr-photography/ (noindex, robots closed)
- Stack: Astro 7, static HTML, CSS inlined, one font, no client framework.
- Every business fact: `src/data/site.ts`. Photos: `src/data/photos.ts`.
  Galleries: `src/data/collections.ts`. Service pages: `src/data/services.ts`.

```sh
npm ci
npm run dev            # local
npm run build:preview  # what GitHub Pages serves today (/wvr-photography/ base, noindex)
npm run build          # production build for wvrphotography.com
npm run crops          # phone cuts of the hero photos (after changing a hero or focus)
npm run icons          # favicons and the share image from the logo
```

`npm run build` runs `scripts/postbuild.mjs`, which fails on dashes, prices,
guarantees, turnaround promises, broken links, missing image sizes, a plain
text phone number, duplicate ids and titles or descriptions out of range.

Read before changing anything: `docs/DESIGN.md`. Before launch:
`docs/LAUNCH.md` and `docs/OPEN-QUESTIONS.md`.
