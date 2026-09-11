import { category, kindName } from './core.js';
import { deletionStatus } from './deletion-status.js';
import { readableBase64 } from './readable-base64.js';
import { encryptionState } from './encryption-filter.js';

const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const short = id => `${id.slice(0,12)}…${id.slice(-6)}`;
const date = timestamp => new Date(timestamp).toISOString().slice(0,16).replace('T',' ');

export function createEventTable(container, onSelect, onSort) {
  const scroller = node('div', undefined, 'table-scroll');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'Published events table');
  const table = node('table', undefined, 'events-table');
  table.append(node('caption', 'Published events and the relays that returned them', 'sr-only'));
  const head = node('thead'), headers = node('tr'), body = node('tbody');
  const controls = new Map(), rowNodes = new Map();
  for (const [key, label] of [['','Select'],['published','Published (UTC)'],['type','Type'],['content','Content / details'],['relays','Relay(s)']]) {
    const th = node('th'); th.scope = 'col';
    if (!key) th.textContent = label;
    else {
      const button = node('button', undefined, 'sort-button');
      button.type = 'button'; button.dataset.sort = key;
      const arrow = node('span'); arrow.setAttribute('aria-hidden', 'true');
      button.append(document.createTextNode(`${label} `), arrow);
      button.onclick = () => onSort(key);
      th.append(button); controls.set(key, { th, button, arrow, label });
    }
    headers.append(th);
  }
  head.append(headers); table.append(head, body); scroller.append(table);
  const empty = node('div', undefined, 'empty');
  const emptyTitle = node('h3'), emptyCopy = node('p'); empty.append(emptyTitle, emptyCopy);
  container.replaceChildren(scroller, empty);

  function makeRow(record) {
    const event = record.event, row = node('tr', undefined, 'event'); row.dataset.eventId = event.id;
    const selection = node('td'), check = node('input'); check.type = 'checkbox';
    check.setAttribute('aria-label', `Select ${kindName(event.kind)} ${short(event.id)}`);
    check.onchange = () => onSelect(event.id, check.checked);
    selection.append(check);
    const published = node('td', undefined, 'event-date');
    const time = node('time', date(event.created_at * 1000)); time.dateTime = new Date(event.created_at * 1000).toISOString(); published.append(time);
    const type = node('td'); type.append(node('span', kindName(event.kind), 'badge'));
    const contentCell = node('td', undefined, 'event-text');
    const status = node('div'), cached = node('p', undefined, 'cached-observation');
    const encryption = encryptionState(event);
    const content = encryption === 'likely'
      ? 'Likely encrypted content · Base64-encoded binary. Raw payload in event details.'
      : encryption === 'encrypted'
        ? 'Encrypted content. This view does not decrypt messages.'
        : event.content || '(No text content)';
    contentCell.append(status, cached, node('p', content.length > 300 ? content.slice(0,300) + '…' : content, 'event-content'));
    const decoded = readableBase64(event.content);
    if (decoded !== null) {
      contentCell.append(node('div', 'Decoded Base64 · not decrypted', 'small muted'),
        node('p', decoded.length > 300 ? decoded.slice(0,300) + '…' : decoded, 'event-content decoded-content'));
      if (decoded.length > 300) {
        const fullDecoded = node('details');
        fullDecoded.append(node('summary', 'Full decoded text'), node('pre', decoded));
        contentCell.append(fullDecoded);
      }
    }
    const details = node('details');
    details.append(node('summary', `Event details · ${short(event.id)}`), node('pre', JSON.stringify(event,null,2)));
    contentCell.append(details);
    const relays = node('td', undefined, 'event-relays');
    row.append(selection, published, type, contentCell, relays);
    return { row, check, status, cached, relays, relaySignature: '' };
  }

  return function update({ rows, selected, locked, sortColumn, sortDirection, scanId, total, demo }) {
    for (const [key, control] of controls) {
      const active = key === sortColumn;
      control.th.setAttribute('aria-sort', active ? sortDirection : 'none');
      control.arrow.textContent = active ? (sortDirection === 'ascending' ? '↑' : '↓') : '↕';
      control.button.title = `Sort ${control.label} ${active && sortDirection === 'ascending' ? 'descending' : 'ascending'}`;
    }
    scroller.hidden = !rows.length; empty.hidden = !!rows.length;
    emptyTitle.textContent = total ? 'No matching results' : 'Nothing found yet';
    emptyCopy.textContent = total ? 'Try another filter or show newly found events.' : 'Search a public key or explore the example. Empty or incomplete relay results do not prove there is no data.';
    const wanted = new Set(rows.map(r => r.event.id));
    for (const [id, parts] of rowNodes) if (!wanted.has(id)) { parts.row.remove(); rowNodes.delete(id); }
    let position = body.firstElementChild;
    for (const record of rows) {
      const id = record.event.id;
      if (!rowNodes.has(id)) rowNodes.set(id, makeRow(record));
      const parts = rowNodes.get(id), outcome = deletionStatus(record);
      parts.check.checked = selected.has(id); parts.check.disabled = locked || record.event.kind === 5;
      parts.status.hidden = !outcome;
      if (outcome) {
        parts.row.dataset.deletion = outcome.state;
        parts.status.className = `deletion-badge deletion-${outcome.state}`;
        parts.status.textContent = outcome.label;
      } else delete parts.row.dataset.deletion;
      parts.cached.hidden = demo || record.seenIn === scanId || record.receipt;
      parts.cached.textContent = 'Cached · not returned in this search yet';
      const signature = JSON.stringify([[...record.relays].sort(), record.deletion]);
      if (parts.relaySignature !== signature) {
        parts.relaySignature = signature;
        const urls = [...new Set([...record.relays, ...Object.keys(record.deletion || {})])].sort();
        parts.relays.replaceChildren();
        if (!urls.length) parts.relays.append(node('span', 'Not observed on a relay', 'muted'));
        else {
          const list = node('ul');
          for (const url of urls) {
            const item = node('li', url), result = record.deletion?.[url];
            if (result) {
              const labels = { pending:'Checking…', removed:'Not returned on recheck', present:'Still returned', unknown:'Could not check' };
              item.append(node('span', labels[result.state], `relay-check deletion-${result.state}`));
              if (result.ack) item.append(node('span', result.ack, 'relay-ack'));
              if (result.checkedAt) item.append(node('span', `Checked ${date(result.checkedAt)} UTC`, 'relay-ack'));
            }
            list.append(item);
          }
          parts.relays.append(list);
        }
      }
      // Reuse the same checkbox/details nodes. Only explicit sorting/revealing
      // changes their order; normal incoming batches leave them in place.
      if (parts.row !== position) body.insertBefore(parts.row, position);
      position = parts.row.nextElementSibling;
    }
  };
}
