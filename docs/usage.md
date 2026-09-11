# Usage and limitations

Checkboxes beside Relay coverage filter the table to events observed on any checked relay, combined with the type and content filters. None checked (or **Show all relays**) shows all results. Filtering preserves selected event IDs, including hidden selections, and does not change deletion destinations. Both bulk selection controls respect the active filters.

Relay coverage separates regular events from kind-5 deletion requests. After deletion checks, confirmed absent originals are subtracted; still-present or unverified copies are retained. Accepted deletion requests are counted once per relay (acceptance is not proof of retention). A new search rebuilds these counts from observed results.

Events appear in a selectable table with publication time, type, content/details, and a dedicated relay column. The footer links to the GitHub source and shows the build timestamp in `yyyy-mm-dd hh:mm` UTC, captured when Vite builds the app.

After a deletion request, each affected row shows a result badge and per-relay checks. Notes no longer returned by every checked relay are shaded green with crossed-out text; notes still returned or not fully verified remain visibly distinct. The review dialog summarizes the batch and offers a button back to the table. These statuses describe this session's relay checks, not guaranteed global erasure.

During searches, existing rows and checkboxes stay in place. Later batches wait behind **Show new events**, and **Select visible results** selects only the currently displayed, filtered rows. Sorting and revealing new events are explicit actions; incoming batches preserve focus, open event details, scroll position, and selected event IDs. Reviewing deletion during a search first stops and drains that search, then snapshots the selection.

For mass deletion, **Select all matching events** includes currently discovered results waiting behind the new-events button, respecting the active filters. It never selects future arrivals automatically. Large selections run as sequential batches of up to 100 events after one scope review, with progress and optional **Stop after this batch**. A signer may request approval for each batch. If signing is declined or interrupted, completed results and receipts are retained and only unsent events remain selected; **Continue remaining** resumes those events without republishing completed batches. The full selection is validated before the first request is signed.

Results are cached in memory for the three most recently searched public keys in the current tab. Refreshing the same key keeps selections and historical observations; switching keys clears selections. Cached records are labeled until a relay returns them in the current search. Deletion outcomes and check timestamps survive refreshes, and fresh observations of a previously removed event mark that relay as still returning it. Empty or failed scans do not erase cached records or imply successful deletion. Exports distinguish current observations from cached ones and include deletion checks. Reloading or closing the tab clears this event cache; only the remembered public npub remains in localStorage.

Above the table, NIP-05 addresses from retrieved kind-0 profiles are checked against their domains and labeled as verified, mismatched, missing, or unable to check. Older profile claims are distinguished from the latest retrieved profile. Checks use HTTPS without redirects or credentials and time out after eight seconds; up to 20 addresses are checked per search. This is not a global reverse lookup of every address associated with a key. Default relays include `wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`.

## Content filters and previews

The kind menu includes every kind discovered in the current results. Encryption filters combine with relay, kind, and content filters.

Known encrypted kinds and substantial Base64 binary payloads appear under Encrypted. Binary payloads are labeled “Likely encrypted”: binary is not proof of encryption, and Unencrypted means not recognized rather than guaranteed plaintext.

Readable Base64 is previewed as text without changing the original event. Binary payloads remain available in event details. The app does not decrypt content.

## Signing

Successful NIP-07 and NIP-46 connections automatically start loading events from the selected relays for the signer's public key. The search runs independently of the remote-signer connection timeout. Importing an nsec still leaves the search under manual control.

After a successful NIP-07 or NIP-46 connection, only the public `npub` is saved in localStorage and used to prefill the search field on the next visit. Disconnect keeps this public browsing preference. Restoring it does not reconnect a signer or start a relay search. Secret keys, bunker URLs, and signing sessions are never persisted. Invalid stored values and unavailable storage are ignored.

- NIP-07: uses the provider at `window.nostr`, including providers supplied by native app browsers.
- NIP-46: accepts a `bunker://` URL; creates an ephemeral client key and requests approval through the remote signer. HTTPS authorization links are displayed for the user to open.
- nsec: imported into memory for the current tab only. No localStorage, cookies, analytics, or server submission. Disconnect wipes the byte buffer; JavaScript cannot guarantee erasure of all runtime copies. Reload drops the session.
- Read-only browsing: enter an npub or hexadecimal public key.

Every deletion checks ownership, validates source event signatures, creates a kind-5 request with exact `e` and `k` tags, and verifies that the signer returned the precise approved template. Requests are sent only after the review action. No automatic deletion on scan.

Deletion requests and follow-up checks go only to observed source relays within the current relay selection. Events are grouped by identical destination sets before splitting into batches of up to 100, so no relay receives deletion IDs for events not observed there. Cached source observations count; deletion receipts and prior check results do not establish a source. If any selected event has no eligible source relay, nothing is sent.

## Coverage and limits

- Up to 12 user-selected secure WebSocket relays, 20 pages per relay, 500 requested events per page, and 12-second query timeouts. Time-boundary pagination stops conservatively when it cannot advance without potentially skipping events; the UI reports incomplete coverage.
- Results are deduplicated by verified event ID, retaining each source relay. Relay responses are not proof of complete archives. Relays may discard prior replaceable versions or impose hidden limits.
- Relay authentication is not yet implemented. NIP-42 challenges are surfaced as authentication required. NIP-46 signing does not itself grant relay access.
- Deletion is NIP-09 best effort. Relay acknowledgment and subsequent ID queries are shown separately. No global erasure guarantee. The signed request is included in subsequent exports as a receipt.
- Requests target exact IDs, not address-wide deletion. Selections larger than 100 are split into batches automatically. Kind-5 requests cannot themselves be selected for deletion.
- Encrypted events are not decrypted. Gift-wrapped DMs are not a complete authored-message archive because their outer authors differ.
- Notes signed by other keys, including service-signed Nostroots reposts, are outside this identity's deletion authority. No Nostroots service integration is included yet.
- Discovery from NIP-65 relay lists, nostrconnect QR pairing, and mnemonic import are not implemented.

The example uses clearly marked synthetic data and cannot publish deletion requests. The app renders relay content as text, not HTML. Searching reveals the queried public key and your IP to the selected relays.
