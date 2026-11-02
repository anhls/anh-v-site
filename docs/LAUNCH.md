# Launch guide (one page, plain words)

The site is ready to go public once you say so. **Nothing here has been done yet.** The builder never touches `live`, Cloudflare or DNS.

## 1. Put the finished site on `live`
Ask Cowork: "Put work-v2 on live." Cowork does the git part (it copies the current `work-v2` onto the `live` branch). Cloudflare then builds it by itself.
Before asking, check that the private preview of `work-v2` looks right on your phone and laptop.

## 2. Add your domains in Cloudflare Pages
Cloudflare dashboard → Workers & Pages → `anh-v-site` → Custom domains → Set up a custom domain.
Add `www.anh-v.com` first, then `anh-v.com`. Cloudflare shows what DNS records it wants.

## 3. Point PA Vietnam at Cloudflare
In the PA Vietnam control panel, change the nameservers of `anh-v.com` to the two Cloudflare nameservers shown in Cloudflare (Add a site → free plan). If you would rather keep PA Vietnam DNS, add the CNAME record Cloudflare displays for `www`. Changes can take from a few minutes to a day.

## 4. Send the bare domain to www
Cloudflare → `anh-v.com` → Rules → Redirect Rules → "anh-v.com" to `https://www.anh-v.com` (301, keep the path). This way there is only one public address.

## 5. Keep the private previews private
Leave the Cloudflare Access login on the `*.anh-v-site.pages.dev` preview addresses. Only `live` (your real domain) is public. Do not remove the Access policy.

## 6. Check after it is public
- `https://www.anh-v.com` opens with a padlock (HTTPS) and `https://anh-v.com` jumps to www.
- `https://www.anh-v.com/sitemap.xml` shows the list of pages (5 projects: tcb-priority, bitis09, sulwhasoo, similac, forbes).
- One project link, e.g. `https://www.anh-v.com/work/forbes`, opens; a made-up address such as `/work/nope` shows the 404 page.
- Duhat and Nam Long must not appear anywhere (they are hidden for now).

## Later: showing Duhat and Nam Long again
In `src/data/data.json`, delete the line `"hidden": true` in those two projects, then run `npm run layout`, `npm run layout:tall`, `npm run layout:tablet` and build. Ask a builder to do it.

## Contact card links
`src/data/data.json` → `contact.links`: fill in the Instagram / LinkedIn / Behance addresses. Entries with an empty address are not shown.
