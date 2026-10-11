import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){const l=req.nextUrl.pathname.split('/')[1];const h=new Headers(req.headers);h.set('x-noor-locale',['ar','en','ka'].includes(l)?l:'ar');const r=NextResponse.next({request:{headers:h}});r.headers.set('Referrer-Policy','no-referrer');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('X-Frame-Options','DENY');r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return r}
export const config={matcher:['/((?!_next|fonts|portraits|favicon).*)']};

