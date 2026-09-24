import { useMemo } from 'react';
import type { Character, Entry } from '../core/model';
export function ClassNavigation({entry,entries,character,navigate,subclassesOpen=false,onToggleSubclasses}:{subclassesOpen?:boolean;onToggleSubclasses?:()=>void;entry:Entry;entries:Entry[];character:Character;navigate:(entry:Entry,focus?:string)=>void}){
 const parent=useMemo(()=>entry.kind==='class'?entry:entry.kind==='subclass'?entries.find(e=>e.kind==='class'&&[e.name,e.english].includes(entry.raw.className)&&e.source===(entry.raw.classSource||'PHB').toUpperCase()):undefined,[entry,entries]);
 void character;
 if(!['class','subclass'].includes(entry.kind))return null;
 return <div className="class-navigation"><div className="class-jumps">{[['body','主体'],['subclasses','子职'],['progression','等级']].map(([id,label])=><button key={id} aria-expanded={id==='subclasses'?subclassesOpen:undefined} onClick={()=>{if(id==='subclasses'){onToggleSubclasses?.();return;}if(subclassesOpen)onToggleSubclasses?.();navigate(parent||entry,id);}}>{label}</button>)}</div></div>;
}
