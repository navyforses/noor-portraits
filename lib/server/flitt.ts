import {env} from 'cloudflare:workers';

/**
 * Flitt (TBC Bank) payment integration (https://flitt.com).
 * Credentials come only from Cloudflare secrets: FLITT_API_KEY, FLITT_CLIENT_ID, FLITT_CLIENT_SECRET and FLITT_ENV ("sandbox" or "production").
 * Missing or invalid configuration fails closed with provider_unavailable; no payment is attempted.
 */
const HOSTS = {
  production: {api: 'https://api.flitt.com', pay: ['pay.flitt.com']},
  sandbox: {api: 'https://api-sandbox.flitt.com', pay: ['pay-sandbox.flitt.com']},
} as const;

type Mode = keyof typeof HOSTS;
export type FlittStatus = 'pending' | 'verified' | 'failed' | 'cancelled' | 'refund_requested' | 'refunded';
export interface FlittReceipt {orderId: string; status: FlittStatus; amount: number; currency: string; refunded: number; externalOrderId: string}

function settings() {
  const e = env as any;
  const mode = e.FLITT_ENV as Mode;
  if (!(mode in HOSTS) || typeof e.FLITT_API_KEY !== 'string' || !e.FLITT_API_KEY || typeof e.FLITT_CLIENT_ID !== 'string' || !e.FLITT_CLIENT_ID || typeof e.FLITT_CLIENT_SECRET !== 'string' || !e.FLITT_CLIENT_SECRET) throw Error('provider_unavailable');
  return {mode, ...HOSTS[mode], apiKey: e.FLITT_API_KEY as string, clientId: e.FLITT_CLIENT_ID as string, clientSecret: e.FLITT_CLIENT_SECRET as string};
}

export function flittConfigured() {
  try { settings(); return true; } catch { return false; }
}

async function call(path: string, init: RequestInit = {}) {
  const c = settings();
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + c.apiKey);
  if (init.body) headers.set('Content-Type', 'application/json');
  const r = await fetch(c.api + path, {...init, headers, signal: AbortSignal.timeout(20_000)});
  if (!r.ok) throw Error('provider_unavailable');
  return r.json() as Promise<any>;
}

const major = (minor: number) => Math.round(minor) / 100;
const minor = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export async function createFlittOrder(o: {orderId: string; amount: number; currency: string; locale: string; productId: string; description: string; siteUrl: string}) {
  const c = settings();
  const site = new URL(o.siteUrl);
  if (site.protocol !== 'https:') throw Error('provider_unavailable');
  const base = site.origin;
  
  // For Arabic users, pass 'en' as the payment page language (Flitt has no Arabic)
  const paymentLocale = o.locale === 'ar' ? 'en' : (o.locale === 'ka' ? 'ka' : 'en');
  
  const body = {
    amount: major(o.amount),
    currency: o.currency,
    order_id: 'NOOR-' + o.orderId,
    description: o.description.slice(0, 100),
    callback_url: base + '/api/payments/flitt/callback',
    success_url: `${base}/${o.locale}/payment/success/${o.orderId}`,
    cancel_url: `${base}/${o.locale}/payment/failure/${o.orderId}`,
    language: paymentLocale,
  };
  
  const r = await call('/v1/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  const redirect = r?.checkout_url;
  if (typeof r?.payment_id !== 'string' || typeof redirect !== 'string') throw Error('provider_unavailable');
  const url = new URL(redirect);
  if (url.protocol !== 'https:' || !(c.pay as readonly string[]).includes(url.hostname)) throw Error('provider_unavailable');
  return {reference: r.payment_id as string, checkoutUrl: url.toString()};
}

export async function flittReceipt(reference: string): Promise<FlittReceipt> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(reference)) throw Error('invalid');
  const r = await call('/v1/payments/' + encodeURIComponent(reference));
  const status = String(r?.status || '');
  const amount = minor(r?.amount);
  const refunded = minor(r?.refunded_amount) || 0;
  
  let mappedStatus: FlittStatus = 'pending';
  if (status === 'succeeded' || status === 'captured') mappedStatus = 'verified';
  else if (status === 'failed') mappedStatus = 'failed';
  else if (status === 'cancelled' || status === 'expired') mappedStatus = 'cancelled';
  else if (status === 'refunded') mappedStatus = 'refunded';
  else if (status === 'refund_requested') mappedStatus = 'refund_requested';
  
  return {
    orderId: String(r?.order_id || ''),
    status: mappedStatus,
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    currency: String(r?.currency || ''),
    refunded,
    externalOrderId: String(r?.order_id || ''),
  };
}

export async function requestFlittRefund(reference: string) {
  const r = await call('/v1/payments/' + encodeURIComponent(reference) + '/refund', {
    method: 'POST',
    body: '{}',
  });
  return String(r?.refund_id || '');
}

export async function validFlittCallback(raw: Uint8Array, signature: string | null, secret: string) {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['verify']);
    const sig = new Uint8Array(signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    return await crypto.subtle.verify('HMAC', key, sig, new Uint8Array(raw));
  } catch {
    return false;
  }
}
