import {DurableObject, env} from 'cloudflare:workers';
import {runJobs, pendingJobs} from './jobs';

/** Wall time for one runner pass. Durable Object alarms may run for up to 15 minutes. */
const PASS = 13 * 60_000;
/** Pause before the next pass when work is left (a job not finished in time, or more than 3 queued). */
const NEXT_PASS = 15_000;

/**
 * Background generation runner. A single instance processes the generation queue in its alarm,
 * which starts within about a second of a payment and, unlike a cron schedule, does not depend
 * on schedule activation. Durable Object alarms are retried automatically when a pass throws.
 * All state lives in D1 (generation_jobs); the object only holds its alarm.
 */
export class GenerationRunner extends DurableObject {
  async kick() {
    const soon = Date.now() + 500;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > soon + 1_000) await this.ctx.storage.setAlarm(soon);
  }

  async alarm() {
    await runJobs(Date.now() + PASS);
    if (await pendingJobs()) await this.ctx.storage.setAlarm(Date.now() + NEXT_PASS);
  }
}

/** Asks the runner to start a pass. Returns false when the binding is missing (local tools) or the call fails. */
export async function kickRunner() {
  const ns = env.GENERATION_RUNNER;
  if (!ns) return false;
  try {
    await ns.get(ns.idFromName('generation')).kick();
    return true;
  } catch (e) {
    console.error(JSON.stringify({event: 'noor_runner_kick_failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 200)}));
    return false;
  }
}
