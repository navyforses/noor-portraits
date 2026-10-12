import {one, run, id, audit, config} from './store';
import {recordOrderEvent} from './analytics';
import {sendOrderEmail} from './email';
import {bankReceipt, type BankStatus} from './bog';

/** Called exactly once per order, right after its payment becomes verified. */
export async function onPaid(orderId: string) {
  const s = await config();
  const o = await one('SELECT * FROM orders WHERE id=?', orderId);
  if (!o) return;
  if (s.aiProvider === 'gemini' || s.aiProvider === 'openai') {
    await queueGeneration(orderId);
  } else {
    await run('UPDATE orders SET generation_status=? WHERE id=?', 'manual_required', orderId);
  }
  await sendOrderEmail(o, 'paid');
}

export async function queueGeneration(orderId: string) {
  await run("INSERT INTO generation_jobs (id,order_id,status,attempts,error,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET status='queued',attempts=0,error=NULL,updated_at=excluded.updated_at WHERE generation_jobs.status!='running'", id(), orderId, 'queued', 0, null, Date.now());
  await run('UPDATE orders SET generation_status=? WHERE id=?', 'queued', orderId);
  await audit('system', 'generation_queued', orderId);
}

/**
 * Applies an authoritative bank status to our records. Amount, currency and order must match the
 * stored snapshot exactly before an order is marked paid. Safe to call repeatedly (callbacks, return page, retries).
 */
export async function applyBankStatus(payment: any, r: {status: BankStatus; amount: number; currency: string}) {
  const o = await one('SELECT * FROM orders WHERE id=?', payment.order_id);
  if (!o) return 'missing';
  if (r.status === 'verified') {
    const snap = JSON.parse(o.snapshot);
    if (r.amount !== payment.amount || r.currency !== payment.currency || snap.amount !== payment.amount || snap.currency !== payment.currency) {
      await audit('system', 'payment_mismatch', o.id);
      return 'mismatch';
    }
    await run("UPDATE payments SET status='verified',verified_at=COALESCE(verified_at,?) WHERE id=? AND status IN ('pending','failed','cancelled')", Date.now(), payment.id);
    const res = await run("UPDATE orders SET status='paid',payment_status='verified' WHERE id=? AND payment_status!='verified' AND payment_status!='refunded'", o.id);
    if (res.meta.changes) {
      await recordOrderEvent('payment_verified', o);
      await audit('system', 'payment_verified', o.id);
      await onPaid(o.id);
    }
    return 'verified';
  }
  if (r.status === 'refunded') {
    const res = await run("UPDATE payments SET status='refunded' WHERE id=? AND status IN ('verified','refund_requested')", payment.id);
    await run("UPDATE orders SET status='refunded',payment_status='refunded' WHERE id=? AND payment_status='verified'", o.id);
    if (res.meta.changes) await audit('system', 'bank_refunded', o.id);
    return 'refunded';
  }
  if (r.status === 'refund_requested') {
    await run("UPDATE payments SET status='refund_requested' WHERE id=? AND status='verified'", payment.id);
    return 'refund_requested';
  }
  if (r.status === 'failed' || r.status === 'cancelled') {
    await run("UPDATE payments SET status=? WHERE id=? AND status='pending'", r.status, payment.id);
    await run("UPDATE orders SET payment_status=? WHERE id=? AND payment_status NOT IN ('verified','refunded')", r.status, o.id);
    return r.status;
  }
  return 'pending';
}

/** Re-reads the bank receipt and applies it. Used by the callback, the return page and the admin. */
export async function syncBankPayment(payment: any) {
  if (!payment || payment.provider !== 'bog') return payment?.status || 'pending';
  const receipt = await bankReceipt(payment.reference);
  if (receipt.orderId && receipt.orderId !== payment.reference) return 'mismatch';
  return applyBankStatus(payment, receipt);
}

export async function paymentForOrder(orderId: string) {
  return one('SELECT * FROM payments WHERE order_id=?', orderId);
}
