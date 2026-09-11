export function parseAddress(value) {
  if (typeof value !== 'string' || value.length > 320) return null;
  const match = /^([a-z0-9_.-]+)@([a-z0-9.-]+)$/i.exec(value.trim());
  if (!match) return null;
  const [, name, rawDomain] = match;
  const domain = rawDomain.toLowerCase();
  if (!domain.includes('.') || domain.split('.').some(part => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part))) return null;
  return { address: `${name}@${domain}`, name, url: `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}` };
}

export async function verifyAddress(claim, pubkey, signal, fetcher = fetch) {
  try {
    const response = await fetcher(claim.url, { signal, redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) return `Could not check (HTTP ${response.status})`;
    const data = await response.json();
    const mapped = data?.names && Object.hasOwn(data.names, claim.name) ? data.names[claim.name] : undefined;
    if (mapped === pubkey) return 'Verified for this public key';
    if (typeof mapped === 'string' && /^[a-f0-9]{64}$/.test(mapped)) return 'Maps to a different public key';
    return 'Address not found in domain response';
  } catch { return 'Could not check (network, browser access, redirect, or timeout)'; }
}

export function createIdentityPanel(before) {
  const section = document.createElement('section');
  section.className = 'identity-panel';
  section.setAttribute('aria-label', 'NIP-05 addresses');
  before.before(section);
  let currentRecords, generation = 0, requests = [], states = new Map();
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  return function update(records, owner, demo) {
    if (records !== currentRecords) {
      requests.forEach(c => c.abort()); requests = []; states = new Map(); currentRecords = records; generation++;
    }
    const profiles = [...records.values()].map(r => r.event).filter(e => e.kind === 0 && e.pubkey === owner).sort((a,b) => b.created_at - a.created_at || a.id.localeCompare(b.id));
    const claims = new Map();
    for (const profile of profiles) {
      try { const claim = parseAddress(JSON.parse(profile.content).nip05); if (claim && !claims.has(claim.address)) claims.set(claim.address, { ...claim, current: profile.id === profiles[0].id }); } catch {}
    }
    section.replaceChildren(node('h2', 'NIP-05 addresses'));
    const explanation = node('p', 'Addresses claimed in profile events found on the queried relays. Domain checks confirm whether each address currently points to this public key; other addresses may exist.');
    explanation.className = 'muted'; section.append(explanation);
    if (!claims.size) { section.append(node('p', owner ? 'No NIP-05 addresses found in the retrieved profiles.' : 'Search a public key to find its profile addresses.')); return; }
    const list = document.createElement('ul'); section.append(list);
    for (const claim of claims.values()) {
      const item = document.createElement('li');
      item.append(node('strong', claim.address), node('span', claim.current ? 'Latest retrieved profile' : 'Older retrieved profile'));
      const status = node('span', states.get(claim.address) || (demo ? 'Example only' : 'Checking domain…'));
      item.append(status); list.append(item);
      if (!demo && !states.has(claim.address)) {
        if (states.size >= 20) { status.textContent = 'Not checked (20-address limit)'; continue; }
        states.set(claim.address, 'Checking domain…');
        const version = generation, controller = new AbortController(); requests.push(controller);
        const timer = setTimeout(() => controller.abort(), 8000);
        verifyAddress(claim, owner, controller.signal).then(result => {
          if (version === generation) { states.set(claim.address, result); update(records, owner, demo); }
        }).finally(() => clearTimeout(timer));
      }
    }
  };
}
