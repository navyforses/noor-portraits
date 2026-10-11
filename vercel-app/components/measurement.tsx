'use client';
import {useEffect,useState} from 'react';
import {Ctx,api,track} from './studio';

export default function Measurement({x}:{x:Ctx}){
 const {t,l,notify}=x;const [accepted,setAccepted]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{api('measurement').then(r=>{setAccepted(r.accepted);try{setOpen(!r.accepted&&!sessionStorage.getItem('noor-measure-choice'))}catch{setOpen(!r.accepted)}}).catch(()=>{})},[]);
 async function decide(value:boolean){setBusy(true);try{const look=new URLSearchParams(location.search).get('look');await api('measurement',{accept:value,locale:l,campaign:look==='studio'?'profile':look==='cinematic'?'cinematic':'organic'});setAccepted(value);setOpen(false);try{sessionStorage.setItem('noor-measure-choice',value?'accepted':'declined')}catch{}if(value)track('offer_viewed',{packageId:'mini',styleId:look==='studio'?'studio':'cinematic'})}catch(e:any){notify(e.message)}finally{setBusy(false)}}
 return <div className="measurement-panel"><button className="text-button" onClick={()=>setOpen(!open)} aria-expanded={open}>{t.measureSettings}</button>{open&&<div className="measurement-details"><h3>{t.measureTitle}</h3><p>{t.measureText}</p><div className="button-wrap">{accepted?<button className="button outline small" disabled={busy} onClick={()=>decide(false)}>{t.measureWithdraw}</button>:<><button className="button small" disabled={busy} onClick={()=>decide(true)}>{t.measureAccept}</button><button className="button outline small" disabled={busy} onClick={()=>decide(false)}>{t.measureDecline}</button></>}</div></div>}</div>
}
