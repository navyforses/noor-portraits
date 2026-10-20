import type {Dictionary} from '../lib/i18n';
import type {Locale} from '../lib/config';
export function PolicyLinks({t,locale}:{t:Dictionary;locale:Locale}) {
 return <>{(['terms','refund','payment-policy'] as const).map((key,i)=><span key={key}>{i>0?' · ':''}<a href={'/'+locale+'/'+key} target="_blank" rel="noreferrer">{t[key]}</a></span>)}</>;
}
export function PaymentMarks({t}:{t:Dictionary}) {
 return <div aria-label={t.paymentMethods}><div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:24,padding:'16px 0'}} dir="ltr">{[['visa','Visa'],['mastercard','Mastercard'],['apple-pay','Apple Pay'],['google-pay','Google Pay']].map(([id,label])=><span key={id} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',padding:12,borderRadius:4,width:104,height:64}}><img src={'/payments/'+id+'.svg'} alt={label} width={80} height={40} style={{objectFit:'contain',width:80,height:40,maxWidth:'100%'}}/></span>)}</div><small>{t.walletAvailability}</small></div>;
}
export function PaymentDetails({t}:{t:Dictionary}) {
 return <div className="payment-details"><p>{t.merchantCountry} · <bdi>{t.checkoutCurrency}</bdi></p><p>{t.chargeNoticeLive}</p><PaymentMarks t={t}/></div>;
}
