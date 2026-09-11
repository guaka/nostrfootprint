# Nostr Footprint

Licensed under the GNU Affero General Public License v3.0 only ([LICENSE](LICENSE)).

An independent, client-side web app for inspecting your published Nostr events across selected relays, exporting them, and requesting deletion of selected event IDs.

Events appear in a selectable table with publication time, type, content/details, and a dedicated relay column. The footer links to the GitHub source and shows the build timestamp in `yyyy-mm-dd hh:mm` UTC, captured when Vite builds the app.

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

## Signing

- NIP-07: uses the provider at `window.nostr`, including providers supplied by native app browsers.
- NIP-46: accepts a `bunker://` URL; creates an ephemeral client key and requests approval through the remote signer. HTTPS authorization links are displayed for the user to open.
- nsec: imported into memory for the current tab only. No localStorage, cookies, analytics, or server submission. Disconnect wipes the byte buffer; JavaScript cannot guarantee erasure of all runtime copies. Reload drops the session.
- Read-only browsing: enter an npub or hexadecimal public key.

Every deletion checks ownership, validates source event signatures, creates a kind-5 request with exact `e` and `k` tags, and verifies that the signer returned the precise approved template. Requests are sent only after the review action. No automatic deletion on scan.

## Coverage and limits

- Up to 12 user-selected secure WebSocket relays, 20 pages per relay, 500 requested events per page, and 12-second query timeouts. Time-boundary pagination stops conservatively when it cannot advance without potentially skipping events; the UI reports incomplete coverage.
- Results are deduplicated by verified event ID, retaining each source relay. Relay responses are not proof of complete archives. Relays may discard prior replaceable versions or impose hidden limits.
- Relay authentication is not yet implemented. NIP-42 challenges are surfaced as authentication required. NIP-46 signing does not itself grant relay access.
- Deletion is NIP-09 best effort. Relay acknowledgment and subsequent ID queries are shown separately. No global erasure guarantee. The signed request is included in subsequent exports as a receipt.
- Requests target exact IDs, not address-wide deletion. Up to 100 events per request. Kind-5 requests cannot themselves be selected for deletion.
- Encrypted events are not decrypted. Gift-wrapped DMs are not a complete authored-message archive because their outer authors differ.
- Notes signed by other keys, including service-signed Nostroots reposts, are outside this identity's deletion authority. No Nostroots service integration is included yet.
- Discovery from NIP-65 relay lists, nostrconnect QR pairing, and mnemonic import are not implemented.

The example uses clearly marked synthetic data and cannot publish deletion requests. The app renders relay content as text, not HTML. Searching reveals the queried public key and your IP to the selected relays.

## Verification

`npm test` covers key input, relay URL validation, ownership/signature checks, exact deletion scope, malicious signer output, query verification, and rejected publish acknowledgments. Test signing uses generated throwaway keys, never a real account.

Protocol references: [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md), [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md), [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md).
