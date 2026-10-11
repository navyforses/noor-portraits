'use client';
import {useEffect,useState} from 'react';
import {Check,Lock,Clock} from 'lucide-react';
import {money} from '../lib/config';
import {Ctx,track,packageLabel} from './studio';

export default function EntryOffer({x}:{x:Ctx}){
 const {t,l,c,go}=x;const [look,setLook]=useState('cinematic');
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.get('look')==='studio')setLook('studio')},[]);
 const pkg=c.packages.find((p:any)=>p.id==='mini'&&p.active)||c.packages.find((p:any)=>p.active&&p.styles===1);
 const activeLooks=['cinematic','studio'].filter(k=>c.styles.some((s:any)=>s.id===k&&s.active));
 const selected=activeLooks.includes(look)?look:activeLooks[0];
 const image=c.styles.find((s:any)=>s.id===selected)?.image;
 const choose=(value:string)=>{setLook(value);const url=new URL(location.href);url.searchParams.set('look',value);history.replaceState(null,'',url.pathname+url.search);track('offer_viewed',{packageId:pkg?.id,styleId:value})};
 const title=selected==='studio'?t.offerTitleStudio:t.offerTitleCinematic;
 const start=()=>{if(pkg&&selected){track('select_package',{packageId:pkg.id,styleId:selected});go('create?package='+pkg.id+'&style='+selected)}};
 return <section className="entry-hero">
  <div className="entry-intro"><span className="eyebrow">{t.entryOffer}</span><h1>{title}</h1><p>{selected==='studio'?t.offerIntroStudio:t.offerIntroCinematic}</p></div>
  <div className="entry-art">{image&&<img src={image} alt={(t as any)[selected]} fetchPriority="high"/>}<div className="entry-art-caption"><span>{(t as any)[selected]}</span><small>{t.synthetic}</small></div></div>
  <div className="entry-choice">
   <div className="look-switch" role="group" aria-label={t.offerStep}>{activeLooks.map(k=><button key={k} aria-pressed={selected===k} onClick={()=>choose(k)}>{k==='studio'?t.profileLook:t.posterLook}</button>)}</div>
   {pkg&&selected?<><div className="entry-price"><div><strong>{packageLabel(pkg,t)}</strong><span>{pkg.count} {t.portraits} · {pkg.styles} {t.styles}</span></div><b dir="ltr">{money(pkg.amount,pkg.currency,l)}</b></div><p className="price-disclosure">{t.chargeNotice}</p><button className="button entry-cta" onClick={start}>{t.offerCTA}</button></>:<p>{t.offerUnavailable}</p>}
   <div className="entry-assurance"><span><Check size={17}/>{t.revisionIncluded}</span><span><Lock size={17}/>{t.private}</span></div>
   <p className="delivery-disclosure"><Clock size={17}/>{t.deliveryDemo}</p><p className="resemblance-note">{t.resemblance}</p><a href={'/'+l+'/#packages'} className="text-button">{t.allPackages}</a>
  </div>
  {pkg&&selected&&<div className="entry-mobile-bar"><div><b dir="ltr">{money(pkg.amount,pkg.currency,l)}</b><small>{t.demo}</small></div><button className="button" onClick={start}>{t.offerCTA}</button></div>}
 </section>
}
