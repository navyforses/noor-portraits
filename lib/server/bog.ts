import {env} from 'cloudflare:workers';

/**
 * Bank of Georgia online payments (https://api.bog.ge/docs/en/payments/introduction).
 * Credentials come only from Cloudflare secrets: BOG_CLIENT_ID, BOG_CLIENT_SECRET and BOG_ENV ("sandbox" or "production").
 * For Arabic users, the payment page language is set to 'en' because BOG has no Arabic locale.
 * Missing or invalid configuration fails closed with provider_unavailable; no payment is attempted.
 */
const HOSTS = {
  production: {oauth: 'https://oauth2.bog.ge', api: 'https://api.bog.ge', pay: ['payment.bog.ge']},
  sandbox: {oauth: 'https://oauth2-sandbox.bog.ge', api: 'https://api-sandbox.bog.ge', pay: ['payment-sandbox.bog.ge']},
} as const;

// Callback verification keys published in the official documentation (production and sandbox differ).
const KEYS = {
  production: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu4RUyAw3+CdkS3ZNILQhzHI9Hemo+vKB9U2BSabppkKjzjjkf+0Sm76hSMiu/HFtYhqWOESryoCDJoqffY0Q1VNt25aTxbj068QNUtnxQ7KQVLA+pG0smf+EBWlS1vBEAFbIas9d8c9b9sSEkTrrTYQ90WIM8bGB6S/KLVoT1a7SnzabjoLc5Qf/SLDG5fu8dH8zckyeYKdRKSBJKvhxtcBuHV4f7qsynQT+f2UYbESX/TLHwT5qFWZDHZ0YUOUIvb8n7JujVSGZO9/+ll/g4ZIWhC1MlJgPObDwRkRd8NFOopgxMcMsDIZIoLbWKhHVq67hdbwpAq9K9WMmEhPnPwIDAQAB',
  sandbox: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqczfAuhtxw2iF68kS0HybGSv0ZlDAjsXh6VC8avDl3Vxa9qCn6Pzl37Tl2Z21WodiISLeXdhCtOMTeLNUBebCYD31y2/MwnhLYqlCk2bOh29fyPc1iT5Eu/k/1IaNRrK9/UVZaTkhOMeEm+aL4y85XsE4UjqftEmwrAdbO2G4cCpuoMC9ZXG9gAdr2BFN6i2Vt9eCen5Poj7E1ik7s8TGyzploVV0NflhwBGeWnvQANUQGr87gsP5k2JG1z5EwnMybJQ7i3XT726rJMaV6QWsY5hP72Mtv1I1zL2d9FXm9FWOzbpcXCyxuEBXvqqOHzogri8C7KRRYKyk97Ri7D68wIDAQAB',
} as const;

type Mode = keyof typeof HOSTS;
export type BankStatus = 'pending' | 'verified' | 'failed' | 'cancelled' | 'refund_requested' | 'refunded';
export interface BankReceipt {orderId: string; status: BankStatus; amount: number; currency: string; refunded: number; externalOrderId: string}

function settings() {
  const e = env as any;
  const mode = e.BOG_ENV as Mode;
  if (!(mode in HOSTS) || typeof e.BOG_CLIENT_ID !== 'string' || !e.BOG_CLIENT_ID || typeof e.BOG_CLIENT_SECRET !== 'string' || !e.BOG_CLIENT_SECRET) throw Error('provider_unavailable');
  return {mode, ...HOSTS[mode], id: e.BOG_CLIENT_ID as string, secret: e.BOG_CLIENT_SECRET as string};
}

export function bogConfigured() {
  try { settings(); return true; } catch { return false; }
}

let cached: {token: string; expires: number; key: string} | null = null;

async function accessToken() {
  const c = settings();
  const key = c.mode + ':' + c.id;
  if (cached && cached.key === key && cached.expires > Date.now() + 60_000) return cached.token;
  const r = await fetch(c.oauth + '/auth/realms/bog/protocol/openid-connect/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(c.id + ':' + c.secret)},
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw Error('provider_unavailable');
  const b: any = await r.json();
  if (typeof b.access_token !== 'string') throw Error('provider_unavailable');
  // The docs define expires_in in seconds, but their example looks like milliseconds; fall back to 5 minutes when implausible.
  const seconds = Number(b.expires_in);
  cached = {token: b.access_token, expires: Date.now() + (seconds > 0 && seconds < 86_400 ? seconds : 300) * 1000, key};
  return cached.token;
}

async function call(path: string, init: RequestInit & {idempotencyKey?: string} = {}) {
  const c = settings();
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + await accessToken());
  if (init.body) headers.set('Content-Type', 'application/json');
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);
  const r = await fetch(c.api + path, {...init, headers, signal: AbortSignal.timeout(20_000)});
  if (!r.ok) throw Error('provider_unavailable');
  return r.json() as Promise<any>;
}

