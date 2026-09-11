import { test, expect } from '@playwright/test';
import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';

test('incoming pages keep checkbox nodes, focus, open details, and selection stable', async ({page}) => {
  const sk=generateSecretKey(),pk=getPublicKey(sk);
  const first=finalizeEvent({kind:1,created_at:200,tags:[],content:'First note'},sk);
  const second=finalizeEvent({kind:1,created_at:100,tags:[],content:'Later batch'},sk);
  await page.addInitScript(({first,second}) => {
    let pages=0;
    window.pendingQueries=[];
    window.WebSocket=class {
      readyState=1;
      constructor(){queueMicrotask(()=>this.onopen?.());}
      send(raw){
        const [kind,id,filter]=JSON.parse(raw); if(kind!=='REQ')return;
        const respond=events=>{
          for(const event of events)this.onmessage?.({data:JSON.stringify(['EVENT',id,event])});
          this.onmessage?.({data:JSON.stringify(['EOSE',id])});
        };
        if(filter.kinds)queueMicrotask(()=>respond([]));
        else if(pages++===0)queueMicrotask(()=>respond([first]));
        else window.pendingQueries.push(()=>respond(pages===2?[second]:[]));
      }
      close(){this.readyState=3;}
    };
  },{first,second});
  await page.goto('/'); await page.locator('.setup summary').click(); await page.locator('#relays').fill('wss://example.com');
  await page.locator('#identity').fill(pk); await page.locator('#identity').press('Enter');
  const checkbox=page.locator('tbody input[type=checkbox]').first();
  await expect(checkbox).toBeEnabled();
  await page.locator('tbody details summary').click();
  await checkbox.focus();
  await page.evaluate(()=>{window.originalCheckbox=document.querySelector('tbody input');});
  // Simulate a relay page arriving between pointer-down and pointer-up.
  const box=await checkbox.boundingBox(); await page.mouse.move(box.x+8,box.y+8); await page.mouse.down();
  await expect.poll(()=>page.evaluate(()=>window.pendingQueries.length)).toBe(1);
  await page.evaluate(()=>window.pendingQueries.shift()());
  await expect(page.locator('#count')).toHaveText('2');
  expect(await page.evaluate(()=>window.originalCheckbox===document.querySelector('tbody input'))).toBe(true);
  await page.mouse.up(); await expect(checkbox).toBeChecked(); await expect(checkbox).toBeFocused();
  await expect(page.locator('tbody details')).toHaveAttribute('open','');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('#select-all').check();
  await page.getByRole('button',{name:'Show 1 new event',exact:true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody tr').nth(1).getByRole('checkbox')).not.toBeChecked();
  await expect(page.locator('#selected-count')).toHaveText('1');
  await page.locator('#delete').click();
  await expect(page.locator('#review')).toBeVisible();
  await expect(page.locator('#review-items li')).toHaveCount(1);
  await expect(page.locator('#scan')).toBeEnabled();
  // A new scan shows the old observation immediately and keeps its selection.
  await page.locator('#review .close').click(); await page.locator('#scan').click();
  await expect(page.locator('tbody tr').first().getByRole('checkbox')).toBeChecked();
  await expect(page.locator('tbody tr').first()).toContainText('Cached');
  await page.locator('#stop').click();
});

test('a rescan retains deletion results without treating the cache as live evidence', async ({page}) => {
  const sk=generateSecretKey(),pk=getPublicKey(sk);
  const event=finalizeEvent({kind:1,created_at:100,tags:[],content:'Deleted note'},sk);
  await page.exposeFunction('testSign',template=>finalizeEvent(template,sk));
  await page.addInitScript(({event,pk})=>{
    let deleted=false; window.reappear=false;
    window.nostr={getPublicKey:async()=>pk,signEvent:t=>window.testSign(t)};
    window.WebSocket=class {
      readyState=1;constructor(){queueMicrotask(()=>this.onopen?.());}
      send(raw){const [kind,id,filter]=JSON.parse(raw);queueMicrotask(()=>{
        if(kind==='REQ'){
          if(!filter.kinds&&(!deleted||window.reappear))this.onmessage?.({data:JSON.stringify(['EVENT',id,event])});
          this.onmessage?.({data:JSON.stringify(['EOSE',id])});
        }
        if(kind==='EVENT'){deleted=true;this.onmessage?.({data:JSON.stringify(['OK',id.id,true,''])});}
      });}
      close(){}
    };
  },{event,pk});
  await page.goto('/');await page.locator('.setup summary').click();await page.locator('#relays').fill('wss://example.com');
  await page.locator('#connect').click();await page.locator('#extension').click();
  await expect(page.locator('#count')).toHaveText('1');await expect(page.locator('#scan')).toBeEnabled();
  await page.locator('#select-all').check();await page.locator('#delete').click();await page.locator('#confirm').click();
  await expect(page.locator('tr[data-deletion=removed]')).toContainText('Deleted note');
  await page.getByRole('button',{name:'View results in table'}).click();
  await page.locator('#scan').click();await expect(page.locator('#scan')).toBeEnabled();
  await expect(page.locator('tr[data-deletion=removed]')).toContainText('Cached');
  await expect(page.locator('tr[data-deletion=removed]')).toContainText('Checked');
  await page.evaluate(()=>{window.reappear=true;});
  await page.locator('#scan').click();await expect(page.locator('#scan')).toBeEnabled();
  await expect(page.locator('tr[data-deletion=present]')).toContainText('Still on 1 relay');
  await expect(page.locator('tr[data-deletion=present] .cached-observation')).toBeHidden();
});
