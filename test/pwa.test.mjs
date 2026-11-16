import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sw = readFileSync(path.join(dist, 'sw.js'), 'utf8');
const currentCache = sw.match(/const CACHE = '([^']+)'/)[1];
function setup(options = {}) {
  const listeners = {};
  const deleted = [];
  const stored = [];
  let shell;
  const context = {
    URL, Request, Response,
    self: {location: {origin:'https://bolso.test',href:'https://bolso.test/sw.js'}, skipWaiting:async()=>{}, clients:{claim:async()=>{}}, addEventListener:(name,fn)=>listeners[name]=fn},
    caches: {open: async()=>({addAll:async assets=>{shell=assets},put:async(key,response)=>stored.push({key,response}),match:async request=>options.cached?.(request)}), keys:async()=>['other-app-v1','bolso-shell-v0',currentCache], delete:async key=>deleted.push(key)},
    fetch: options.fetch || (async request=>({network:request}))
  };
  vm.runInNewContext(sw, context);
  return {listeners, deleted, stored, get shell(){return shell}};
}
test('service worker installs a complete locally present application shell', async()=>{
  const worker=setup(); let done;
  worker.listeners.install({waitUntil:p=>done=p}); await done;
  for(const asset of worker.shell) {
    assert.equal(asset.cache,'reload');
    const filename=new URL(asset.url).pathname.slice(1);
    assert(existsSync(path.join(dist,filename)), 'Missing precache asset: '+filename);
  }
  const offline=worker.stored.find(item=>item.key==='./index.html');
  assert(offline);
  assert.equal(await offline.response.text(),readFileSync(path.join(dist,'index.html'),'utf8'));
});
test('activation preserves unrelated caches',async()=>{
  const worker=setup();let done;
  worker.listeners.activate({waitUntil:p=>done=p}); await done;
  assert.deepEqual(worker.deleted,['bolso-shell-v0']);
});
test('service worker does not intercept external resources or write requests',()=>{
  const worker=setup(); let intercepted=false;
  const respondWith=()=>intercepted=true;
  worker.listeners.fetch({request:{url:'https://external.test/x',method:'GET'},respondWith});
  worker.listeners.fetch({request:{url:'https://bolso.test/x',method:'POST'},respondWith});
  assert.equal(intercepted,false);
});
test('manifest icons and start page exist locally',()=>{
  const manifest=JSON.parse(readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.lang,'pt-BR');
  for(const icon of manifest.icons) assert(existsSync(path.join(dist,icon.src)),'Missing icon: '+icon.src);
});
test('cached navigation remains available with network disconnected',async()=>{
  const html = {body:'cached application'};
  const worker=setup({cached:key=>key==='./index.html'?html:undefined,fetch:async()=>{throw new Error('offline')}});
  let response;
  worker.listeners.fetch({request:{url:'https://bolso.test/',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await response,html);
});

test('online navigation fetches a fresh document instead of replaying cached hosting checks',async()=>{
  const request={url:'https://bolso.test/',method:'GET',mode:'navigate'};
  const stale={body:'cached old hosting verification'};
  const fresh={body:'fresh hosting verification and application'};
  const worker=setup({cached:()=>stale,fetch:async received=>{assert.equal(received,request);return fresh}});
  let response;
  worker.listeners.fetch({request,respondWith:p=>response=p});
  assert.equal(await response,fresh);
  assert.equal(worker.stored.length,0);
});

test('online HTTP errors are returned normally rather than hiding host security responses',async()=>{
  const challenge=new Response('Verification required',{status:403});
  const worker=setup({cached:()=>({body:'offline app'}),fetch:async()=>challenge});
  let response;
  worker.listeners.fetch({request:{url:'https://bolso.test/',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await response,challenge);
});

test('offline shell contains the app source and versioned assets, not hosted verification code',async()=>{
  const worker=setup();let done;
  worker.listeners.install({waitUntil:p=>done=p});await done;
  const html=await worker.stored.find(item=>item.key==='./index.html').response.text();
  assert.match(html,new RegExp('app\\.js\\?v='+currentCache.split('-v')[1]));assert.match(html,new RegExp('appearance\\.css\\?v='+currentCache.split('-v')[1]));
  assert.doesNotMatch(html,/challenge-platform|__CF\$cv|<iframe/);
});
test('cached scripts remain available with network disconnected',async()=>{
  const request={url:'https://bolso.test/app.js',method:'GET',mode:'cors'};
  const script={body:'cached script'};
  const worker=setup({cached:key=>key===request?script:undefined,fetch:async()=>{throw new Error('offline')}});
  let response;
  worker.listeners.fetch({request,respondWith:p=>response=p});
  assert.equal(await response,script);
});
test('uncached same-origin resource falls back to network',async()=>{
  const request={url:'https://bolso.test/new.png',method:'GET',mode:'cors'};
  const worker=setup(); let response;
  worker.listeners.fetch({request,respondWith:p=>response=p});
  assert.equal((await response).network,request);
});
test('HTML has installation, accessible language and responsive metadata',()=>{
  const html=readFileSync(path.join(dist,'index.html'),'utf8');
  assert.match(html,/<html lang="pt-BR"/);
  assert.match(html,/name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html,/rel="manifest"/);
  assert.match(html,/name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html,/rel="apple-touch-icon"/);
  assert.match(html,/aria-label="Navegação principal"/);
  assert.match(html,/aria-live="polite"/);
});
