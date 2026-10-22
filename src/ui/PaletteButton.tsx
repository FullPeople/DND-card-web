import type {ButtonHTMLAttributes} from 'react';
import '../platform/appearance';
import './appearance.css';
import './paletteButton.css';
import {PaletteIcon} from './icons';

export function PaletteButton({open,toggle,label='调色盘',controls='palette-drawer',className='',...rest}:{open:boolean;toggle:()=>void;label?:string;controls?:string}&ButtonHTMLAttributes<HTMLButtonElement>){
 return <button type="button" className={`palette-toggle icon-button ${className}`} aria-label={label} aria-expanded={open} aria-controls={controls} aria-pressed={open} onClick={toggle} {...rest}><PaletteIcon size={20}/></button>;
}
