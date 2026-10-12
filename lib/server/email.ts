import {env} from 'cloudflare:workers';
import {config, token, run, id, audit} from './store';
import {dictionaries} from '../i18n';

/**
 * Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 * The API key lives only in the Cloudflare secret RESEND_API_KEY. The sender address comes from the
 * emailFrom setting and must belong to a domain verified in Resend. Keep click tracking off for that
 * domain so private one-time links are not rewritten.
 */
export type EmailKind = 'paid' | 'ready' | 'newLink' | 'alert';

export async function emailEnabled() {
  const s = await config();
  return !!(env as any).RESEND_API_KEY && !!s.emailFrom;
}

const escape = (v: string) => v.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

export async function sendEmail(m: {to: string; subject: string; text: string; html: string; idempotencyKey?: string}) {
  const key = (env as any).RESEND_API_KEY;
  const s = await config();
  if (!key || !s.emailFrom) throw Error('email_unavailable');
  const headers: Record<string, string> = {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'};
  if (m.idempotencyKey) headers['Idempotency-Key'] = m.idempotencyKey.slice(0, 256);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({from: s.emailFrom, to: [m.to], subject: m.subject, text: m.text, html: m.html, ...(s.supportEmail ? {reply_to: s.supportEmail} : {})}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw Error('email_failed');
}

function layout(o: {dir: string; lang: string; body: string; link: string; button: string; footer: string; seller: string}) {
  return `<!doctype html><html lang="${o.lang}" dir="${o.dir}"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1d1a16">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;letter-spacing:4px;margin:0 0 24px">NOOR&#10023;</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">${escape(o.body)}</p>
<p style="margin:0 0 32px"><a href="${escape(o.link)}" style="display:inline-block;background:#1d1a16;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-size:15px">${escape(o.button)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b645c;margin:0 0 8px">${escape(o.footer)}</p>
<p style="font-size:12px;color:#6b645c;margin:0">${escape(o.seller)}</p>
</div></body></html>`;
}

/** Sends one customer email with a fresh 24-hour private link. Records the outcome; never throws. */
export async function sendOrderEmail(o: any, kind: Exclude<EmailKind, 'alert'>) {
  try {
    if (!o?.email || !(await emailEnabled())) return false;
    const s = await config();
    const locale = (['ar', 'en', 'ka'].includes(o.locale) ? o.locale : 'en') as 'ar' | 'en' | 'ka';
    const t: any = dictionaries[locale];
    const site = new URL(s.siteUrl);
    if (site.protocol !== 'https:') throw Error('email_unavailable');
    const link = `${site.origin}/${locale}/access#${await token('link', o.id, null)}`;
    const subject = kind === 'paid' ? t.emailPaidSubject : kind === 'ready' ? t.emailSubject : t.emailNewLinkSubject;
    const body = kind === 'paid' ? t.emailPaidBody : kind === 'ready' ? t.emailBody : t.emailNewLinkBody;
    const seller = [s.companyName, s.address, s.supportEmail].filter(Boolean).join(' · ');
    await sendEmail({
      to: o.email,
      subject,
      text: `${body}\n\n${link}\n\n${t.emailFooter}\n${seller}`,
      html: layout({dir: locale === 'ar' ? 'rtl' : 'ltr', lang: locale, body, link, button: t.emailOpen, footer: t.emailFooter, seller}),
      // A delivered set and a revised set are different emails; the same event never sends twice.
      idempotencyKey: kind === 'newLink' ? undefined : `${kind}-${o.id}-${o.delivered_at || 0}`,
    });
    await run('INSERT INTO notifications (id,order_id,status,created_at) VALUES (?,?,?,?)', id(), o.id, 'sent:' + kind, Date.now());
    await audit('system', 'email_sent', o.id);
    return true;
  } catch {
    try {
      await run('INSERT INTO notifications (id,order_id,status,created_at) VALUES (?,?,?,?)', id(), o.id, 'failed:' + kind, Date.now());
      await audit('system', 'email_failed', o.id);
    } catch {}
    return false;
  }
}

/** Short operational alert to the support mailbox, e.g. when automatic generation fails. Never throws. */
export async function alertOwner(orderId: string, problem: string) {
  try {
    const s = await config();
    if (!s.supportEmail || !(await emailEnabled())) return;
    const site = new URL(s.siteUrl).origin;
    const text = `NOOR order ${orderId}: ${problem}. Open ${site}/ka/admin to retry, fulfil manually or refund.`;
    await sendEmail({to: s.supportEmail, subject: `NOOR: ${problem} (${orderId.slice(0, 8)})`, text, html: `<p>${escape(text)}</p>`, idempotencyKey: `alert-${orderId}-${problem}`});
  } catch {}
}
