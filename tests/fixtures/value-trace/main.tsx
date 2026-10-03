import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {type Ability} from '../../../src/core/model';
import {irCharacter as newCharacter,irFixture} from '../../helpers/irFixture';
import {evaluate} from '../../../src/core/engine';
import {NumberInput} from '../../../src/ui/NumberInput';
import {ValueTraceProvider} from '../../../src/ui/ValueTrace';
function make(id='first'){
 const c=newCharacter();c.id=id;c.abilities.str=id==='first'?10:6;c.abilities.dex=7;c.abilities.con=8;
 c.selections=[{id:'fixture-effect',level:1,quantity:1,equipped:false,entry:irFixture({id:'fixture-effect',name:'原创属性加值',english:'Authored Score Modifier',kind:'feature',source:'XPHB',edition:'2024',packId:'fixture',revision:'1',raw:{},entries:[],effects:[{op:'add',target:'str',value:2},{op:'add',target:'dex',value:3},{op:'add',target:'con',value:1}]})}];return c;
}
function App(){
 const [c,setC]=useState(make),[edits,setEdits]=useState(0),[enabled,setEnabled]=useState(true);const d=evaluate(c);
 const change=(ability:Ability,value:string)=>{setEdits(n=>n+1);setC(old=>({...old,abilities:{...old.abilities,[ability]:Number(value)}}));};
 return <main style={{margin:'120px',fontFamily:'Arial'}}><button aria-label="之前">之前</button><ValueTraceProvider c={c} d={d} enabled={enabled}><section style={{display:'flex',gap:'340px',margin:'80px 0'}}>{([['str','力量'],['dex','敏捷']] as const).map(([ability,name])=><NumberInput key={ability} aria-label={`${name}基础值`} value={c.abilities[ability]} displayValue={d.abilities[ability]} readOnly={!enabled} onChange={e=>change(ability,e.target.value)} style={{width:80,height:44,fontSize:28,textAlign:'center'}}/>)}<NumberInput aria-label="体质基础值" value={c.abilities.con} displayValue={d.abilities.con} readOnly style={{width:80,height:44,fontSize:28}}/></section></ValueTraceProvider><button aria-label="之后">之后</button><button onClick={()=>setC(make('second'))}>切换角色</button><button onClick={()=>setEnabled(value=>!value)}>切换编辑</button><pre id="data">{JSON.stringify({abilities:c.abilities,edits,id:c.id})}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
