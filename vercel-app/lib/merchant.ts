import type {Locale} from './config';
export const merchantDefaults = {
 companyName: 'Individual Entrepreneur Shalva Jincharadze',
 registration: '60001147948',
 address: '12 Zurab Chavchavadze St, Kutaisi, Georgia',
 supportEmail: 'jincharadzeshako@gmail.com',
 phone: '+995 555 145 719',
};
export function merchantDetails(settings: Partial<typeof merchantDefaults>, locale: Locale) {
 const value = (key: keyof typeof merchantDefaults) => typeof settings[key] === 'string' && settings[key]!.trim() ? settings[key]!.trim() : merchantDefaults[key];
 const companyName = value('companyName');
 const address = value('address');
 return {companyName: companyName === merchantDefaults.companyName && locale === 'ka' ? 'ი/მ შალვა ჯინჭარაძე' : companyName,
 registration: value('registration'),
 address: address === merchantDefaults.address && locale === 'ka' ? 'ზურაბ ჭავჭავაძის ქ. 12, ქუთაისი, საქართველო' : address,
 supportEmail: value('supportEmail'), phone: value('phone')};
}
// Final customer policies must not be replaced by stale published draft copy.
export const complianceCopyKeys = new Set(["noResults","policyDraft","missingBusiness","supportMissing","testPrices","testPricesLive","accept","immediate","termsBody","refundBody","privacyBody","retention","retentionUndelivered","retentionUncapped","payment-policy","security-policy","compliance-policy","payment-policyBody","security-policyBody","compliance-policyBody","sellerPhone","merchantCountry","checkoutCurrency","paymentMethods","walletAvailability","contactBody","chargeNoticeLive","paymentRedirect","generationFailed","downloadSoon","arabicReview","aiProcessingOpenai","aiProcessingGoogle","aiProcessingManual"]);
export const policyRoutes = ['terms', 'refund', 'privacy', 'payment-policy', 'security-policy', 'compliance-policy'] as const;
