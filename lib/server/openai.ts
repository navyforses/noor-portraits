import {env} from 'cloudflare:workers';
import {GenerationRejected} from './gemini';

/**
 * OpenAI Images API, edit endpoint with reference photos
 * (https://developers.openai.com/api/reference/resources/images/methods/edit).
 * Secret: OPENAI_API_KEY. Optional plain variable OPENAI_IMAGE_MODEL overrides the default model.
 * API inputs and outputs are not used for training; OpenAI keeps them up to 30 days for abuse monitoring.
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-image-2.5-sunburst';

export function openaiConfigured() {
  return typeof (env as any).OPENAI_API_KEY === 'string' && !!(env as any).OPENAI_API_KEY;
}

function fromBase64(value: string) {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** One portrait per call. References are base64 JPEG strings; the JSON form of the edit endpoint takes them as data URLs. */
export async function generatePortraitOpenAI(input: {references: string[]; prompt: string; timeoutMs: number; user: string}) {
  const key = (env as any).OPENAI_API_KEY;
  if (!key) throw Error('ai_unavailable');
  const configured = (env as any).OPENAI_IMAGE_MODEL;
  const model = typeof configured === 'string' && /^[a-z0-9.\-]{3,60}$/.test(configured) ? configured : DEFAULT_OPENAI_MODEL;
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      images: input.references.slice(0, 4).map(data => ({image_url: 'data:image/jpeg;base64,' + data})),
      n: 1,
      size: '1024x1536',
      quality: 'high',
      output_format: 'jpeg',
      output_compression: 92,
      user: input.user,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!r.ok) {
    let code = '';
    try { const e: any = await r.json(); code = String(e?.error?.code || ''); } catch {}
    // Moderation blocks must not be retried unchanged; they count as a rejected attempt.
    if (code === 'moderation_blocked' || r.status === 400) throw new GenerationRejected('ai_rejected_' + (code || r.status));
    throw Error('ai_error_' + r.status);
  }
  const b: any = await r.json();
  const data = b?.data?.[0]?.b64_json;
  if (typeof data !== 'string' || !data) throw new GenerationRejected('ai_no_image');
  return {bytes: fromBase64(data), mimeType: 'image/jpeg'};
}
