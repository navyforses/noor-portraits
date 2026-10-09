import {one,all,run,id,audit} from './store';import {ManualGenerationProvider,ImageGenerationProvider} from './providers';
/** Durable job runner. No AI credentials means immediate human escalation, zero API calls/costs.
 * Any future live provider must honor the stable job idempotencyKey before this is enabled. */
export async function runJobs(provider:ImageGenerationProvider=new ManualGenerationProvider()){
 const jobs=await all("SELECT j.*,o.payment_status FROM generation_jobs j JOIN orders o ON o.id=j.order_id WHERE j.status='queued' AND j.attempts<3 LIMIT 3");
 for(const j of jobs){if(j.payment_status!=='verified'){await run('UPDATE generation_jobs SET status=?,error=? WHERE id=?','failed','paymentRequired',j.id);continue}
 const claim=await run("UPDATE generation_jobs SET status='running',attempts=attempts+1,updated_at=? WHERE id=? AND status='queued'",Date.now(),j.id);if(!claim.meta.changes)continue;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{if(provider instanceof ManualGenerationProvider)throw Error('ai_unavailable');
 // Live provider transport and polling are intentionally not enabled in this MVP.
 throw Error('provider_unavailable');
 }catch(e:any){const manual=e.message==='ai_unavailable'||e.message==='provider_unavailable';await run('UPDATE generation_jobs SET status=?,error=?,updated_at=? WHERE id=?',manual?'manual_required':'failed',manual?e.message:'error',Date.now(),j.id);await run('UPDATE orders SET status=?,generation_status=? WHERE id=?',manual?'paid':'failed',manual?'manual_required':'failed',j.order_id);await audit('system',manual?'generation_unavailable':'generation_failed',j.order_id)}finally{clearTimeout(timer)}
 }
 // Never automatically retry a timed-out chargeable call; reconcile the provider's idempotency key first.
}
