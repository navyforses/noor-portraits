import {imageSize} from 'image-size';
import {one, all, run, id, audit, config, bucket, db} from './store';
import {generatePortrait, geminiConfigured, buildPrompt, toBase64, GenerationRejected} from './gemini';
import {generatePortraitOpenAI, openaiConfigured} from './openai';
import {sanitizeImage} from './images';
import {recordOrderEvent} from './analytics';
import {sendOrderEmail, alertOwner} from './email';

const IMAGE_TIMEOUT = 150_000;     // one generation call (OpenAI documents up to 2 minutes)
const START_MARGIN = 160_000;      // never start a call that could outlive the invocation
const STALE_AFTER = 5 * 60_000;    // a running job without a heartbeat for this long is reclaimed
const MAX_FAILURES = 5;            // failed calls per job before the order is escalated
const PARALLEL_LIMIT = 3;          // max concurrent generations per order

/**
 * Durable job runner. Without an AI provider (gemini or openai) and its secret, jobs escalate to manual fulfilment
 * with zero API calls. With it, each job generates the order's portraits one by one, records every image
 * immediately (so a crash never repeats a finished image), and delivers automatically when complete.
 * Called from the generation runner (lib/server/runner.ts, a Durable Object alarm) with a long deadline
 * and after POST requests with a short one; a short deadline only escalates and never starts a chargeable call.
 */
export async function runJobs(deadline = Date.now() + 20_000) {
  const s = await config();
  await run("UPDATE generation_jobs SET status='queued' WHERE status='running' AND updated_at<?", Date.now() - STALE_AFTER);
  const jobs = await all("SELECT j.*,o.payment_status FROM generation_jobs j JOIN orders o ON o.id=j.order_id WHERE j.status='queued' ORDER BY j.updated_at ASC LIMIT 3");
  const live = (s.aiProvider === 'gemini' && geminiConfigured()) || (s.aiProvider === 'openai' && openaiConfigured());
  await Promise.all(jobs.map(async j => {
    if (j.payment_status !== 'verified') {
      await run('UPDATE generation_jobs SET status=?,error=? WHERE id=?', 'failed', 'paymentRequired', j.id);
      return;
    }
    if (!live) {
      const claim = await run("UPDATE generation_jobs SET status='manual_required',error='ai_unavailable',updated_at=? WHERE id=? AND status='queued'", Date.now(), j.id);
      if (!claim.meta.changes) return;
      await run('UPDATE orders SET generation_status=? WHERE id=?', 'manual_required', j.order_id);
      await audit('system', 'generation_unavailable', j.order_id);
      return;
    }
    if (deadline - Date.now() < START_MARGIN) return;
    const claim = await run("UPDATE generation_jobs SET status='running',updated_at=? WHERE id=? AND status='queued'", Date.now(), j.id);
    if (!claim.meta.changes) return;
    try {
      const finished = await generateOrder(j.order_id, j.id, deadline, s.aiProvider);
      if (!finished) await run("UPDATE generation_jobs SET status='queued',updated_at=? WHERE id=? AND status='running'", Date.now(), j.id);
    } catch (e: any) {
      await recordFailure(j.id, j.order_id, e);
    }
  }));
}

/** True when generation work is waiting to be picked up (used by the runner to schedule another pass). */
export async function pendingJobs() {
  return ((await one("SELECT COUNT(*) AS n FROM generation_jobs WHERE status='queued'"))?.n || 0) > 0;
}

/**
 * Counts a failed call. A job that will be retried in the same invocation stays 'running', so another
 * runner cannot claim it in between; otherwise it goes back to 'queued' for the next pass.
 */
async function recordFailure(jobId: string, orderId: string, e: any, retryingNow = false) {
  const code = String(e?.message || 'error').slice(0, 60);
  await run("UPDATE generation_jobs SET attempts=attempts+1,error=?,status=CASE WHEN attempts+1>=? THEN 'failed' ELSE ? END,updated_at=? WHERE id=?", code, MAX_FAILURES, retryingNow ? 'running' : 'queued', Date.now(), jobId);
  const job = await one('SELECT * FROM generation_jobs WHERE id=?', jobId);
  if (job?.status === 'failed') {
    await run("UPDATE orders SET status='failed',generation_status='failed' WHERE id=? AND status IN ('paid','processing','revision_requested')", orderId);
    await audit('system', 'generation_failed', orderId);
    await alertOwner(orderId, 'automatic generation failed');
  }
}

