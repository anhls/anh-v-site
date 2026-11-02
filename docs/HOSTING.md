# Private previews

Push a branch to GitHub and Cloudflare Pages builds a preview. Open its link on your phone or laptop; the development PC can be off. Sign in through Cloudflare Access with Anh's approved account. If Access refuses you, check the account with Anh rather than making the preview public.

The project is `anh-v-site`, connected to the private `anhls/anh-v-site` repository. Branch aliases use lowercase names with punctuation replaced by hyphens:

| Branch | Preview |
| --- | --- |
| `codex/r39-hosting` | https://codex-r39-hosting.anh-v-site.pages.dev |
| `work-v2` | https://work-v2.anh-v-site.pages.dev |
| `desktop/next` | https://desktop-next.anh-v-site.pages.dev |
| `mobile/next` | https://mobile-next.anh-v-site.pages.dev |

Cloudflare also gives each deployment its own permanent link. Find the links under Workers & Pages → anh-v-site → Deployments → the relevant preview. Branch links move forward with new successful deployments; deployment-specific links let you review an older build. Preview responses normally include `X-Robots-Tag: noindex`. Noindex controls search indexing; Access is what keeps unreleased work private. [Preview documentation](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

## Why the public address is empty

`live` is the production branch. It deliberately contains only a placeholder README, so its build fails and `anh-v-site.pages.dev` has no approved site. This is intentional while the portfolio contains unreleased client material. Do not repair that build, push the site to `live`, or attach the public domain during preview work. The production address is not protected by the preview Access policy.

## Build settings

Anh manages the Cloudflare dashboard. Repository work does not change those settings or require tokens.

| Setting | Value |
| --- | --- |
| Production branch | `live` |
| Preview branches | All working branches, subject to Anh's branch controls |
| Root directory | Empty |
| Framework | None / Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | `22`, pinned by `.nvmrc`; dashboard `NODE_VERSION=22` should agree |
| Dependency install | `npm ci` using the existing lockfile |

The PC used for this request runs Node **v24.20.0** (2026-10-11). That is the local test version, not proof of a successful Node 22 cloud build. Node 22's exact patch version can change with Cloudflare's build image.

Vite copies `public/_headers` unchanged into `dist/_headers`:

| Files | Browser cache |
| --- | --- |
| `/assets/*` (hashed bundles) | One year, immutable |
| `/media/*`, `/fonts/*` (unhashed) | 30 days, without immutable |
| HTML | Cloudflare's default revalidation |

Replacing an unhashed media/font file at the same URL may leave an older copy in a browser for up to 30 days. Use a new filename when an update must appear immediately. This request adds no CSP or other security header that could interfere with video or WebGL. [Header documentation](https://developers.cloudflare.com/pages/configuration/headers/).

## Clean URLs and missing pages

Cloudflare redirects project links such as `/work/duhat.html` to `/work/duhat`. Keep the site's `.html` links for now. The redirect stays on the same origin, so session storage survives; hosted open/back transitions still need an authenticated check. A direct clean URL must also load correctly. A top-level `dist/404.html` supplies the site's missing-page design. Check `/nope` returns that page with HTTP status 404. Local Vite's development fallback is not evidence of Cloudflare's 404 handling. [Serving-pages documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Launch cleanup: the seven project canonical URLs and sitemap entries currently end in `.html`, while Cloudflare's final URLs are extensionless. The seven slugs are `tcb-priority`, `bitis09`, `sulwhasoo`, `similac`, `forbes`, `duhat`, and `nam-long`. They also name `www.anh-v.com` rather than the private preview host, as intended for future production. Leave them unchanged in R39; reconcile the final domain and URL form at launch.

## Limits and build logs

The free Pages plan permits 20,000 files per deployment and a maximum of 25 MiB per file. It normally allows 500 builds per month and one concurrent build; other plan limits may differ. The measured output for this branch is in [R39 notes](codex/R39-notes.md). [Current limits](https://developers.cloudflare.com/pages/platform/limits/).

In a preview deployment's build log, check the dependency-install and build sections. `ffmpeg-static` downloads a platform binary and `sharp` installs native components. If either fails or makes installation take minutes, retain the relevant log lines and report them. Do not change packages or the lockfile as a workaround without Anh's approval. A successful local install does not establish what happened on Cloudflare.

## Redeploy or return to an older build

To redeploy the same commit, open its deployment in Cloudflare and use **Retry deployment**, if available. A normal new commit and push to the working branch also requests a fresh preview build. Never force-push or change Cloudflare settings to repair a preview.

For preview review, open the older deployment's permanent link. To make the branch preview contain an older approved version again, create a normal follow-up/revert commit on that working branch and push it. Cloudflare's **Rollback to this deployment** action is for previous successful **production** deployments; preview deployments are not valid rollback targets. At launch, production rollback lives under Deployments → a previous successful production deployment → the three-dot menu → Rollback to this deployment. Do not use it to publish a preview now. [Rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## Anh's hosted check

After signing in, compare the preview with localhost on desktop and phone: homepage, both Work modes, two project pages, open/back, `?theme=light`, and `?gl=0`. Confirm an unauthenticated browser reaches Access rather than client work. Inspect the authenticated responses for noindex, the three cache rules, the clean-URL redirect and `/nope`'s 404 status. Access's login response has its own private/no-store headers; those do not verify the site's asset cache rules.

## At launch

Approve the content, including permission to publish client work. Put that approved site on `live` in a separate authorized request, connect `anh-v.com` (registered at PA Vietnam), settle the `www` redirect and canonical/sitemap URL form, and check HTTPS, missing pages and indexing. Retain private preview protection. None of these launch actions are part of R39 Part B.
