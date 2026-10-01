import {useEffect,useState} from 'react';
import {SupporterMarquee} from './SupporterMarquee';
export function SupporterEffect(){const [show,setShow]=useState(false);useEffect(()=>{const receive=(event:Event)=>setShow(!!(event as CustomEvent).detail?.visible);window.addEventListener('suite-supporters',receive);return()=>window.removeEventListener('suite-supporters',receive);},[]);return show?<SupporterMarquee/>:null;}
