'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Upload,Trash2,Lock,RefreshCw} from 'lucide-react';
import {Ctx,api,track,packageLabel} from './studio';
import {money} from '../lib/config';

type Draft={version:2;id:string;packageId:string;styles:string[];step:number;entry:string;preferences:{name:string;title:string;description:string;whatsapp:string};email:string;consents:Record<string,boolean>};
type Task={id:string;file:File;state:'queued'|'preparing'|'sending'|'done'|'error';percent:number;error?:string};
const fresh=():Draft=>({version:2,id:'',packageId:'mini',styles:['cinematic'],step:0,entry:'',preferences:{name:'',title:'',description:'',whatsapp:''},email:'',consents:{}});
async function prepare(file:File){
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type))throw Error('photoTypeError');
 if(file.size>20*1024*1024)throw Error('photoSizeError');
 let bitmap:ImageBitmap|undefined;
 try{bitmap=await createImageBitmap(file);if(bitmap.width<64||bitmap.height<64||bitmap.width*bitmap.height>50000000)throw Error('photoDecodeError');
 const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('photoDecodeError')),'image/jpeg',.94));
 }catch(e){if(e instanceof Error&&e.message==='photoDecodeError')throw e;throw Error('photoDecodeError')}finally{bitmap?.close()}
}
function sendPhoto(oid:string,blob:Blob,uploadId:string,progress:(p:number)=>void){return new Promise<any>((resolve,reject)=>{
 const xhr=new XMLHttpRequest();xhr.open('POST','/api/orders/'+oid+'/upload');xhr.setRequestHeader('Content-Type','image/jpeg');xhr.setRequestHeader('X-Upload-Id',uploadId);xhr.timeout=60000;
 xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100))};
 xhr.onload=()=>{try{const b=JSON.parse(xhr.responseText);xhr.status>=200&&xhr.status<300?resolve(b):reject(Error(b.error||'error'))}catch{reject(Error('error'))}};
 xhr.onerror=xhr.ontimeout=()=>reject(Error('error'));xhr.send(blob);
})}
export default function OrderForm({x}:{x:Ctx}){
 const {t,c,l,notify}=x;const live=c.mode==='live';const [d,setD]=useState<Draft>(fresh),[loaded,setLoaded]=useState(false),[photos,setPhotos]=useState<any[]>([]),[tasks,setTasks]=useState<Task[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{let next=fresh();try{const saved=sessionStorage.getItem('noor-draft');if(saved){const old=JSON.parse(saved);next={...next,...old,preferences:{...next.preferences,...old.preferences},consents:{...old.consents},version:2};if(old.version!==2)next.step=old.step<2?0:old.step===2?1:2}
 const q=new URLSearchParams(location.search),entry=q.get('package')+'|'+q.get('style');
 if((q.has('package')||q.has('style'))&&next.entry!==entry){next.entry=entry;next.packageId=q.get('package')||'mini';if(q.has('style'))next.styles=[q.get('style')!];next.step=q.has('style')?1:0}
 }catch{}setD(next);if(next.id)api('orders/'+next.id).then(o=>{if(o.deleted_at||(o.uploadsExpired&&o.payment_status!=='verified')){setD(p=>({...p,id:'',step:1}));setPhotos([]);return}setPhotos(o.uploads);if(!['draft','awaiting_payment'].includes(o.status)){setD(fresh());setPhotos([]);sessionStorage.removeItem('noor-draft')}}).catch(()=>setD(p=>({...p,id:''})));setLoaded(true);track('form_opened',{packageId:next.packageId,styleId:next.styles[0]});},[]);
 useEffect(()=>{if(loaded)try{sessionStorage.setItem('noor-draft',JSON.stringify(d))}catch{}},[d,loaded]);
 useEffect(()=>{if(loaded)heading.current?.focus({preventScroll:true})},[d.step]);
 const pkg=c.packages.find((p:any)=>p.id===d.packageId&&p.active)||c.packages.find((p:any)=>p.active);
 const update=(data:Partial<Draft>)=>setD(prev=>({...prev,...data}));
 const consented=['adult','rights','ai','accept','immediate'].every(k=>d.consents[k]);
 const selectionValid=!!pkg&&d.styles.length===pkg.styles&&new Set(d.styles).size===d.styles.length&&d.styles.every(k=>c.styles.some((s:any)=>s.id===k&&s.active));
 async function ensureOrder(){if(d.id)return d.id;const o=await api('orders',{packageId:pkg.id,locale:l});update({id:o.id,packageId:pkg.id});return o.id}
 const taskUpdate=(id:string,more:Partial<Task>)=>setTasks(p=>p.map(a=>a.id===id?{...a,...more}:a));
 async function process(items:Task[]){
  if(!consented){setError('consentRequired');return}if(!selectionValid){setError('styleValidation');update({step:0});return}
  setBusy(true);setError('');try{const oid=await ensureOrder();await api('orders/'+oid+'/photo-consent',d.consents);track('upload_started',{packageId:pkg.id,styleId:d.styles[0]});
  for(const task of items){taskUpdate(task.id,{state:'preparing',percent:0,error:undefined});try{const blob=await prepare(task.file);taskUpdate(task.id,{state:'sending'});const b=await sendPhoto(oid,blob,task.id,p=>taskUpdate(task.id,{percent:p}));setPhotos(p=>p.some(f=>f.id===b.id)?p:[...p,b]);taskUpdate(task.id,{state:'done',percent:100})}catch(e:any){taskUpdate(task.id,{state:'error',error:e.message});track('upload_failed',{packageId:pkg.id,styleId:d.styles[0]})}}
  }catch(e:any){setError(e.message);items.forEach(a=>taskUpdate(a.id,{state:'error',error:e.message}))}finally{setBusy(false);if(input.current)input.current.value=''}
 }
 async function upload(files:FileList|null){if(!files)return;if(photos.length+files.length>5){setError('photoCount');if(input.current)input.current.value='';return}const items=Array.from(files).map(file=>({id:crypto.randomUUID(),file,state:'queued' as const,percent:0}));setTasks(p=>[...p.filter(a=>a.state==='error'),...items]);await process(items)}
 async function next(){setError('');if(!selectionValid){setError('styleValidation');return}if(d.step===1){if(!consented){setError('consentRequired');return}if(photos.length<3||photos.length>5){setError('photoCount');return}track('upload_set_completed',{packageId:pkg.id,styleId:d.styles[0]})}update({step:d.step+1})}
 async function checkout(e:React.FormEvent){e.preventDefault();if(!consented){setError('consentRequired');update({step:1});return}setBusy(true);setError('');try{const oid=await ensureOrder();const r=await api('orders/'+oid+'/checkout',{...d,packageId:pkg.id,locale:l});sessionStorage.removeItem('noor-draft');if(r.checkoutUrl){window.location.assign(r.checkoutUrl);return}x.go('checkout/'+oid)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 const titles=[t.offerStep,t.photoStep,t.review];
 if(!pkg)return <section className="section"><h1>{t.offerUnavailable}</h1></section>;
 return <section className="section builder quick-builder">
  <div className="builder-heading"><span className="eyebrow">{t.create}</span><h1 ref={heading} tabIndex={-1}>{titles[d.step]}</h1><p>{t.resemblance}</p></div>
  <ol className="progress-steps">{titles.map((title,i)=><li aria-current={i===d.step?'step':undefined} className={i===d.step?'current':i<d.step?'done':''} key={title}><span>{i<d.step?<Check size={16}/>:i+1}</span><b>{title}</b></li>)}</ol>
  <div className="compact-offer"><div><b>{packageLabel(pkg,t)}</b><span>{pkg.count} {t.portraits} · {d.styles.map(k=>(t as any)[k]).join(' · ')}</span></div><strong dir="ltr">{money(pkg.amount,pkg.currency,l)}</strong>{d.step>0&&<button disabled={busy} className="text-button" onClick={()=>update({step:0})}>{t.changeOffer}</button>}</div>
  <div className="builder-layout"><div className="builder-main">{!c.packages.some((p:any)=>p.id===d.packageId&&p.active)&&<p className="notice">{t.offerUnavailable}</p>}
  {d.step===0&&<><div className="style-options">{c.styles.filter((s:any)=>s.active).map((s:any)=><button key={s.id} aria-pressed={d.styles.includes(s.id)} className={d.styles.includes(s.id)?'selected':''} onClick={()=>{const a=pkg.styles===1?[s.id]:d.styles.includes(s.id)?d.styles.filter(k=>k!==s.id):d.styles.length<pkg.styles?[...d.styles,s.id]:d.styles;update({styles:a});track('view_style',{packageId:pkg.id,styleId:s.id})}}><img src={s.image} alt={(t as any)[s.id]}/><span>{(t as any)[s.id]}{d.styles.includes(s.id)&&<Check size={18}/>}</span></button>)}</div><p>{pkg.styles} {t.styles} · {d.styles.length}/{pkg.styles}</p><details className="package-picker" open={pkg.id!=='mini'}><summary>{t.allPackages}</summary><div className="package-options">{c.packages.filter((p:any)=>p.active).map((p:any)=><button key={p.id} aria-pressed={pkg.id===p.id} className={'package-option '+(pkg.id===p.id?'selected':'')} onClick={()=>{update({packageId:p.id,styles:d.styles.slice(0,p.styles)});track('select_package',{packageId:p.id})}}><span><strong>{packageLabel(p,t)}</strong><small>{p.count} {t.portraits} · {p.styles} {t.styles}</small></span><b dir="ltr">{money(p.amount,p.currency,l)}</b></button>)}</div></details></>}
  {d.step===1&&<>
   <div className="photo-guide"><h3>{t.photoTipsTitle}</h3><ul>{[t.photoTipFront,t.photoTipAngle,t.photoTipLight].map(v=><li key={v}><Check size={16}/>{v}</li>)}</ul><p>{t.uploadLimits}</p></div>
   <fieldset className="photo-consents"><legend>{t.consentTitle}</legend>{['adult','rights','ai','accept','immediate'].map(k=><label className="check-label" key={k}><input type="checkbox" checked={!!d.consents[k]} disabled={busy} onChange={e=>update({consents:{...d.consents,[k]:e.target.checked}})}/><span>{k==='accept'?<>{(t as any)[k]} <a target="_blank" rel="noreferrer" href={'/'+l+'/terms'}>{t.terms}</a></>:(t as any)[k]}</span></label>)}<p>{t.consentNote}</p></fieldset>
   <div className={'upload-zone '+(!consented?'upload-locked':'')}><Upload size={30}/><h3>{t.uploadButton}</h3><p>{consented?t.uploadLimits:t.consentRequired}</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={e=>upload(e.target.files)} disabled={busy||photos.length>=5||!consented} aria-label={t.uploadButton}/></div>
   <div className="upload-previews">{photos.map(f=><div key={f.id}><img src={f.url||'/api/files/'+f.id} alt={t.references}/><button aria-label={t.remove} disabled={busy} onClick={async()=>{try{await api('orders/'+d.id+'/remove',{id:f.id});setPhotos(p=>p.filter(a=>a.id!==f.id))}catch(e:any){notify(e.message)}}}><Trash2 size={16}/></button></div>)}</div>
   <div className="upload-tasks" aria-live="polite">{tasks.filter(a=>a.state!=='done').map(a=><div className={'upload-task '+a.state} key={a.id}><span dir="auto">{a.file.name}</span><b>{a.state==='queued'?t.uploadQueued:a.state==='preparing'?t.uploadPreparing:a.state==='sending'?t.uploadSending:t.uploadError}</b>{a.state==='sending'&&<progress value={a.percent} max={100} aria-label={t.uploadSending}/>} {a.state==='error'&&<><p>{(t as any)[a.error||'error']||t.error}</p><button className="text-button" disabled={busy||photos.length>=5||!consented} onClick={()=>process([a])}><RefreshCw size={16}/>{t.uploadRetry}</button><button className="text-button" disabled={busy} onClick={()=>setTasks(p=>p.filter(b=>b.id!==a.id))}>{t.remove}</button></>}</div>)}</div>
   <p className="photo-count"><Check size={17}/>{photos.length} / 5 · {photos.length>=3?t.photosReady:t.photoCount}</p>
  </>}
  {d.step===2&&<form id="checkout-form" onSubmit={checkout} className="stack"><label>{t.email}<input required type="email" dir="ltr" autoComplete="email" inputMode="email" maxLength={254} value={d.email} onChange={e=>update({email:e.target.value})}/></label>
   <details className="optional-details"><summary>{t.optionalDetails}</summary><div className="stack">{(d.styles.includes('cinematic')?['name','title','description']:['description']).map(k=><label key={k}>{(t as any)[k]}{k==='description'?<textarea maxLength={300} dir="auto" value={d.preferences.description} onChange={e=>update({preferences:{...d.preferences,description:e.target.value}})}/>:<input maxLength={k==='name'?80:100} dir="auto" value={(d.preferences as any)[k]} onChange={e=>update({preferences:{...d.preferences,[k]:e.target.value}})}/>}</label>)}<p>{t.original}</p></div></details>
   <div className="review-details"><b>{packageLabel(pkg,t)} · {money(pkg.amount,pkg.currency,l)}</b><p>{d.styles.map(k=>(t as any)[k]).join(' · ')} · {photos.length} {t.upload}</p>{d.preferences.name&&<p dir="auto">{d.preferences.name}</p>}{d.preferences.title&&<p dir="auto">{d.preferences.title}</p>}<p>{live?t.deliveryLive:t.deliveryDemo}</p></div>
   <label className="check-label"><input type="checkbox" checked={!!d.consents.marketing} onChange={e=>update({consents:{...d.consents,marketing:e.target.checked}})}/><span>{t.marketing}</span></label><p className="notice">{live?t.paymentRedirect:t.demoExplain}</p>
  </form>}
  {error&&<div className="error" role="alert">{(t as any)[error]||t.error}</div>}
  <div className="form-actions mobile-form-actions"><div className="mobile-action-price"><b dir="ltr">{money(pkg.amount,pkg.currency,l)}</b>{!live&&<small>{t.demo}</small>}</div>{d.step>0&&<button className="button outline" disabled={busy} onClick={()=>update({step:d.step-1})}>{t.back}</button>}{d.step<2?<button className="button" disabled={busy} onClick={next}>{busy?t.loading:t.next}</button>:<button form="checkout-form" className="button" disabled={busy}>{busy?t.loading:live?t.payLive:t.pay}</button>}</div>
  </div><aside className="order-aside"><div className="surface"><span className="eyebrow">{t.order}</span><h3>{packageLabel(pkg,t)}</h3><div className="price" dir="ltr">{money(pkg.amount,pkg.currency,l)}</div><p>{pkg.count} {t.portraits} · {pkg.styles} {t.styles}</p><hr/><p>{live?t.chargeNoticeLive:t.chargeNotice}</p><p>{live?t.deliveryLive:t.deliveryDemo}</p><p><Lock size={14}/> {t.private}</p><p>{t.revisionIncluded}</p></div></aside></div>
 </section>
}
