import {headers} from 'next/headers';
import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'NOOR Portraits | Your face. A new character.',description:'A private AI-assisted portrait studio. Explore cinematic, studio and fantasy portraits.',robots:{index:false,follow:false},icons:{icon:'/favicon.svg'}};
export default async function RootLayout({children}:{children:React.ReactNode}){const h=await headers();const l=h.get('x-noor-locale')||'ar';return <html lang={l} dir={l==='ar'?'rtl':'ltr'}><body>{children}</body></html>}
