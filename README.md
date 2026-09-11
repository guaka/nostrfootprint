# Nostr Footprint

Find, inspect, export, and request deletion of your Nostr events across relays.

**[Open Nostr Footprint](https://guaka.github.io/nostrfootprint/)**

Browse with an npub or hex public key. Connect a NIP-07 or NIP-46 signer, or use an nsec for the current session, to request deletion.

Filter by relay, kind, content, and detected encryption. Inspect NIP-05 identities, export results, and bulk-delete with per-relay feedback.

Deletion is a request, not guaranteed erasure. Searches may be incomplete. Everything runs in your browser; relays see your IP and the public key you search.

## Development

Requires Node 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Pushes to `main` run tests and deploy to GitHub Pages.

## More

- [Usage, signing, privacy, and limitations](docs/usage.md)
- [Testing and deployment](docs/development.md)
- [AGPL-3.0-only license](LICENSE)