async function generateOrder(orderId: string, jobId: string, deadline: number, provider: string) {
  const o = await one('SELECT * FROM orders WHERE id=?', orderId);
  if (!o || o.payment_status !== 'verified' || o.deleted_at || ['refund_pending', 'refunded'].includes(o.status)) {
    await run("UPDATE generation_jobs SET status='failed',error='orderUnavailable' WHERE id=?", jobId);
    return true;
  }
  const count = JSON.parse(o.snapshot).count as number;
  const styles = (await all('SELECT style_id FROM order_items WHERE order_id=? ORDER BY rowid', orderId)).map(r => r.style_id as string);
  if (!styles.length) throw Error('noStyles');
  const preferences = JSON.parse(o.preferences || '{}');
  // Previously delivered (approved) results stay visible until a revised set is complete.
  const revision = (await one('SELECT COUNT(*) AS n FROM generated_assets WHERE order_id=? AND approved=1', orderId)).n > 0;
  const reason = revision ? (await one("SELECT reason FROM revision_requests WHERE order_id=? AND status='requested' ORDER BY created_at DESC LIMIT 1", orderId))?.reason : undefined;
  await run("UPDATE orders SET status='processing',generation_status='running' WHERE id=? AND status IN ('paid','revision_requested','failed')", orderId);

  const uploads = await all('SELECT storage_key FROM uploads WHERE order_id=? ORDER BY created_at ASC LIMIT 4', orderId);
  if (!uploads.length) throw Error('noReferences');
  const references: string[] = [];
  for (const u of uploads) {
    const obj = await bucket().get(u.storage_key);
    if (obj) references.push(toBase64(new Uint8Array(await obj.arrayBuffer())));
  }
  if (!references.length) throw Error('noReferences');

  // Generate portraits in parallel with concurrency limit
  const tasks: Array<{index: number; style: string; promise: Promise<void>}> = [];
  
  while (true) {
    const done = (await one('SELECT COUNT(*) AS n FROM generated_assets WHERE order_id=? AND approved=0', orderId)).n as number;
    if (done >= count) break;
    if (deadline - Date.now() < START_MARGIN) {
      // Wait for running tasks to complete before returning
      await Promise.allSettled(tasks.map(t => t.promise));
      return false;
    }
    
    // Fill up to parallel limit
    while (tasks.length < PARALLEL_LIMIT && done + tasks.length < count) {
      const index = done + tasks.length;
      const style = styles[index % styles.length];
      
      const task = (async () => {
        try {
          const prompt = buildPrompt({style, index: Math.floor(index / styles.length), preferences, revisionReason: reason});
          const out = provider === 'openai'
            ? await generatePortraitOpenAI({references, prompt, timeoutMs: IMAGE_TIMEOUT, user: 'order-' + orderId.slice(0, 8)})
            : await generatePortrait({references, prompt, timeoutMs: IMAGE_TIMEOUT});
          await storeResult(orderId, count, out.bytes, out.mimeType);
          await run('UPDATE generation_jobs SET updated_at=? WHERE id=?', Date.now(), jobId);
        } catch (e: any) {
          if (e instanceof GenerationRejected || /^ai_error_|^Timeout|abort/i.test(String(e?.name) + String(e?.message))) {
            await recordFailure(jobId, orderId, e, true);
            const job = await one('SELECT status FROM generation_jobs WHERE id=?', jobId);
            if (job?.status === 'failed') throw new Error('job_failed');
          } else {
            throw e;
          }
        }
      })();
      
      tasks.push({index, style, promise: task});
    }
    
    // Wait for at least one task to complete
    if (tasks.length > 0) {
      await Promise.race(tasks.map(t => t.promise.catch(() => {})));
      
      // Remove completed tasks
      const pending = [];
      for (const task of tasks) {
        const result = await Promise.race([
          task.promise.then(() => 'done'),
          Promise.resolve('pending')
        ]);
        if (result === 'pending') pending.push(task);
      }
      tasks.length = 0;
      tasks.push(...pending);
      
      // Check if job has failed
      const job = await one('SELECT status FROM generation_jobs WHERE id=?', jobId);
      if (job?.status === 'failed') return true;
    }
  }
  
  // Wait for all remaining tasks
  await Promise.allSettled(tasks.map(t => t.promise));
  await deliver(orderId, jobId, revision);
  return true;
}

async function storeResult(orderId: string, count: number, bytes: Uint8Array, mimeType: string) {
  let out = {bytes, width: 0, height: 0, size: bytes.length};
  const head = imageSize(bytes);
  if (head.type === 'jpg' && head.width && head.height && bytes.length <= 20 * 1024 * 1024) {
    out = {bytes, width: head.width, height: head.height, size: bytes.length};
  } else {
    // Anything other than a JPEG is re-encoded so every stored file is a clean JPEG.
    out = sanitizeImage(bytes);
  }
  const fid = id(), key = `results/${orderId}/${fid}.jpg`;
  await bucket().put(key, out.bytes, {httpMetadata: {contentType: 'image/jpeg'}});
  const saved = await run('INSERT INTO generated_assets (id,order_id,storage_key,size,width,height,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM generated_assets WHERE order_id=? AND approved=0)<?', fid, orderId, key, out.size, out.width, out.height, Date.now(), orderId, count);
  if (!saved.meta.changes) await bucket().delete(key);
  void mimeType;
}

async function deliver(orderId: string, jobId: string, revision: boolean) {
  if (revision) {
    const old = await all('SELECT * FROM generated_assets WHERE order_id=? AND approved=1', orderId);
    for (const f of old) {
      await bucket().delete(f.storage_key);
      await run('DELETE FROM generated_assets WHERE id=?', f.id);
    }
  }
  const now = Date.now();
  await db().batch([
    db().prepare('UPDATE generated_assets SET approved=1 WHERE order_id=?').bind(orderId),
    db().prepare("UPDATE orders SET status='ready',generation_status='approved',delivered_at=? WHERE id=?").bind(now, orderId),
    db().prepare("UPDATE revision_requests SET status='resolved' WHERE order_id=? AND status='requested'").bind(orderId),
    db().prepare("UPDATE generation_jobs SET status='done',error=NULL,updated_at=? WHERE id=?").bind(now, jobId),
  ]);
  await audit('system', 'generation_completed', orderId);
  await audit('system', 'auto_delivered', orderId);
  const o = await one('SELECT * FROM orders WHERE id=?', orderId);
  await recordOrderEvent('order_ready', o);
  await sendOrderEmail(o, 'ready');
}
