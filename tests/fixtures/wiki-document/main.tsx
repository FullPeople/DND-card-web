import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {newCharacter,type Entry} from '../../../src/core/model';
import {LibraryDocument} from '../../../src/ui/LibraryDocument';
import {SourceProvider} from '../../../src/ui/SourceName';
import {UiLanguageProvider} from '../../../src/ui/UiLanguage';

const probe=(window as any).documentWork={bodyReads:0,parentRenders:0,lastLink:'',lastInspect:'',lastCollapse:''};
const raw={name:'Authored Reader',reprintedAs:['Authored Reader|XPHB']};
const body=Array.from({length:120},(_,index)=>({type:'entries',name:`Authored section ${index}`,entries:[`Authored paragraph ${index}. {@spell Authored Spark|PHB}`]}));
const primary:Entry={id:'reader-2014',kind:'class',name:'Authored Reader',english:'Authored Reader',source:'PHB',edition:'2014',packId:'authored',revision:'1',entries:body,get raw(){probe.bodyReads++;return raw;}};
const replacement:Entry={id:'reader-2024',kind:'class',name:'Authored Reader',english:'Authored Reader',source:'XPHB',edition:'2024',packId:'authored',revision:'1',entries:['Updated authored document.'],raw:{}};
const subclass=(edition:'2014'|'2024'):Entry=>({id:`sub-${edition}`,kind:'subclass',name:`Authored Subclass ${edition}`,english:`Authored Subclass ${edition}`,source:edition==='2014'?'PHB':'XPHB',edition,packId:'authored',revision:'1',entries:[`Authored subclass body ${edition}.`],raw:{className:'Authored Reader',classSource:'PHB'}});
const entries=[primary,replacement,subclass('2014'),subclass('2024')];

function App(){
 probe.parentRenders++;
 const [query,setQuery]=useState(''),[entry,setEntry]=useState(primary),[character,setCharacter]=useState(()=>{const value=newCharacter('2014');value.profile.enabledSources=['PHB','XPHB'];value.profile.optional.legacy=true;return value;}),[collapsed,setCollapsed]=useState<string[]>([]),[subclasses,setSubclasses]=useState(false),[edition,setEdition]=useState('all');
 return <><input aria-label="Unrelated search" value={query} onChange={event=>setQuery(event.target.value)}/><output id="query">{query}</output>
  <button onClick={()=>setEntry(replacement)}>Replace entry</button>
  <button onClick={()=>setCharacter(value=>({...value,profile:{...value.profile,disabledEntries:[entry.id]}}))}>Disable entry</button>
  <button onClick={()=>setSubclasses(value=>!value)}>Toggle subclasses</button>
  <button onClick={()=>setEdition('2014')}>Show 2014</button>
  <button onClick={()=>setCharacter(value=>({...value,profile:{...value.profile,enabledSources:['PHB']}}))}>Only PHB source</button>
  <article className="entry-detail" style={{height:500,overflow:'auto'}}><div className="detail-frozen">Authored reader fixture</div><LibraryDocument entry={entry} entries={entries} character={character} editionFilter={edition} subclassesOpen={subclasses} collapsed={collapsed.length?collapsed:[]} onCollapse={ids=>{probe.lastCollapse=query;setCollapsed(ids);}} inspect={value=>{probe.lastInspect=`${query}:${value.id}`;}} onLink={(reference,kind)=>{probe.lastLink=`${query}:${kind}:${reference}`;}}/></article>
 </>;
}
createRoot(document.getElementById('root')!).render(<UiLanguageProvider><SourceProvider><App/></SourceProvider></UiLanguageProvider>);
