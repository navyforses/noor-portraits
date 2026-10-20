const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

// Render the actual client components on the server without executing effects or bank requests.
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const originalLoad=Module._load;
Module._load=function(id,parent,...rest){if(id==='next/navigation')return {useRouter:()=>({push(){}})};return originalLoad.call(this,id,parent,...rest)};
const Studio=require('../components/studio.tsx').default;
const {merchantDetails,policyRoutes}=require('../lib/merchant.ts');
const {PaymentDetails,PolicyLinks}=require('../components/payment-details.tsx');
const {dueForDeletion}=require('../lib/core.ts');
const root=path.resolve(__dirname,'..');

test('empty and whitespace merchant settings resolve to the supplied legal identity',()=>{
 const s=merchantDetails({companyName:' ',address:'',supportEmail:'',registration:'',phone:''},'ka');
 assert.equal(s.companyName,'ი/მ შალვა ჯინჭარაძე');assert.equal(s.registration,'60001147948');assert.equal(s.supportEmail,'jincharadzeshako@gmail.com');assert.equal(s.phone,'+995 555 145 719');
 assert.equal(merchantDetails({supportEmail:'support@example.com'},'en').supportEmail,'support@example.com');
});
for(const locale of ['ar','en','ka']){
 const t=require('../locales/'+locale+'.json');
 test(locale+': all six policies and contact render with merchant details and complete local links',()=>{
  for(const route of [...policyRoutes,'contact']){
   const html=renderToStaticMarkup(React.createElement(Studio,{locale,path:[route]}));
   assert.ok(html.includes('<h1>'+t[route]+'</h1>'),route);
   assert.ok(html.includes('60001147948'));assert.ok(html.includes('mailto:jincharadzeshako@gmail.com'));assert.ok(html.includes('tel:+995555145719'));
   for(const p of policyRoutes)assert.ok(html.includes('href="/'+locale+'/'+p+'"'));
   assert.ok(!/\{(?:email|aiProcessing|u|r|g|d)\}/.test(html));
   assert.ok(!/Draft policy|Legal review required|not ready for paid sales|provisional/i.test(html));
   assert.ok(html.includes('dir="'+(locale==='ar'?'rtl':'ltr')+'"'));
  }
 });
 test(locale+': checkout has EUR, Georgia, authentic local SVG assets and three consent links',()=>{
  const html=renderToStaticMarkup(React.createElement(PaymentDetails,{t}));
  assert.ok(html.includes(t.merchantCountry));assert.ok(html.includes(t.checkoutCurrency));
  for(const name of ['visa','mastercard','apple-pay','google-pay']){
   assert.ok(html.includes('/payments/'+name+'.svg'));
   const svg=fs.readFileSync(path.join(root,'public/payments',name+'.svg'),'utf8');
   assert.match(svg,/<svg\b/);assert.doesNotMatch(svg,/<script\b/i);
  }
  const links=renderToStaticMarkup(React.createElement(PolicyLinks,{t,locale}));
  for(const p of ['terms','refund','payment-policy'])assert.ok(links.includes('/'+locale+'/'+p));
 });
}
test('retention text covers the real unpaid/refunded/delivered/undelivered branches',()=>{
 const s={unpaidHours:24,referenceDays:1,resultDays:3,undeliveredDays:14};
 const o={created_at:0,delivered_at:null,payment_status:'pending'};
 assert.equal(dueForDeletion(o,'reference',s,24*3600000),true);
 assert.equal(dueForDeletion({...o,payment_status:'refunded'},'result',s,24*3600000),true);
 assert.equal(dueForDeletion({...o,payment_status:'verified'},'result',s,14*86400000),true);
 assert.equal(dueForDeletion({...o,payment_status:'verified'},'result',{...s,undeliveredDays:0},99*86400000),false);
 const delivered={...o,payment_status:'verified',delivered_at:1000};
 assert.equal(dueForDeletion(delivered,'reference',s,1000+86400000),true);
 assert.equal(dueForDeletion(delivered,'result',s,1000+86400000),false);
});
