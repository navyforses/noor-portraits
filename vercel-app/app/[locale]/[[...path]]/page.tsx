import {notFound} from 'next/navigation';
import Studio from '../../../components/studio';
export default async function Page({params}:{params:Promise<{locale:string,path?:string[]}>}){const p=await params;if(!['ar','en','ka'].includes(p.locale))notFound();return <Studio locale={p.locale} path={p.path||[]}/>}
