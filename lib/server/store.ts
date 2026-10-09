import {env} from 'cloudflare:workers';
import {defaultPackages,defaultStyles,defaultSettings} from '../config';
export const db=()=>{if(!env.DB)throw Error('storage_unavailable');return env.DB};
export const bucket=()=>{if(!env.BUCKET)throw Error('storage_unavailable');return env.BUCKET};
export const one=async(sql:string,...v:any[])=>db().prepare(sql).bind(...v).first<any>();
export const all=async(sql:string,...v:any[])=>(await db().prepare(sql).bind(...v).all<any>()).results;
export const run=async(sql:string,...v:any[])=>db().prepare(sql).bind(...v).run();
export const id=()=>crypto.randomUUID();
export async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
export const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function config(){return {...defaultSettings,...JSON.parse((await one('SELECT data FROM settings WHERE id=?','studio'))?.data||'{}')}}
export async function catalog(){await db().batch([...defaultPackages.map(p=>db().prepare('INSERT OR IGNORE INTO packages (id,data) VALUES (?,?)').bind(p.id,JSON.stringify(p))),...defaultStyles.map(s=>db().prepare('INSERT OR IGNORE INTO styles (id,data) VALUES (?,?)').bind(s.id,JSON.stringify(s)))]);return {packages:(await all('SELECT * FROM packages')).map(p=>JSON.parse(p.data)),styles:(await all('SELECT * FROM styles')).map(p=>JSON.parse(p.data)),settings:await config(),content:Object.fromEntries((await all('SELECT * FROM localized_content WHERE published IS NOT NULL')).map(c=>[c.id,JSON.parse(c.published)])),mode:'demo'}}
export async function audit(actor:string,action:string,orderId:string|null=null){await run('INSERT INTO audit_logs (id,actor,action,order_id,created_at) VALUES (?,?,?,?,?)',id(),actor,action,orderId,Date.now())}
export async function event(name:string){await run('INSERT INTO analytics_events (id,event,created_at) VALUES (?,?,?)',id(),name,Date.now())}
export function fail(code:string,status=400):never{throw Object.assign(Error(code),{status})}
export async function passwordHash(password:string,salt:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export function cookies(req:Request){return Object.fromEntries((req.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=')))}
export function cookie(req:Request,name:string,value:string,maxAge=86400){return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(req.url).hostname==='terminal.local'?'':'; Secure'}`}
export async function token(kind:string,orderId:string|null,adminId:string|null,ttl=86400000){const t=secret();await run('INSERT INTO access_tokens (hash,order_id,admin_id,expires_at,kind) VALUES (?,?,?,?,?)',await hash(t),orderId,adminId,Date.now()+ttl,kind);return t}
export async function session(req:Request,admin=false){const t=cookies(req)[admin?'noor_admin':'noor_order'];if(!t)return null;return one('SELECT * FROM access_tokens WHERE hash=? AND kind=? AND expires_at>?',await hash(t),admin?'admin':'customer',Date.now())}
export async function requireAdmin(req:Request){const s=await session(req,true);if(!s)fail('unauthorized',401);return s.admin_id}
export async function requireOrder(req:Request,oid:string,allowAdmin=true){const s=await session(req);if(s?.order_id!==oid&&!(allowAdmin&&await session(req,true)))fail('accessDenied',403);const o=await one('SELECT * FROM orders WHERE id=?',oid);if(!o)fail('accessDenied',404);return o}
export async function rate(req:Request,key:string,max=100){const ip=req.headers.get('cf-connecting-ip')||'local';const k=await hash(ip+':'+key+':'+Math.floor(Date.now()/60000));const r=await db().prepare('INSERT INTO rate_limits (id,hits,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 RETURNING hits').bind(k,Date.now()+120000).first<{hits:number}>();if((r?.hits||0)>max)fail('rate_limited',429)}
export async function fileSignature(oid:string,fid:string,expires:number){const key=(env as any).FILE_SIGNING_KEY;if(!key)fail('error',503);const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(`${oid}:${fid}:${expires}`)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function fileUrl(oid:string,fid:string){if(!(env as any).FILE_SIGNING_KEY)return `/api/files/${fid}`;const expires=Date.now()+10*60000;return `/api/files/${fid}?expires=${expires}&sig=${await fileSignature(oid,fid,expires)}`}
