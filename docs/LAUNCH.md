# Launch

## Repository transfer to Matthew (started 2026-10-19)

The repository was offered to Matthew's GitHub account, `illusionist003`. He
has to accept from GitHub's email within one day, or the offer expires and it
has to be sent again. Nick (nradachy-web) stays on it as a collaborator.
GitHub does not redirect Pages addresses, so after he accepts:

1. The preview moves to https://illusionist003.github.io/wvr-photography/
   (the workflow already builds for whoever owns the repository). Check that
   Pages is still set to GitHub Actions in the repository settings, then run
   the Deploy workflow once.
2. In the Vercel project `wvr-admin`: set `SITE_URL` to
   `https://illusionist003.github.io/wvr-photography` and `GITHUB_REPO` to
   `illusionist003/wvr-photography`, then redeploy the studio.
3. Locally: `git remote set-url origin https://github.com/illusionist003/wvr-photography.git`.
4. The old https://nradachy-web.github.io/wvr-photography/ link stops working.

The preview is live at https://nradachy-web.github.io/wvr-photography/ (every
page noindex, robots.txt closed). The Wix site stays live until all of this is
done.

1. Matthew answers `docs/OPEN-QUESTIONS.md`; copy updated in `src/data/`.
2. Form: create a Web3Forms access key for Matthew@wvrphotography.com, put it in
   `FORM.web3formsKey` (`src/data/site.ts`), send one real test from the
   preview and confirm it lands in his inbox. Until then the form opens the
   visitor's email app addressed to him, which works but is weaker. Never ship
   a key that has not delivered a real message.
3. Production build: in `.github/workflows/deploy.yml` remove `BASE_PATH` and set
   `SITE_URL` to `https://wvrphotography.com`, add `public/CNAME` with
   `wvrphotography.com`, set the custom domain in the repository's Pages
   settings, enforce HTTPS. In the Vercel project `wvr-admin`, set `SITE_URL`
   to `https://wvrphotography.com` and redeploy, so the studio checks the
   right site. Optionally give the studio its own address
   (`studio.wvrphotography.com`, CNAME to Vercel).
4. DNS at his registrar (Wix holds it today): apex A records to the four GitHub
   Pages IPs, `www` CNAME `nradachy-web.github.io`. Touch web records only;
   leave MX and any email records alone.
5. Old Wix addresses: `/portfolio`, `/contact` and all nine
   `/portfolio-collections/<name>` pages exist at the same paths, so no
   redirects are needed.
6. After cutover: submit `sitemap.xml` in Search Console, run PageSpeed on the
   live domain and record the numbers in this file.
