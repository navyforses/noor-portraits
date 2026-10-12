import { createHash, timingSafeEqual } from "node:crypto";
import handler from "vinext/server/fetch-handler";
import { runJobs } from "../lib/server/jobs";
import { cleanup } from "../lib/server/retention";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function authorized(request: Request, env: Cloudflare.Env) {
  const supplied = request.headers.get("X-NOOR-Gateway-Token") ?? "";
  const expected = env.GATEWAY_TOKEN;
  if (!expected || !supplied) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

export default {
  async scheduled(event: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    // "* * * * *" drives portrait generation (long deadline, under the 15-minute cron wall-clock limit).
    // The hourly trigger (and manual test triggers) also run retention cleanup.
    const minutely = event.cron === "* * * * *";
    const work = minutely ? runJobs(Date.now() + 13 * 60_000) : Promise.all([cleanup(), runJobs()]);
    ctx.waitUntil(work.then(() => {
      console.log(JSON.stringify({ event: "noor_scheduled_complete", cron: event.cron, scheduledTime: event.scheduledTime }));
    }));
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/api/health") {
      return Response.json({ ok: true }, { headers });
    }
    if (!authorized(request, env)) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers });
    }
    const response = await handler.fetch(request, env, ctx);
    if (request.method === "POST" && path.startsWith("/api/")) ctx.waitUntil(runJobs());
    return response;
  },
};
