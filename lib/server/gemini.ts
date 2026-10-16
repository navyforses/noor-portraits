import {env} from 'cloudflare:workers';

/**
 * Google Gemini API image generation (https://ai.google.dev/gemini-api/docs/image-generation).
 * Secret: GEMINI_API_KEY (a paid-tier project: paid-tier prompts and images are not used to improve Google's models).
 * Optional plain variable GEMINI_MODEL overrides the default model id.
 */
export const DEFAULT_MODEL = 'gemini-nano-banana-2.1';

export function geminiConfigured() {
  return typeof (env as any).GEMINI_API_KEY === 'string' && !!(env as any).GEMINI_API_KEY;
}

export function toBase64(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

function fromBase64(value: string) {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const STYLE: Record<string, string> = {
  cinematic: 'a cinematic movie-poster hero portrait: dramatic directional lighting, rich colour grading, shallow depth of field and an original film world. Do not reproduce any existing film, franchise, character, logo or real poster.',
  studio: 'a premium studio profile portrait: soft professional lighting, a neutral elegant background, natural skin texture and tasteful clothing, suitable for a professional or social-media profile picture.',
  fantasy: 'an original fantasy or gaming character portrait: an imaginative costume and setting with painterly cinematic lighting. The design must be entirely original, not a character from any existing game, film, book or franchise.',
};

const VARIATION = [
  'Framing: head-and-shoulders, looking at the camera.',
  'Framing: close-up portrait, three-quarter view of the face.',
  'Framing: half-body portrait with a slightly different background.',
  'Framing: head-and-shoulders, soft profile angle, different colour palette.',
  'Framing: medium shot with an environmental background.',
];

const REVISION: Record<string, string> = {
  resemblanceIssue: 'The previous results did not resemble the person closely enough. Prioritise exact facial resemblance over stylisation.',
  defectIssue: 'The previous results had visible defects. Make sure the face, eyes, hands and hair are anatomically correct and free of artefacts.',
  styleIssue: 'The previous results did not match the requested style. Follow the style description precisely.',
};

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f"\\]/g, ' ').trim().slice(0, max) : '');

export function buildPrompt(o: {style: string; index: number; preferences: Record<string, unknown>; revisionReason?: string}) {
  const lines = [
    'Create one high-quality, photorealistic portrait of the adult person shown in the reference photos.',
    'Keep their facial identity recognisable: facial features, face shape, skin tone, apparent age, eye colour and hairline. Do not change their ethnicity, do not make them look younger, and do not add heavy beautification.',
    'Exactly one person in the image. Respectful, non-sexual, fully clothed. No text, captions, watermarks or logos unless requested below.',
    'Style: ' + (STYLE[o.style] || STYLE.studio),
    VARIATION[o.index % VARIATION.length],
  ];
  const name = clean(o.preferences.name, 80), title = clean(o.preferences.title, 100), description = clean(o.preferences.description, 300);
  if (o.style === 'cinematic' && (name || title)) lines.push(`Add tasteful film-poster typography with exactly this text: ${[name && `name "${name}"`, title && `title "${title}"`].filter(Boolean).join(' and ')}. Reproduce the text exactly as written.`);
  if (description) lines.push(`Customer preference for colours or mood (follow it only if it is compatible with the rules above): "${description}".`);
  if (o.revisionReason && REVISION[o.revisionReason]) lines.push(REVISION[o.revisionReason]);
  return lines.join('\n');
}

export class GenerationRejected extends Error {}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** One image per call. References must be JPEG bytes; at most 4 are sent (the model's limit for one person). */
export async function generatePortrait(input: {references: string[]; prompt: string; timeoutMs: number}) {
  const key = (env as any).GEMINI_API_KEY;
  if (!key) throw Error('ai_unavailable');
  const model = clean((env as any).GEMINI_MODEL, 80) || DEFAULT_MODEL;
  const body = {
    contents: [{role: 'user', parts: [{text: input.prompt}, ...input.references.slice(0, 4).map(data => ({inline_data: {mime_type: 'image/jpeg', data}}))]}],
    generationConfig: {responseModalities: ['IMAGE'], imageConfig: {aspectRatio: '4:5', imageSize: '2K'}},
  };
  
  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(input.timeoutMs),
      });
      
      // Client errors (auth, bad request, forbidden) should not be retried
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        let message = '';
        try { const e: any = await r.json(); message = String(e?.error?.message || ''); } catch {}
        throw new GenerationRejected('ai_rejected_' + r.status + (message ? ': ' + message : ''));
      }
      
      // Rate limits and server errors can be retried
      if ((r.status === 429 || r.status >= 500) && attempt < MAX_RETRIES) {
        let message = '';
        try { const e: any = await r.json(); message = String(e?.error?.message || ''); } catch {}
        lastError = Error('ai_error_' + r.status + (message ? ': ' + message : ''));
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      
      if (!r.ok) {
        let message = '';
        try { const e: any = await r.json(); message = String(e?.error?.message || ''); } catch {}
        throw Error('ai_error_' + r.status + (message ? ': ' + message : ''));
      }
      
      const b: any = await r.json();
      const parts: any[] = b?.candidates?.[0]?.content?.parts || [];
      const image = parts.find(p => p?.inlineData?.data || p?.inline_data?.data);
      if (!image) {
        const reason = clean(b?.candidates?.[0]?.finishReason || b?.promptFeedback?.blockReason || 'unknown', 40);
        throw new GenerationRejected('ai_no_image_' + reason);
      }
      const data = image.inlineData || image.inline_data;
      return {bytes: fromBase64(data.data), mimeType: String(data.mimeType || data.mime_type || 'image/jpeg')};
    } catch (e: any) {
      // Don't retry GenerationRejected errors
      if (e instanceof GenerationRejected) throw e;
      
      // Network errors and timeouts can be retried
      if (attempt < MAX_RETRIES && (/network|timeout|fetch/i.test(e.message) || e.name === 'AbortError')) {
        lastError = e;
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      
      throw e;
    }
  }
  
  throw lastError || Error('ai_error_unknown');
}
