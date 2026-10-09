import {all,one,run,id,hash,cookies,cookie,event,fail} from './store';

export async function measurementSession(req:Request){
 const value=cookies(req).noor_measure;
 if(!value||!/^[a-f0-9]{64}$/.test(value))return null;
 return one('SELECT * FROM analytics_sessions WHERE id=? AND expires_at>?',await hash(value),Date.now());
}
export async function recordOrderEvent(name:string,o:any){
 const p=JSON.parse(o.snapshot);
 await event(name,{orderId:o.id,sessionId:o.analytics_session_id||undefined,packageId:p.id});
}
export async function consentMeasurement(req:Request,b:any){
 if(b.accept!==true){const s=await measurementSession(req);if(s){await run('DELETE FROM analytics_events WHERE session_id=?',s.id);await run('UPDATE orders SET analytics_session_id=NULL WHERE analytics_session_id=?',s.id);await run('DELETE FROM analytics_sessions WHERE id=?',s.id)}return {accepted:false,cookie:cookie(req,'noor_measure','',0)}}
 if(!['ar','en','ka'].includes(b.locale))fail('invalid');
 const existing=await measurementSession(req);if(existing)return {accepted:true,cookie:null};
 const bytes=crypto.getRandomValues(new Uint8Array(32));const raw=Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');const sid=await hash(raw);
 const campaign=['cinematic','profile'].includes(b.campaign)?b.campaign:'organic';
 await run('INSERT INTO analytics_sessions (id,locale,campaign,mode,created_at,expires_at) VALUES (?,?,?,?,?,?)',sid,b.locale,campaign,'demo',Date.now(),Date.now()+86400000);
 await event('session_started',{sessionId:sid});return {accepted:true,cookie:cookie(req,'noor_measure',raw)};
}
export async function recordPublicEvent(req:Request,b:any){
 const allowed=['view_style','select_package','offer_viewed','form_opened','upload_started','upload_set_completed','upload_failed'];
 if(!allowed.includes(b.event)||typeof b.eventId!=='string'||!/^[-a-f0-9]{36}$/.test(b.eventId))fail('invalid');
 const s=await measurementSession(req);if(!s)return;
 const styleId=['cinematic','studio','fantasy'].includes(b.styleId)?b.styleId:undefined;
 const packageId=['mini','starter','plus','premium'].includes(b.packageId)?b.packageId:undefined;
 // Never accept arbitrary customer text, URLs, order IDs or commercial outcomes.
 await event(b.event,{sessionId:s.id,styleId,packageId,eventId:b.eventId});
}
export async function analyticsOverview(){
 const sessions=await all(`SELECT s.campaign,s.mode,COUNT(DISTINCT s.id) AS visits,
 COUNT(DISTINCT CASE WHEN e.event='form_opened' THEN s.id END) AS started,
 COUNT(DISTINCT CASE WHEN e.event='upload_set_completed' THEN s.id END) AS uploaded,
 COUNT(DISTINCT CASE WHEN p.status IN ('verified','refunded') THEN s.id END) AS buyers
 FROM analytics_sessions s LEFT JOIN analytics_events e ON e.session_id=s.id
 LEFT JOIN orders o ON o.analytics_session_id=s.id LEFT JOIN payments p ON p.order_id=o.id
 GROUP BY s.campaign,s.mode`);
 const offers=await all(`SELECT json_extract(o.snapshot,'$.id') AS package_id,p.currency,p.provider,
 COUNT(*) AS paid,SUM(p.amount) AS sales,SUM(CASE WHEN p.status='refunded' THEN p.amount ELSE 0 END) AS refunds,
 COALESCE(SUM((SELECT SUM(c.amount) FROM order_costs c WHERE c.order_id=o.id AND c.currency=p.currency)),0) AS costs,
 SUM(CASE WHEN EXISTS(SELECT 1 FROM order_costs c WHERE c.order_id=o.id) THEN 1 ELSE 0 END) AS costed
 FROM orders o JOIN payments p ON p.order_id=o.id WHERE p.status IN ('verified','refunded') GROUP BY package_id,p.currency,p.provider`);
 return {sessions,offers,livePaid:(await one("SELECT COUNT(*) AS n FROM payments WHERE provider!='mock' AND status IN ('verified','refunded')")).n,mode:'demo'};
}
