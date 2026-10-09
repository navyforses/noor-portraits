export const orderStates=['draft','awaiting_payment','paid','processing','quality_review','ready','revision_requested','failed','refund_pending','refunded'] as const;
export function validPayment(expected:{amount:number,currency:string,id:string},actual:{amount:number,currency:string,orderId:string,status:string}){return actual.status==='verified'&&expected.amount===actual.amount&&expected.currency===actual.currency&&expected.id===actual.orderId}
export function canGenerate(o:{payment_status:string,status:string}){return o.payment_status==='verified'&&['paid','failed','revision_requested'].includes(o.status)}
export function expired(expires:number,now=Date.now()){return expires<=now}
export function dueForDeletion(o:{created_at:number,delivered_at:number|null,payment_status:string},kind:string,s:{unpaidHours:number,referenceDays:number,resultDays:number},now=Date.now()){return o.payment_status!=='verified'?now>=o.created_at+s.unpaidHours*3600000:!!o.delivered_at&&now>=o.delivered_at+(kind==='reference'?s.referenceDays:s.resultDays)*86400000}
export function validateSelection(pkg:{styles:number},styles:string[],available:string[]){return styles.length===pkg.styles&&new Set(styles).size===styles.length&&styles.every(s=>available.includes(s))}
export function safePreference(v:unknown,max=300){if(typeof v!=='string')return '';return v.trim().slice(0,max)}
