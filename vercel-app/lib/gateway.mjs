const BACKEND_HOST = 'noor-portraits-backend.jincharadzeshako.workers.dev';
const ALLOWED_COOKIES = new Set(['noor_order', 'noor_admin', 'noor_measure']);
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const error = (code, status) => Response.json({ error: code }, { status, headers: HEADERS });

export function createGateway({ backendUrl, backendToken, fetcher = fetch }) {
 return async function gateway(request) {
  if (!backendUrl || !backendToken) return error('storage_unavailable', 503);
  let backend;
  try { backend = new URL(backendUrl); } catch { return error('storage_unavailable', 503); }
  if (backend.protocol !== 'https:' || backend.hostname !== BACKEND_HOST || backend.port || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) return error('storage_unavailable', 503);
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith('/api/') || /%2f|%5c|\\/i.test(incoming.pathname)) return error('invalid', 400);
  if (incoming.pathname === '/api/maintenance' || incoming.pathname.startsWith('/api/maintenance/')) return error('unauthorized', 403);
  if (!['GET', 'POST'].includes(request.method)) return error('invalid', 405);
  if (request.method !== 'GET' && request.headers.get('origin') !== incoming.origin) return error('unauthorized', 403);
  if (Number(request.headers.get('content-length') || 0) > 4_000_000) return error('photo_invalid', 413);
  const target = new URL(incoming.pathname + incoming.search, backend.origin);
  const headers = new Headers({ 'X-NOOR-Gateway-Token': backendToken });
  for (const key of ['content-type', 'x-upload-id']) {
   const value = request.headers.get(key); if (value) headers.set(key, value);
  }
  const cookies = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).filter(x => ALLOWED_COOKIES.has(x.split('=')[0]));
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (request.method !== 'GET') headers.set('origin', backend.origin);
  let body;
  if (request.method !== 'GET') {
   const reader = request.body?.getReader();
   const chunks = []; let size = 0;
   if (reader) while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 4_000_000) { await reader.cancel(); return error('photo_invalid', 413); }
    chunks.push(value);
   }
   body = new Uint8Array(size); let offset = 0;
   for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  }
  try {
   const response = await fetcher(target, { method: request.method, headers, body, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(25_000) });
   if (response.status >= 300 && response.status < 400) return error('storage_unavailable', 503);
   const outgoing = new Headers(HEADERS);
   for (const key of ['content-type', 'content-disposition', 'x-robots-tag']) {
    const value = response.headers.get(key); if (value) outgoing.set(key, value);
   }
   for (const value of response.headers.getSetCookie()) {
    if (ALLOWED_COOKIES.has(value.split('=')[0])) outgoing.append('set-cookie', value);
   }
   if (response.headers.get('content-type')?.includes('application/json')) {
    let data;
    try { data = await response.json(); } catch { return error('storage_unavailable', 503); }
    if (data && typeof data.link === 'string' && URL.canParse(data.link)) {
     const link = new URL(data.link);
     if (link.origin === backend.origin) data.link = incoming.origin + link.pathname + link.search + link.hash;
    }
    return Response.json(data, { status: response.status, headers: outgoing });
   }
   if (!response.ok) return error('storage_unavailable', response.status >= 500 ? 503 : response.status);
   return new Response(response.body, { status: response.status, headers: outgoing });
  } catch { return error('storage_unavailable', 503); }
 };
}
