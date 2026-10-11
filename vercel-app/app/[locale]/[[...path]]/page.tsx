import Studio from '../../../components/studio';
export default async function Page({params}:{params:Promise<{locale:string,path?:string[]}>}){const p=await params;return <Studio locale={['ar','en','ka'].includes(p.locale)?p.locale:'ar'} path={p.path||[]}/>}
