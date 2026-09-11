import './style.css';
import './table.css';
import { deleteInBatches, DELETION_BATCH_SIZE } from './delete-batches.js';
import { EventCache, observeEvent } from './event-cache.js';
import { createEventTable } from './event-table.js';
import { rememberIdentity, restoreIdentity } from './remembered-identity.js';
import { deletionStatus } from './deletion-status.js';
import { createIdentityPanel } from './nip05.js';
import { nip19, generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import {publicKey,relayURLs,category,kindName,deletionTemplate,assertSigned,query,publish} from './core.js';
const $=id=>document.getElementById(id);
$('identity').value = restoreIdentity();
const updateIdentityPanel = createIdentityPanel(document.querySelector('.toolbar'));
document.querySelector('.brand').href = './';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const footer=el('footer',undefined,'source-footer');
const source=el('a');source.href='https://github.com/guaka/nostrfootprint';source.setAttribute('aria-label','Nostr Footprint source on GitHub');
source.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 24 12.5c0-6.63-5.37-12-12-12z"/></svg>';
const licenseLink=el('a','AGPL-3.0');licenseLink.href='https://github.com/guaka/nostrfootprint/blob/main/LICENSE';
const built=el('time',`${__BUILD_TIME__.slice(0,16).replace('T',' ')} UTC`);built.dateTime=__BUILD_TIME__;
footer.append(source,licenseLink,built);document.body.append(footer);
let records=new Map(),coverage=new Map(),selected=new Set(),owner='',signer=null,signerKey='',secret=null,remote=null,controller=null,busy=false,demo=false,reviewSnapshot=[];
const short=s=>s.slice(0,12)+'…'+s.slice(-6);
const date=t=>new Date(t*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
const say=text=>$('notice').textContent=text;
updateIdentityPanel(records, owner, demo);
let sortColumn = 'published', sortDirection = 'descending';
const textOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
function compareRows(a, b) {
  let order;
  if (sortColumn === 'published') order = a.event.created_at - b.event.created_at;
  else if (sortColumn === 'type') order = textOrder.compare(kindName(a.event.kind), kindName(b.event.kind));
  else if (sortColumn === 'content') order = textOrder.compare(a.event.content, b.event.content);
  else order = textOrder.compare([...a.relays].sort().join('\n'), [...b.relays].sort().join('\n'));
  return (sortDirection === 'ascending' ? order : -order) || a.event.id.localeCompare(b.event.id);
}
const eventCache = new EventCache();
let scanId = 0, displayedRecords = null, displayOrder = [];
const arrivals = el('div', undefined, 'new-events');
const showNew = el('button');
showNew.type = 'button';
showNew.onclick = () => {
  displayOrder = [...records.keys()].sort((a,b) => compareRows(records.get(a),records.get(b)));
  render();
};
arrivals.append(showNew);
$('events').before(arrivals);
const cacheHint = el('p', undefined, 'small muted');
arrivals.before(cacheHint);
const selectMatching = el('button');
selectMatching.type = 'button'; selectMatching.id = 'select-matching';
$('delete').before(selectMatching);
selectMatching.onclick = () => {
  for(const record of records.values()) if(record.event.kind!==5 && matchesFilters(record)) selected.add(record.event.id);
  displayOrder = [...records.keys()].sort((a,b) => compareRows(records.get(a),records.get(b)));
  render();
};
const renderTable = createEventTable($('events'), (id, checked) => {
  if (busy && !controller) return;
  checked ? selected.add(id) : selected.delete(id);
  render();
}, key => {
  sortDirection = sortColumn === key && sortDirection === 'ascending' ? 'descending' : 'ascending';
  sortColumn = key;
  displayOrder.sort((a,b) => compareRows(records.get(a), records.get(b)));
  render();
});
render();
function visible() {
  return displayOrder.map(id => records.get(id)).filter(r => r && matchesFilters(r));
}
function matchesFilters(record) {
  return ($('kind').value==='all'||category(record.event.kind)===$('kind').value) &&
    record.event.content.toLowerCase().includes($('search').value.toLowerCase());
}
function render() {
  if (displayedRecords !== records) { displayedRecords = records; displayOrder = []; }
  if (!displayOrder.length && records.size) {
    displayOrder = [...records.keys()].sort((a,b) => compareRows(records.get(a),records.get(b)));
  }
  updateIdentityPanel(records, owner, demo);
  $('count').textContent = records.size;
  $('relay-count').textContent = coverage.size;
  $('selected-count').textContent = selected.size;
  $('delete').textContent = controller && selected.size ? 'Stop search to review deletion' : `Review deletion · ${selected.size}`;
  $('delete').disabled = !selected.size || (busy && !controller) || demo;
  $('scan').disabled = busy; $('demo').disabled = busy; $('connect').disabled = busy;
  $('identity').disabled = busy; $('relays').disabled = busy; $('stop').hidden = !controller;
  $('coverage').replaceChildren();
  for (const [url,c] of coverage) {
    const row = el('div',undefined,'relay');
    row.append(el('strong',new URL(url).host),el('span',`${c.count} events · ${c.status}`));
    if(c.deletion) row.append(el('span',c.deletion));
    $('coverage').append(row);
  }
  const rows = visible(), selectable = rows.filter(r => r.event.kind !== 5);
  const matchingCount = [...records.values()].filter(r => r.event.kind!==5 && matchesFilters(r)).length;
  selectMatching.hidden = matchingCount <= selectable.length;
  selectMatching.textContent = `Select all ${matchingCount} matching events`;
  selectMatching.disabled = busy && !controller;
  const selectedVisible = selectable.filter(r => selected.has(r.event.id)).length;
  $('select-all').checked = selectable.length > 0 && selectedVisible === selectable.length;
  $('select-all').indeterminate = selectedVisible > 0 && selectedVisible < selectable.length;
  $('select-all').disabled = (busy && !controller) || !selectable.length;
  const pending = records.size - displayOrder.length;
  showNew.hidden = pending === 0;
  showNew.textContent = `Show ${pending} new ${pending === 1 ? 'event' : 'events'}`;
  showNew.disabled = busy && !controller;
  const cached = [...records.values()].filter(r => !r.receipt && r.seenIn !== scanId).length;
  cacheHint.hidden = demo || (!cached && !controller);
  cacheHint.textContent = [
    cached ? `${cached} cached observations. Previous deletion checks are retained; cached entries do not confirm current relay contents.` : '',
    controller ? 'Select rows while searching. New events wait until you choose to show them.' : ''
  ].filter(Boolean).join(' ');
  renderTable({ rows, selected, locked:busy && !controller, sortColumn, sortDirection, scanId, total:records.size, demo });
}
let activeScan = null;
async function runScan() {
  try {
    const key = publicKey($('identity').value), urls = relayURLs($('relays').value);
    if (key !== owner || demo) selected.clear();
    owner = key; records = eventCache.forIdentity(key);
    for (const id of selected) if (!records.has(id)) selected.delete(id);
    scanId++;
    coverage = new Map(urls.map(u => [u,{count:0,status:'Connecting…'}]));
    demo = false; busy = true; controller = new AbortController();
    const signal = controller.signal;
    render();
    say('Refreshing selected relays. Cached observations remain visible while fresh results arrive.');
    await Promise.all(urls.map(async url => {
      let until = Math.floor(Date.now()/1000), seen = new Set();
      const profiles = await query(url,{authors:[key],kinds:[0],limit:20},signal);
      for (const event of profiles.events) { seen.add(event.id); observeEvent(records,event,url,scanId); }
      coverage.get(url).count = seen.size; render();
      for (let page=0;page<20;page++) {
        const result = await query(url,{authors:[key],until,limit:500},signal);
        let added=0;
        for (const event of result.events) {
          if (!seen.has(event.id)) { seen.add(event.id); added++; }
          observeEvent(records,event,url,scanId);
        }
        let status=result.status;
        if(status==='Query complete') status=result.events.length?'Searching older events…':'No older events returned';
        coverage.set(url,{count:seen.size,status}); render();
        if(result.status!=='Query complete'||!result.events.length) break;
        const oldest=Math.min(...result.events.map(e=>e.created_at));
        if(!added||oldest===until) { coverage.get(url).status='Pagination boundary reached; coverage may be incomplete'; break; }
        until=oldest;
        if(page===19) coverage.get(url).status='20-page limit reached; coverage incomplete';
      }
    }));
    say(signal.aborted ? 'Search stopped. Your selections and results were kept.' : 'Search finished. Show new events when ready; your selections are unchanged.');
  } catch(e) { say(e.message); }
  finally { busy=false; controller=null; render(); }
}
async function scan() {
  if (busy) return;
  activeScan = runScan();
  try { await activeScan; } finally { activeScan = null; }
}
$('scan').onclick=scan;$('stop').onclick=()=>controller?.abort();$('kind').onchange=render;$('search').oninput=render;
$('identity').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing&&!busy){event.preventDefault();$('scan').click();}});
$('select-all').onchange=()=>{for(const r of visible())if(r.event.kind!==5){$('select-all').checked?selected.add(r.event.id):selected.delete(r.event.id);}render();};
function download(items,name){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),pubkey:owner,example:demo,coverage:[...coverage].map(([relay,status])=>({relay,...status})),events:items.map(r=>({event:r.event,found_on:[...r.relays],returned_this_search:r.seenIn===scanId,deletion_checks:r.deletion}))},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download([...records.values()],'nostr-data.json');$('export-selected').onclick=()=>download(reviewSnapshot,'nostr-selection.json');
let reviewRemaining = [], stopBatches = false;
const batchProgress = el('progress');
batchProgress.id = 'deletion-progress'; batchProgress.hidden = true;
batchProgress.setAttribute('aria-label','Deletion batch progress');
$('review-status').before(batchProgress);
const stopBatchButton = el('button','Stop after this batch');
stopBatchButton.type = 'button'; stopBatchButton.hidden = true;
$('confirm').before(stopBatchButton);
stopBatchButton.onclick = () => {
  stopBatches = true; stopBatchButton.disabled = true;
  stopBatchButton.textContent = 'Stopping after this batch…';
};
const reviewStates = new Map();
function renderReviewResults() {
  $('review-items').replaceChildren(...reviewSnapshot.map(record => {
    const item = el('li'), state = reviewStates.get(record.event.id);
    const outcome = state === 'checked' ? deletionStatus(record) : null;
    const label = outcome?.label || (state === 'signing' ? 'Waiting for signature…' : state === 'active' ? 'Sending and checking…' : 'Not sent yet');
    item.append(el('span',`${kindName(record.event.kind)} · ${record.event.content.slice(0,90)||short(record.event.id)}`),
      el('div',label,`deletion-badge deletion-${outcome?.state||'pending'}`));
    return item;
  }));
}
$('delete').onclick = async () => {
  if(controller) { controller.abort(); await activeScan; }
  if(!selected.size) return;
  reviewSnapshot = [...selected].map(id => records.get(id));
  reviewRemaining = [...reviewSnapshot]; reviewStates.clear();
  const batchCount = Math.ceil(reviewSnapshot.length / DELETION_BATCH_SIZE);
  $('confirm').dataset.complete = ''; $('confirm').textContent = 'Approve with signer';
  batchProgress.hidden = true; stopBatchButton.hidden = true;
  $('review-items').replaceChildren(...reviewSnapshot.map(r => el('li',`${kindName(r.event.kind)} · ${date(r.event.created_at)} · ${short(r.event.id)}`)));
  $('review-copy').textContent = `Request deletion of ${reviewSnapshot.length} selected events on ${coverage.size} queried relays, in ${batchCount} ${batchCount===1?'batch':'batches'}. Your signer may ask for approval for each batch. The requests are public and cannot be undone.`;
  $('review-status').textContent = ''; $('reason').value = ''; $('review').showModal();
};
$('confirm').onclick = async () => {
  const button = $('confirm');
  if(button.dataset.complete) { $('review').close(); document.querySelector('.table-scroll')?.scrollIntoView({behavior:'smooth',block:'start'}); return; }
  button.disabled = true; busy = true; stopBatches = false; $('reason').disabled = true; render();
  try {
    if(!signer) throw new Error('Close this review and connect a signer first. Your selection will be kept.');
    const key = publicKey(await signer.getPublicKey());
    if(key!==owner) throw new Error('The connected signer does not match the public key you searched.');
    const total = reviewRemaining.length;
    batchProgress.max = total; batchProgress.value = 0; batchProgress.hidden = false;
    stopBatchButton.hidden = total <= DELETION_BATCH_SIZE;
    stopBatchButton.disabled = false; stopBatchButton.textContent = 'Stop after this batch';
    renderReviewResults();
    const result = await deleteInBatches({
      records:reviewRemaining, pubkey:key, signer, relays:[...coverage.keys()], reason:$('reason').value,
      shouldStop:() => stopBatches,
      onReceipt:signed => records.set(signed.id,{event:signed,relays:new Set(),receipt:true}),
      onProgress:progress => {
        const phase = progress.stage === 'signing' ? 'Waiting for signature' : 'Sending and checking';
        $('review-status').textContent = `Batch ${progress.index+1} of ${progress.batches} · ${progress.completed}/${progress.total} events processed. ${phase}…`;
        batchProgress.value = progress.completed;
        for(const record of progress.current) reviewStates.set(record.event.id,
          progress.stage === 'signing' ? 'signing' : progress.stage === 'completed' ? 'checked' : 'active');
        if(progress.stage === 'completed') for(const record of progress.current) selected.delete(record.event.id);
        if(progress.relay) coverage.get(progress.relay).deletion =
          `Batch ${progress.index+1}/${progress.batches}: ${progress.ack} · ${progress.checkStatus==='Query complete' ? progress.returned+' events still returned' : 'Could not verify'}`;
        renderReviewResults(); render();
      },
    });
    reviewRemaining = result.remaining;
    for(const record of reviewRemaining) reviewStates.set(record.event.id,'queued');
    renderReviewResults();
    const counts = {removed:0,present:0,unknown:0};
    for(const record of reviewSnapshot) if(reviewStates.get(record.event.id)==='checked') counts[deletionStatus(record).state]++;
    const summary = `${counts.removed} no longer returned · ${counts.present} still present · ${counts.unknown} not fully verified`;
    if(reviewRemaining.length) {
      $('review-status').textContent = `Stopped. ${summary}. ${reviewRemaining.length} events not sent; they remain selected. ${result.error||''}`;
      button.textContent = `Continue remaining ${reviewRemaining.length} events`;
    } else {
      $('review-status').textContent = `Finished. ${summary}. Results cover checked relays only; other copies may exist.`;
      button.dataset.complete = 'true'; button.textContent = 'View results in table';
    }
    say($('review-status').textContent);
  } catch(error) { $('review-status').textContent = error.message; }
  finally { busy = false; button.disabled = false; $('reason').disabled = false; stopBatchButton.hidden = true; render(); }
};
const connection=el('dialog');connection.id='connection';connection.innerHTML='<form method="dialog"><button class="close" aria-label="Close">×</button></form><h2>Connect a signer</h2><p>Choose how to approve deletion requests.</p><button id="extension">Browser extension · NIP-07</button><hr><label for="bunker">Remote signer · NIP-46</label><input id="bunker" type="password" placeholder="bunker://…" autocomplete="off"><button id="remote-connect">Connect remote signer</button><a id="remote-auth" hidden target="_blank" rel="noreferrer">Approve connection with your signer ↗</a><hr><label for="nsec">Secret key · nsec</label><input id="nsec" type="password" placeholder="nsec1…" autocomplete="off" spellcheck="false"><p class="small muted">Held in memory for this tab only. Never saved or sent to relays. Disconnect or reload to clear it. Only use a copy of this app you trust.</p><button id="local-connect">Use this key for this session</button><hr><button id="disconnect">Disconnect</button><p id="connection-status" role="status"></p>';document.body.append(connection);
$('extension').textContent='Use NIP-07 signer';
$('connect').onclick=()=>connection.showModal();
async function disconnect(){secret?.fill(0);secret=null;signer=null;signerKey='';if(remote){await remote.close();remote=null;}$('connect').textContent='Connect signer';$('nsec').value='';$('bunker').value='';}
async function accept(candidate,label){const key=publicKey(await candidate.getPublicKey());if(label==='Remote signer'&&remote!==candidate)throw new Error('Remote connection was cancelled.');signer=candidate;signerKey=key;const npub=nip19.npubEncode(key);rememberIdentity(npub,label);$('identity').value=npub;$('connect').textContent=`${label} · ${short(npub)}`;connection.close();say('Signer connected. Search to view this identity’s published data.');}
$('disconnect').onclick=async()=>{await disconnect();connection.close();say('Signer disconnected. Public search results remain in this tab.');};
$('extension').onclick=async()=>{try{if(!window.nostr)throw new Error('No NIP-07 provider found at window.nostr. Open this page in a browser or app with a NIP-07 signer.');await disconnect();await accept(window.nostr,'NIP-07');}catch(e){$('connection-status').textContent=e.message;}};
$('local-connect').onclick=async()=>{try{const value=$('nsec').value.trim();$('nsec').value='';const decoded=nip19.decode(value);if(decoded.type!=='nsec')throw new Error('Enter an nsec secret key.');await disconnect();secret=decoded.data;getPublicKey(secret);await accept({getPublicKey:async()=>getPublicKey(secret),signEvent:async t=>finalizeEvent(t,secret)},'Session key');}catch{secret?.fill(0);secret=null;$('connection-status').textContent='Could not import that nsec. Check your key.';}};
$('remote-connect').onclick=async()=>{const button=$('remote-connect');button.disabled=true;let timer;try{const raw=$('bunker').value.trim();$('bunker').value='';if(!raw.startsWith('bunker://'))throw new Error('Enter a bunker:// connection URL from your remote signer.');const pointer=await parseBunkerInput(raw);if(!pointer)throw new Error('Invalid bunker connection URL.');relayURLs(pointer.relays.join('\n'));await disconnect();remote=BunkerSigner.fromBunker(generateSecretKey(),pointer,{onauth:url=>{try{const parsed=new URL(url);if(parsed.protocol!=='https:')return;$('remote-auth').href=parsed.href;$('remote-auth').hidden=false;}catch{}}});$('connection-status').textContent='Waiting for your remote signer…';const candidate=remote;await Promise.race([(async()=>{await candidate.connect();await accept(candidate,'Remote signer');})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Remote signer timed out. Try again.')),45000);})]);}catch(e){await disconnect();$('connection-status').textContent=e.message;}finally{clearTimeout(timer);button.disabled=false;}};
$('demo').onclick=()=>{demo=true;owner='example';selected.clear();coverage=new Map([['wss://relay.damus.io/',{count:3,status:'Example only'}],['wss://nos.lol/',{count:2,status:'Example only'}]]);records=new Map();const examples=[{kind:1,content:'A spare room in Porto this weekend. Happy to host a fellow traveler — send me a message.',days:2},{kind:30397,content:'A quiet spot by the river, just outside town. Good place to stop for lunch.',days:14},{kind:1,content:'Taking the slow route south. Anyone heading toward Lisbon next week?',days:45},{kind:10002,content:'',days:70}];examples.forEach((e,i)=>{const event={id:String(i+1).padStart(64,'0'),pubkey:'example',created_at:Math.floor(Date.now()/1000)-e.days*86400,kind:e.kind,tags:[],content:e.content,sig:'example'};records.set(event.id,{event,relays:new Set(i<2?[...coverage.keys()]:[[...coverage.keys()][0]])});});say('Example data — no relay connections. Deletion is disabled.');render();};
document.modelContext?.registerTool({name:'inspect_search_results',description:'Read current public search results and per-relay coverage. Does not connect or sign.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({pubkey:owner,example:demo,coverage:[...coverage],events:[...records.values()].map(r=>({event:r.event,relays:[...r.relays]}))})});
