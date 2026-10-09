export interface PaymentResult {reference:string;orderId:string;amount:number;currency:string;status:'pending'|'verified'|'failed'|'cancelled'|'refunded';checkoutUrl?:string}
export interface PaymentProvider {createPayment(order:{id:string,amount:number,currency:string}):Promise<PaymentResult>;verifyPayment(reference:string):Promise<PaymentResult>;handleCallback(payload:unknown):Promise<PaymentResult>;refundPayment(reference:string):Promise<PaymentResult>}
export class MockPaymentProvider implements PaymentProvider {
 constructor(private lookup:(reference:string)=>Promise<PaymentResult>,private update:(reference:string,status:PaymentResult['status'])=>Promise<PaymentResult>){}
 async createPayment(o:{id:string,amount:number,currency:string}):Promise<PaymentResult>{return {reference:'demo_'+o.id,orderId:o.id,amount:o.amount,currency:o.currency,status:'pending'}}
 async verifyPayment(reference:string){return this.lookup(reference)}
 async handleCallback(payload:unknown){const p=payload as {reference:string,status:PaymentResult['status']};if(!['verified','failed','cancelled'].includes(p.status))throw Error('invalid');return this.update(p.reference,p.status)}
 async refundPayment(reference:string){return this.update(reference,'refunded')}
}
// Deliberately fail closed. Merchant/provider selection and approved contracts are missing.
// Official references: https://developers.tbcbank.ge/docs/checkout-overview and https://api.bog.ge/docs
export class UnconfiguredBankProvider implements PaymentProvider {
 constructor(readonly bank:'tbc'|'bog'){}
 async createPayment():Promise<PaymentResult>{throw Error('provider_unavailable')}
 async verifyPayment():Promise<PaymentResult>{throw Error('provider_unavailable')}
 async handleCallback():Promise<PaymentResult>{throw Error('provider_unavailable')}
 async refundPayment():Promise<PaymentResult>{throw Error('provider_unavailable')}
}
export interface ImageGenerationProvider {generate(input:{idempotencyKey:string;references:Uint8Array[];styles:string[];preferences:Record<string,string>;count:number;signal:AbortSignal}):Promise<{jobId:string}>;status(jobId:string):Promise<{status:string;assets:Uint8Array[];cost?:number}>}
export class ManualGenerationProvider implements ImageGenerationProvider {
 async generate():Promise<{jobId:string}>{throw Error('ai_unavailable')}
 async status(){return {status:'manual_required',assets:[]}}
}
