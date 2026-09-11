import './style.css';
import './table.css';
import { createIdentityPanel } from './nip05.js';
import { nip19, generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import {publicKey,relayURLs,category,kindName,deletionTemplate,assertSigned,query,publish} from './core.js';
const $=id=>document.getElementById(id);
const updateIdentityPanel = createIdentityPanel(document.querySelector('.toolbar'));
document.querySelector('.brand').href = './';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const footer=el('footer',undefined,'source-footer');
const source=el('a');source.href='https://github.com/guaka/nostrfootprint';source.setAttribute('aria-label','Nostr Footprint source on GitHub');
source.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.3c0 .32.22.7.83.58A12 12 0 0 0 24 12.5c0-6.63-5.37-12-12-12z"/></svg><span>GitHub</span>';
const licenseLink=el('a','AGPL-3.0');licenseLink.href='https://github.com/guaka/nostrfootprint/blob/main/LICENSE';
const built=el('time',`Built ${__BUILD_TIME__.slice(0,16).replace('T',' ')} UTC`);built.dateTime=__BUILD_TIME__;
footer.append(source,licenseLink,built);document.body.append(footer);
let records=new Map(),coverage=new Map(),selected=new Set(),owner='',signer=null,signerKey='',secret=null,remote=null,controller=null,busy=false,demo=false,reviewSnapshot=[];
const short=s=>s.slice(0,12)+'…'+s.slice(-6);
const date=t=>new Date(t*1000).toISOString().slice(0,16).replace('T',' ')+' UTC';
const say=text=>$('notice').textContent=text;
updateIdentityPanel(records, owner, demo);
function visible(){return [...records.values()].filter(r=>($('kind').value==='all'||category(r.event.kind)===$('kind').value)&&r.event.content.toLowerCase().includes($('search').value.toLowerCase())).sort((a,b)=>b.event.created_at-a.event.created_at);}
function render(){
  updateIdentityPanel(records, owner, demo);
  $('count').textContent=records.size;$('relay-count').textContent=coverage.size;$('selected-count').textContent=selected.size;
  $('delete').textContent=`Review deletion · ${selected.size}`;$('delete').disabled=!selected.size||busy||demo;
  $('scan').disabled=busy;$('demo').disabled=busy;$('connect').disabled=busy;$('identity').disabled=busy;$('relays').disabled=busy;$('stop').hidden=!controller;
  $('coverage').replaceChildren();for(const[url,c]of coverage){const row=el('div',undefined,'relay');row.append(el('strong',new URL(url).host),el('span',`${c.count} events · ${c.status}`));if(c.deletion)row.append(el('span',c.deletion));$('coverage').append(row);}
  const rows=visible();$('select-all').checked=rows.some(r=>r.event.kind!==5)&&rows.filter(r=>r.event.kind!==5).every(r=>selected.has(r.event.id));$('select-all').disabled=busy;
  $('events').replaceChildren();if(!rows.length){const empty=el('div',undefined,'empty');empty.append(el('h3',records.size?'No matching results':'Nothing found yet'),el('p',records.size?'Try another filter.':'Search a public key or explore the example. Empty or incomplete relay results do not prove there is no data.'));$('events').append(empty);}
  if (!rows.length) return;
  const table=el('table',undefined,'events-table'),head=el('thead'),headers=el('tr'),body=el('tbody');
  table.append(el('caption','Published events and the relays that returned them','sr-only'));
  for(const label of ['Select','Published (UTC)','Type','Content / details','Relay(s)']){const th=el('th',label);th.scope='col';headers.append(th);}
  head.append(headers);table.append(head,body);
  const scroller=el('div',undefined,'table-scroll');scroller.tabIndex=0;scroller.setAttribute('role','region');scroller.setAttribute('aria-label','Published events table');scroller.append(table);$('events').append(scroller);
  for(const r of rows){
    const e=r.event,row=el('tr',undefined,'event'),selection=el('td'),check=el('input');
    check.type='checkbox';check.checked=selected.has(e.id);check.disabled=busy||e.kind===5;check.setAttribute('aria-label',`Select ${kindName(e.kind)} ${short(e.id)}`);
    check.onchange=()=>{check.checked?selected.add(e.id):selected.delete(e.id);render();};selection.append(check);
    const published=el('td',undefined,'event-date'),time=el('time',date(e.created_at).replace(' UTC',''));time.dateTime=new Date(e.created_at*1000).toISOString();published.append(time);
    const type=el('td');type.append(el('span',kindName(e.kind),'badge'));
    const contentCell=el('td',undefined,'event-text');
    const content=category(e.kind)==='messages'?'Encrypted content. This view does not decrypt messages.':(e.content||'(No text content)');contentCell.append(el('p',content.length>300?content.slice(0,300)+'…':content,'event-content'));
    const details=el('details');details.append(el('summary',`Event details · ${short(e.id)}`),el('pre',JSON.stringify(e,null,2)));contentCell.append(details);
    if(r.check)contentCell.append(el('p',r.check,'small'));
    const relaysCell=el('td',undefined,'event-relays');
    if(r.relays.size){const list=el('ul');for(const relay of [...r.relays].sort())list.append(el('li',relay));relaysCell.append(list);}else relaysCell.append(el('span','Not observed on a relay','muted'));
    row.append(selection,published,type,contentCell,relaysCell);body.append(row);
  }
}
async function scan(){try{const key=publicKey($('identity').value),urls=relayURLs($('relays').value);owner=key;records=new Map();selected.clear();coverage=new Map(urls.map(u=>[u,{count:0,status:'Connecting…'}]));demo=false;busy=true;controller=new AbortController();render();say('Searching selected relays. Each search is bounded; incomplete coverage is shown.');
  await Promise.all(urls.map(async url=>{let until=Math.floor(Date.now()/1000),seen=new Set();
    const profiles = await query(url,{authors:[key],kinds:[0],limit:20},controller.signal);
    for(const event of profiles.events){seen.add(event.id);if(!records.has(event.id))records.set(event.id,{event,relays:new Set()});records.get(event.id).relays.add(url);}
    coverage.get(url).count=seen.size;render();
    for(let page=0;page<20;page++){
    const result=await query(url,{authors:[key],until,limit:500},controller.signal);let added=0;for(const event of result.events){if(!seen.has(event.id)){seen.add(event.id);added++;}if(!records.has(event.id))records.set(event.id,{event,relays:new Set()});records.get(event.id).relays.add(url);}
    let status=result.status;if(status==='Query complete')status=result.events.length?'Searching older events…':'No older events returned';coverage.set(url,{count:seen.size,status});render();
    if(result.status!=='Query complete'||!result.events.length)break;
    const oldest=Math.min(...result.events.map(e=>e.created_at));
    // Include the boundary second again: never silently skip ties at a page edge.
    if(!added||oldest===until){coverage.get(url).status='Pagination boundary reached; coverage may be incomplete';break;}
    until=oldest;if(page===19)coverage.get(url).status='20-page limit reached; coverage incomplete';
  }}));say('Search finished. Results reflect what the queried relays returned, not every copy on Nostr.');
}catch(e){say(e.message);}finally{busy=false;controller=null;render();}}
$('scan').onclick=scan;$('stop').onclick=()=>controller?.abort();$('kind').onchange=render;$('search').oninput=render;
$('select-all').onchange=()=>{for(const r of visible())if(r.event.kind!==5){$('select-all').checked?selected.add(r.event.id):selected.delete(r.event.id);}render();};
function download(items,name){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),pubkey:owner,example:demo,coverage:[...coverage].map(([relay,status])=>({relay,...status})),events:items.map(r=>({event:r.event,found_on:[...r.relays]}))},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download([...records.values()],'nostr-data.json');$('export-selected').onclick=()=>download(reviewSnapshot,'nostr-selection.json');
$('delete').onclick=()=>{reviewSnapshot=[...selected].map(id=>records.get(id));$('review-items').replaceChildren(...reviewSnapshot.map(r=>el('li',`${kindName(r.event.kind)} · ${date(r.event.created_at)} · ${short(r.event.id)}`)));$('review-copy').textContent=`Request deletion of ${reviewSnapshot.length} selected events on ${coverage.size} queried relays. The request is public and cannot be undone.`;$('review-status').textContent='';$('reason').value='';$('review').showModal();};
$('confirm').onclick=async()=>{let signed;const button=$('confirm');button.disabled=true;busy=true;render();try{
  if(!signer)throw new Error('Close this review and connect a signer first. Your selection will be kept.');
  const key=publicKey(await signer.getPublicKey());if(key!==owner)throw new Error('The connected signer does not match the public key you searched.');
  const template=deletionTemplate(reviewSnapshot.map(r=>r.event),key,$('reason').value);
  $('review-status').textContent='Waiting for signature approval…';signed=await signer.signEvent(template);assertSigned(signed,template,key);
  $('review-status').textContent='Sending deletion request and checking selected IDs…';
  await Promise.all([...coverage.keys()].map(async url=>{const ack=await publish(url,signed);const check=await query(url,{ids:reviewSnapshot.map(r=>r.event.id)});const returned=new Set(check.events.map(e=>e.id));coverage.get(url).deletion=`${ack} · ${check.status==='Query complete'?`${returned.size} selected events still returned`:'Could not verify: '+check.status}`;
    for(const r of reviewSnapshot){const status=returned.has(r.event.id)?'Still returned':check.status==='Query complete'?'Not returned on recheck':'Could not check';r.check=(r.check?r.check+' · ':'')+`${new URL(url).host}: ${status}`;}render();}));
  // Keep the signed request available as a receipt without mixing it into the selection.
  records.set(signed.id,{event:signed,relays:new Set()});selected.clear();$('review-status').textContent='Finished. See per-relay results. Export results to keep the signed deletion request as a receipt.';say('Deletion request sent. Relay acknowledgment and read-back results are shown separately.');
}catch(e){$('review-status').textContent=e.message;}finally{busy=false;button.disabled=false;render();}};
const connection=el('dialog');connection.id='connection';connection.innerHTML='<form method="dialog"><button class="close" aria-label="Close">×</button></form><h2>Connect a signer</h2><p>Choose how to approve deletion requests.</p><button id="extension">Browser extension · NIP-07</button><hr><label for="bunker">Remote signer · NIP-46</label><input id="bunker" type="password" placeholder="bunker://…" autocomplete="off"><button id="remote-connect">Connect remote signer</button><a id="remote-auth" hidden target="_blank" rel="noreferrer">Approve connection with your signer ↗</a><hr><label for="nsec">Secret key · nsec</label><input id="nsec" type="password" placeholder="nsec1…" autocomplete="off" spellcheck="false"><p class="small muted">Held in memory for this tab only. Never saved or sent to relays. Disconnect or reload to clear it. Only use a copy of this app you trust.</p><button id="local-connect">Use this key for this session</button><hr><button id="disconnect">Disconnect</button><p id="connection-status" role="status"></p>';document.body.append(connection);
$('extension').textContent='Use NIP-07 signer';
$('connect').onclick=()=>connection.showModal();
async function disconnect(){secret?.fill(0);secret=null;signer=null;signerKey='';if(remote){await remote.close();remote=null;}$('connect').textContent='Connect signer';$('nsec').value='';$('bunker').value='';}
async function accept(candidate,label){const key=publicKey(await candidate.getPublicKey());if(label==='Remote signer'&&remote!==candidate)throw new Error('Remote connection was cancelled.');signer=candidate;signerKey=key;$('identity').value=nip19.npubEncode(key);$('connect').textContent=`${label} · ${short(key)}`;connection.close();say('Signer connected. Search to view this identity’s published data.');}
$('disconnect').onclick=async()=>{await disconnect();connection.close();say('Signer disconnected. Public search results remain in this tab.');};
$('extension').onclick=async()=>{try{if(!window.nostr)throw new Error('No NIP-07 provider found at window.nostr. Open this page in a browser or app with a NIP-07 signer.');await disconnect();await accept(window.nostr,'NIP-07');}catch(e){$('connection-status').textContent=e.message;}};
$('local-connect').onclick=async()=>{try{const value=$('nsec').value.trim();$('nsec').value='';const decoded=nip19.decode(value);if(decoded.type!=='nsec')throw new Error('Enter an nsec secret key.');await disconnect();secret=decoded.data;getPublicKey(secret);await accept({getPublicKey:async()=>getPublicKey(secret),signEvent:async t=>finalizeEvent(t,secret)},'Session key');}catch{secret?.fill(0);secret=null;$('connection-status').textContent='Could not import that nsec. Check your key.';}};
$('remote-connect').onclick=async()=>{const button=$('remote-connect');button.disabled=true;let timer;try{const raw=$('bunker').value.trim();$('bunker').value='';if(!raw.startsWith('bunker://'))throw new Error('Enter a bunker:// connection URL from your remote signer.');const pointer=await parseBunkerInput(raw);if(!pointer)throw new Error('Invalid bunker connection URL.');relayURLs(pointer.relays.join('\n'));await disconnect();remote=BunkerSigner.fromBunker(generateSecretKey(),pointer,{onauth:url=>{try{const parsed=new URL(url);if(parsed.protocol!=='https:')return;$('remote-auth').href=parsed.href;$('remote-auth').hidden=false;}catch{}}});$('connection-status').textContent='Waiting for your remote signer…';const candidate=remote;await Promise.race([(async()=>{await candidate.connect();await accept(candidate,'Remote signer');})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Remote signer timed out. Try again.')),45000);})]);}catch(e){await disconnect();$('connection-status').textContent=e.message;}finally{clearTimeout(timer);button.disabled=false;}};
$('demo').onclick=()=>{demo=true;owner='example';selected.clear();coverage=new Map([['wss://relay.damus.io/',{count:3,status:'Example only'}],['wss://nos.lol/',{count:2,status:'Example only'}]]);records=new Map();const examples=[{kind:1,content:'A spare room in Porto this weekend. Happy to host a fellow traveler — send me a message.',days:2},{kind:30397,content:'A quiet spot by the river, just outside town. Good place to stop for lunch.',days:14},{kind:1,content:'Taking the slow route south. Anyone heading toward Lisbon next week?',days:45},{kind:10002,content:'',days:70}];examples.forEach((e,i)=>{const event={id:String(i+1).padStart(64,'0'),pubkey:'example',created_at:Math.floor(Date.now()/1000)-e.days*86400,kind:e.kind,tags:[],content:e.content,sig:'example'};records.set(event.id,{event,relays:new Set(i<2?[...coverage.keys()]:[[...coverage.keys()][0]])});});say('Example data — no relay connections. Deletion is disabled.');render();};
document.modelContext?.registerTool({name:'inspect_search_results',description:'Read current public search results and per-relay coverage. Does not connect or sign.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({pubkey:owner,example:demo,coverage:[...coverage],events:[...records.values()].map(r=>({event:r.event,relays:[...r.relays]}))})});
