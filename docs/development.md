# Development and deployment

## Run

Requires Node 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Deploy the generated `dist/` directory on a static HTTPS host. No backend or account database is required. This project does not build a browser extension.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` runs the core tests, builds the site, and runs Chromium browser tests against the production build using simulated relays. Pull requests validate only; successful pushes to `main` deploy to GitHub Pages. Manual runs deploy only when run from `main`.

After pushing this repository to GitHub, select **Settings → Pages → Build and deployment → Source → GitHub Actions**. Push to `main` or run **Test and deploy GitHub Pages** from the Actions tab. The deployment job reports the published URL. No personal access token or Nostr secret is needed.

Assets use relative paths, so both `https://owner.github.io/repository/` and custom domains work without changing the build. If you rename the default branch, update the workflow's branch trigger and deployment conditions.

To reproduce the browser check locally, run `npm run build`, `npx playwright install chromium`, then `npx playwright test`. The test runner starts a preview server automatically; outside CI it may reuse an existing server on port 4173.

## Verification

`npm test` covers key input, relay URL validation, ownership/signature checks, exact deletion scope, malicious signer output, query verification, and rejected publish acknowledgments. Test signing uses generated throwaway keys, never a real account.

Protocol references: [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md), [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md).
