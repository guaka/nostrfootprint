import {test,expect} from '@playwright/test';
import {generateSecretKey,getPublicKey,finalizeEvent,nip19} from 'nostr-tools';
test('profile addresses appear above the table with domain verification',async({page})=>{
  const sk=generateSecretKey(),pk=getPublicKey(sk);
  const profiles=['alice@example.com','old@example.com'].map((nip05,i)=>finalizeEvent({kind:0,created_at:200-i,content:JSON.stringify({nip05}),tags:[]},sk));
  await page.addInitScript(({profiles})=>{window.WebSocket=class{readyState=1;constructor(){queueMicrotask(()=>this.onopen?.());}send(raw){const m=JSON.parse(raw);if(m[0]!=='REQ')return;queueMicrotask(()=>{for(const e of profiles)this.onmessage?.({data:JSON.stringify(['EVENT',m[1],e])});this.onmessage?.({data:JSON.stringify(['EOSE',m[1]])});});}close(){}};},{profiles});
  await page.route('https://example.com/.well-known/nostr.json?*',route=>route.fulfill({json:{names:{alice:pk,old:'b'.repeat(64)}}}));
  await page.goto('/');await expect(page.locator('#relays')).toHaveValue(/relay\.trustroots\.org/);await expect(page.locator('#relays')).toHaveValue(/relay\.nomadwiki\.org/);
  await page.locator('#identity').fill(pk);await page.locator('#scan').click();
  const panel=page.getByRole('region',{name:'NIP-05 addresses'});
  await expect(panel).toContainText('alice@example.com');await expect(panel).toContainText('Verified for this public key');await expect(panel).toContainText('Maps to a different public key');await expect(panel).toContainText('Older retrieved profile');
});
test('example, filters, responsive layout and signer choices',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore an example'}).click();await expect(page.locator('#count')).toHaveText('4');await page.locator('#kind').selectOption('metadata');await expect(page.locator('.event')).toHaveCount(1);await page.getByRole('button',{name:'Connect signer',exact:true}).click();await expect(page.getByRole('button',{name:'Use NIP-07 signer'})).toBeVisible();await page.locator('#connection .close').click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
for(const mode of ['nsec','nip7'])test(`${mode}: review, sign, publish and recheck using simulated relays`,async({page})=>{
  const sk=generateSecretKey(),pk=getPublicKey(sk),event=finalizeEvent({kind:1,created_at:100,content:'My test note',tags:[]},sk);
  await page.exposeFunction('testSign',template=>finalizeEvent(template,sk));
  await page.addInitScript(({event,pk})=>{window.nostr={getPublicKey:async()=>pk,signEvent:t=>window.testSign(t)};let deleted=false;window.WebSocket=class{readyState=1;constructor(){queueMicrotask(()=>this.onopen?.());}send(raw){const m=JSON.parse(raw);queueMicrotask(()=>{if(m[0]==='REQ'){if(!deleted)this.onmessage?.({data:JSON.stringify(['EVENT',m[1],event])});this.onmessage?.({data:JSON.stringify(['EOSE',m[1]])});}if(m[0]==='EVENT'){deleted=true;this.onmessage?.({data:JSON.stringify(['OK',m[1].id,true,''])});}});}close(){}};},{event,pk});
  await page.goto('/');await page.locator('#connect').click();if(mode==='nsec'){await page.locator('#nsec').fill(nip19.nsecEncode(sk));await page.locator('#local-connect').click();}else await page.locator('#extension').click();
  await page.locator('#scan').click();await expect(page.locator('#count')).toHaveText('1');await expect(page.locator('#scan')).toBeEnabled();await page.locator('#select-all').check();await page.locator('#delete').click();await expect(page.locator('#review')).toBeVisible();await page.locator('#confirm').click();await expect(page.locator('#review-status')).toContainText('Finished.');await expect(page.locator('#coverage')).toContainText('Request accepted');await expect(page.locator('#events')).toContainText('Not returned on recheck');expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});
