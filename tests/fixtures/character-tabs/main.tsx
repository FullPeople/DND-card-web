import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CharacterTabs} from '../../../src/ui/CharacterTabs';
import '../../../src/ui/characterTabs.css';
import type {Character} from '../../../src/core/model';
const cards=Array.from({length:8},(_,i)=>({id:'tab-'+i,name:'Long character name '+i} as Character)),warnings=new Set<string>();
function Fixture(){const [active,setActive]=useState(cards[0].id),[wide,setWide]=useState(false);return <><button onClick={()=>setWide(v=>!v)}>resize strip</button><div style={{width:wide?380:210}}><CharacterTabs characters={cards} activeId={active} warnings={warnings} label="fixture characters" select={setActive}/></div><output>{active}</output></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
