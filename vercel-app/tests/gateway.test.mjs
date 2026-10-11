import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGateway} from '../lib/gateway.mjs';
const backendUrl='https://noor-portraits-backend.jincharadzeshako.workers.dev';
const base={backendUrl,backendToken:'test-only-not-a-real-credential'};
const req=(path='/api/catalog', options={})=>new Request('https://noor.example'+path,options);

test('missing credentials fail closed without calling the upstream',async()=>{
 let called=false;
 const response=await createGateway({...base,backendToken:undefined,fetcher:async()=>{called=true;}})(req());
 assert.equal(response.status,503); assert.equal(called,false);
});
test('only the selected HTTPS backend can receive credentials',async()=>{
 for(const url of ['https://noor-portrait-studio.navyforses.chatgpt.site','https://noor-portraits-backend.jincharadzeshako.workers.dev:8443','https://attacker.example','http://noor-portraits-backend.jincharadzeshako.workers.dev','https://user:pass@noor-portraits-backend.jincharadzeshako.workers.dev','https://noor-portraits-backend.jincharadzeshako.workers.dev/other']){
  const response=await createGateway({...base,backendUrl:url})(req());assert.equal(response.status,503);
 }
});
test('cross-origin writes and privileged maintenance are blocked',async()=>{
 const gateway=createGateway(base);
 assert.equal((await gateway(req('/api/orders',{method:'POST',headers:{origin:'https://attacker.example'},body:'{}'}))).status,403);
 assert.equal((await gateway(req('/api/maintenance'))).status,403);
 assert.equal((await gateway(req('/api/files%2fsecret'))).status,400);
});
test('credentials stay server-side and only NOOR cookies are forwarded',async()=>{
 const gateway=createGateway({...base,fetcher:async(url,options)=>{
  assert.equal(url.origin,backendUrl);
  assert.equal(options.headers.get('X-NOOR-Gateway-Token'),base.backendToken);
  assert.equal(options.headers.get('cookie'),'noor_order=customer-session; noor_measure=consent-session');
  assert.equal(options.headers.get('authorization'),null);
  return Response.json({mode:'demo'},{headers:{'X-NOOR-Gateway-Token':'should-never-leak','Set-Cookie':'unrelated=private'}});
 }});
 const response=await gateway(req('/api/catalog',{headers:{cookie:'vercel_secret=private; noor_order=customer-session; noor_measure=consent-session',authorization:'Bearer browser-value','X-NOOR-Gateway-Token':'browser-value'}}));
 assert.equal(response.headers.get('X-NOOR-Gateway-Token'),null);assert.equal(response.headers.get('set-cookie'),null);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{mode:'demo'});
});
test('same-origin writes preserve body, session cookies and deployment-local links',async()=>{
 const gateway=createGateway({...base,fetcher:async(url,options)=>{
  assert.equal(options.headers.get('origin'),backendUrl);assert.equal(new TextDecoder().decode(options.body),'{}');
  return Response.json({link:backendUrl+'/ka/access#test-link'},{headers:{'Set-Cookie':'noor_order=new-session; HttpOnly; Secure; SameSite=Strict; Path=/'}});
 }});
 const response=await gateway(req('/api/orders',{method:'POST',headers:{origin:'https://noor.example'},body:'{}'}));
 assert.equal(response.headers.get('set-cookie'),'noor_order=new-session; HttpOnly; Secure; SameSite=Strict; Path=/');
 assert.equal((await response.json()).link,'https://noor.example/ka/access#test-link');
});
test('upstream login redirects and network errors never become successful API responses',async()=>{
 for(const fetcher of [async()=>Response.redirect('https://login.example'),async()=>{throw Error('contains-secret')}]){
  const response=await createGateway({...base,fetcher})(req());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'storage_unavailable'});
 }
});
test('upload request limit matches the Vercel gateway boundary',async()=>{
 const gateway=createGateway(base);
 assert.equal((await gateway(req('/api/orders/test/upload',{method:'POST',headers:{origin:'https://noor.example','content-length':'4000001'},body:'x'}))).status,413);
});
test('relative links and malformed JSON fail safely without leaking upstream details',async()=>{
 const relative=await createGateway({...base,fetcher:async()=>Response.json({link:'/ka/access#token'})})(req());
 assert.equal(relative.status,200);assert.equal((await relative.json()).link,'/ka/access#token');
 const foreign=await createGateway({...base,fetcher:async()=>Response.json({link:'https://other.example/x'})})(req());
 assert.equal((await foreign.json()).link,'https://other.example/x');
 const broken=await createGateway({...base,fetcher:async()=>new Response('{not json',{headers:{'content-type':'application/json'}})})(req());
 assert.equal(broken.status,503);assert.deepEqual(await broken.json(),{error:'storage_unavailable'});
});
