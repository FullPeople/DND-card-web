import {memo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {catalogProgressStore} from '../../../src/ui/catalogProgress';
import {CatalogLoadStatus} from '../../../src/ui/CatalogLoadStatus';
import {SourceProvider,useSources} from '../../../src/ui/SourceName';

const probe=window as any;
probe.progress={};probe.renders={};probe.retries={};
const initial={done:0,total:229,label:'waiting',failed:[],cached:0};
function Card({id}:{id:string}){
 probe.renders[id+'-card']=(probe.renders[id+'-card']||0)+1;
 return <article className="paper" aria-label={`Authored card ${id}`}>Authored card {id}: HP 17 / 20; resource 1 / 3.</article>;
}
function App({id}:{id:string}){
 probe.renders[id]=(probe.renders[id]||0)+1;
 const [store]=useState(()=>catalogProgressStore(initial)),[loading,setLoading]=useState(true),[searchStatus,setSearchStatus]=useState('');
 probe.progress[id]={store,setLoading,setSearchStatus};
 return <section id={id}><h1>Instance {id}</h1><Card id={id}/><CatalogLoadStatus store={store} loading={loading} entryCount={12} matchedCount={3} searchStatus={searchStatus} retry={keys=>{probe.retries[id]=keys;}}/></section>;
}
const SourceConsumer=memo(function SourceConsumer(){
 const context=useSources();probe.sourceRenders=(probe.sourceRenders||0)+1;probe.sources=context;
 return <output id="source-label">{context.format('TEST_PROGRESS_SOURCE')}</output>;
});
const sourceChild=<SourceConsumer/>;
function Sources(){
 const [tick,setTick]=useState(0);
 return <section><button onClick={()=>setTick(value=>value+1)}>Parent render {tick}</button><SourceProvider>{sourceChild}</SourceProvider></section>;
}
createRoot(document.getElementById('root')!).render(<><App id="first"/><App id="second"/><Sources/></>);
