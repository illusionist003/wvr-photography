# Launch

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
