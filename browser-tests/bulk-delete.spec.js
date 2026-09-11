import {test,expect} from '@playwright/test';
import {generateSecretKey,getPublicKey,finalizeEvent} from 'nostr-tools';
test('bulk review processes 205 events in batches and resumes after a signer decline',async({page})=>{
  const sk=generateSecretKey(),pk=getPublicKey(sk);
  const events=Array.from({length:205},(_,i)=>finalizeEvent({kind:1,created_at:100+i,tags:[],content:`Bulk note ${i}`},sk));
  let signatures=0;
  await page.exposeFunction('testSign',t=>{if(++signatures===2)throw new Error('Declined');return finalizeEvent(t,sk);});
  await page.addInitScript(({pk,events})=>{
    window.nostr={getPublicKey:async()=>pk,signEvent:t=>window.testSign(t)};
    const deleted=new Set();window.publishedSizes=[];
    window.WebSocket=class{
      readyState=1;constructor(){queueMicrotask(()=>this.onopen?.());}
      send(raw){const [kind,id,filter]=JSON.parse(raw);queueMicrotask(()=>{
        if(kind==='REQ'){
          if(!filter.kinds)for(const e of events)if(!deleted.has(e.id)&&(!filter.ids||filter.ids.includes(e.id))&&(!filter.until||e.created_at<=filter.until))this.onmessage?.({data:JSON.stringify(['EVENT',id,e])});
          this.onmessage?.({data:JSON.stringify(['EOSE',id])});
        }
        if(kind==='EVENT'){const ids=id.tags.filter(t=>t[0]==='e').map(t=>t[1]);window.publishedSizes.push(ids.length);ids.forEach(e=>deleted.add(e));this.onmessage?.({data:JSON.stringify(['OK',id.id,true,''])});}
      });}
      close(){}
    };
  },{pk,events});
  await page.goto('/');await page.locator('.setup summary').click();await page.locator('#relays').fill('wss://example.com');
  await page.locator('#connect').click();await page.locator('#extension').click();
  await expect(page.locator('#count')).toHaveText('205');await expect(page.locator('#scan')).toBeEnabled();
  await page.locator('#select-all').check();await page.locator('#delete').click();
  await expect(page.locator('#review-copy')).toContainText('205 selected events');await expect(page.locator('#review-copy')).toContainText('3 batches');
  await page.locator('#confirm').click();
  await expect(page.locator('#review-status')).toContainText('105 events not sent');
  await expect(page.locator('#selected-count')).toHaveText('105');
  await page.getByRole('button',{name:'Continue remaining 105 events'}).click();
  await expect(page.locator('#review-status')).toContainText('205 no longer returned');
  await expect(page.locator('#selected-count')).toHaveText('0');
  expect(await page.evaluate(()=>window.publishedSizes)).toEqual([100,100,5]);
});
