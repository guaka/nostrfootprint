import { nip19, verifyEvent } from 'nostr-tools';
export function publicKey(raw) {
  const value = raw.trim().replace(/^nostr:/i, '');
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  if (!/^npub1/i.test(value)) throw new Error('Enter an npub or a public key in hex. Never enter a secret key.');
  const decoded = nip19.decode(value);
  if (decoded.type !== 'npub') throw new Error('A public key is required.');
  return decoded.data;
}
export function relayURLs(raw) {
  const urls = [...new Set(raw.split(/\s+/).filter(Boolean).map(value => {
    const url = new URL(value);
    if (url.protocol !== 'wss:' || url.username || url.password || url.hash) throw new Error('Use secure wss:// relay URLs without credentials or fragments.');
    return url.href;
  }))];
  if (!urls.length || urls.length > 12) throw new Error('Choose between 1 and 12 relays.');
  return urls;
}
export function category(kind) {
  if ([1,30023,30397,30398].includes(kind)) return 'notes';
  if ([4,1059].includes(kind)) return 'messages';
  if ([0,3].includes(kind) || (kind >= 10000 && kind < 20000)) return 'metadata';
  return 'other';
}
export function kindName(kind) { return ({0:'Profile',1:'Note',3:'Following list',4:'Encrypted message',5:'Deletion request',7:'Reaction',10002:'Relay list',1059:'Gift wrap',30023:'Article',30397:'Map note',30398:'Verified map note'})[kind] || `Event kind ${kind}`; }
export function deletionTemplate(events, pubkey, reason = '', now = Math.floor(Date.now()/1000)) {
  if (!events.length || events.length > 100) throw new Error('Select between 1 and 100 events per request.');
  if (events.some(e => e.pubkey !== pubkey || e.kind === 5 || !verifyEvent(e))) throw new Error('Only verified events signed by this identity can be deleted. Deletion requests cannot be undone.');
  return {kind:5,created_at:now,content:reason,tags:[...events.map(e=>['e',e.id]), ...[...new Set(events.map(e=>e.kind))].map(k=>['k',String(k)])]};
}
export function assertSigned(signed, template, pubkey) {
  if (signed.pubkey !== pubkey || signed.kind !== template.kind || signed.created_at !== template.created_at || signed.content !== template.content || JSON.stringify(signed.tags) !== JSON.stringify(template.tags) || !verifyEvent(signed)) throw new Error('The signer returned an unexpected or invalid event. Nothing was published.');
}
export function query(url, filter, signal, timeout = 12000) {
  return new Promise(resolve => {
    let ws; const events = new Map(); const id = crypto.randomUUID(); let settled = false;
    const done = (status) => { if(settled)return; settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(ws?.readyState===1)ws.send(JSON.stringify(['CLOSE',id]));ws?.close();resolve({events:[...events.values()],status}); };
    const abort=()=>done('Stopped; coverage incomplete'); const timer=setTimeout(()=>done('Timed out; coverage incomplete'),timeout);
    if(signal?.aborted){abort();return;} signal?.addEventListener('abort',abort,{once:true});
    try { ws=new WebSocket(url); } catch {done('Connection failed');return;}
    ws.onopen=()=>ws.send(JSON.stringify(['REQ',id,filter]));
    ws.onerror=()=>done('Connection failed');ws.onclose=()=>done('Disconnected; coverage incomplete');
    ws.onmessage=({data})=>{try {if(typeof data!=='string'||data.length>2000000)return;const m=JSON.parse(data);if(m[0]==='AUTH'){done('Authentication required');return;}if(m[1]!==id)return;
      if(m[0]==='EVENT'){const e=m[2];if(filter.authors&&!filter.authors.includes(e.pubkey))return;if(filter.kinds&&!filter.kinds.includes(e.kind))return;if(filter.ids&&!filter.ids.includes(e.id))return;if(filter.until!==undefined&&e.created_at>filter.until)return;if(events.size<2000&&verifyEvent(e))events.set(e.id,e);}
      if(m[0]==='EOSE')done('Query complete');if(m[0]==='CLOSED')done(`Restricted: ${String(m[2]).slice(0,150)}`);
    }catch{ /* Untrusted relay messages are ignored. */ }};
  });
}
export function publish(url,event) {
  return new Promise(resolve=>{let ws;let settled=false;const finish=status=>{if(settled)return;settled=true;clearTimeout(timer);ws?.close();resolve(status);};const timer=setTimeout(()=>finish('No acknowledgment'),12000);
    try{ws=new WebSocket(url);}catch{finish('Connection failed');return;}
    ws.onopen=()=>ws.send(JSON.stringify(['EVENT',event]));ws.onerror=()=>finish('Connection failed');ws.onclose=()=>finish('Disconnected before acknowledgment');
    ws.onmessage=({data})=>{try{const m=JSON.parse(data);if(m[0]==='AUTH')finish('Authentication required');if(m[0]==='OK'&&m[1]===event.id)finish(m[2]===true?'Request accepted':`Request rejected: ${String(m[3]).slice(0,150)}`);}catch{}};
  });
}