const major = (minor: number) => Math.round(minor) / 100;
const minor = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export async function createBankOrder(o: {orderId: string; amount: number; currency: string; locale: string; productId: string; description: string; siteUrl: string}) {
  const c = settings();
  const site = new URL(o.siteUrl);
  if (site.protocol !== 'https:') throw Error('provider_unavailable');
  const base = site.origin;
  
  // For Arabic users, pass 'en' as the payment page language (BOG has no Arabic)
  const paymentLocale = o.locale === 'ar' ? 'en' : (o.locale === 'ka' ? 'ka' : 'en');
  
  const body = {
    callback_url: base + '/api/payments/bog/callback',
    external_order_id: 'NOOR-' + o.orderId,
    capture: 'automatic',
    ttl: 30,
    purchase_units: {
      currency: o.currency,
      total_amount: major(o.amount),
      basket: [{product_id: o.productId, description: o.description.slice(0, 100), quantity: 1, unit_price: major(o.amount)}],
    },
    redirect_urls: {
      success: `${base}/${o.locale}/payment/success/${o.orderId}`,
      fail: `${base}/${o.locale}/payment/failure/${o.orderId}`,
    },
  };
  const r = await call('/payments/v1/ecommerce/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'Accept-Language': paymentLocale},
    idempotencyKey: crypto.randomUUID(),
  });
  const redirect = r?._links?.redirect?.href;
  if (typeof r?.id !== 'string' || typeof redirect !== 'string') throw Error('provider_unavailable');
  const url = new URL(redirect);
  if (url.protocol !== 'https:' || !(c.pay as readonly string[]).includes(url.hostname)) throw Error('provider_unavailable');
  return {reference: r.id as string, checkoutUrl: url.toString()};
}

/** Authoritative status straight from the bank. Callback bodies are never trusted on their own. */
export async function bankReceipt(reference: string): Promise<BankReceipt> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(reference)) throw Error('invalid');
  const r = await call('/payments/v1/receipt/' + encodeURIComponent(reference));
  const key = String(r?.order_status?.key || '');
  const units = r?.purchase_units || {};
  const transferred = minor(units.transfer_amount);
  const requested = minor(units.request_amount);
  const refunded = minor(units.refund_amount) || 0;
  let status: BankStatus = 'pending';
  if (key === 'completed') status = 'verified';
  else if (key === 'rejected') status = r?.reject_reason === 'expiration' ? 'cancelled' : 'failed';
  else if (key === 'refunded') status = 'refunded';
  else if (key === 'refund_requested') status = 'refund_requested';
  else if (key === 'refunded_partially') status = 'verified';
  return {
    orderId: String(r?.order_id || ''),
    status,
    amount: Number.isFinite(transferred) && transferred > 0 ? transferred : requested,
    currency: String(units.currency_code || ''),
    refunded,
    externalOrderId: String(r?.external_order_id || ''),
  };
}

export async function requestBankRefund(reference: string) {
  const r = await call('/payments/v1/payment/refund/' + encodeURIComponent(reference), {method: 'POST', body: '{}', idempotencyKey: crypto.randomUUID()});
  if (r?.key !== 'request_received') throw Error('provider_unavailable');
  return String(r.action_id || '');
}

function base64Bytes(value: string) {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Optional defence in depth. The docs specify SHA256withRSA over the raw body but not the signature encoding,
 * so base64 is assumed. The callback handler re-reads the receipt from the bank either way.
 */
export async function validCallbackSignature(raw: Uint8Array, signature: string | null) {
  if (!signature) return false;
  try {
    const mode = settings().mode;
    const key = await crypto.subtle.importKey('spki', base64Bytes(KEYS[mode]), {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64Bytes(signature.trim()), new Uint8Array(raw));
  } catch {
    return false;
  }
}
