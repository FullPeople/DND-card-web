import type {SVGProps} from 'react';
/** One icon family for toolbars, dialogs and chips: 24-unit grid, 1.8 stroke,
 * round joins, sized by the surrounding font (1em) unless a class sets it.
 * Every icon is decorative; the owning control carries the accessible name. */
type IconProps=SVGProps<SVGSVGElement>&{size?:number|string};
function Icon({size,children,className,...rest}:IconProps){
 return <svg className={`ui-icon${className?' '+className:''}`} viewBox="0 0 24 24" width={size??'1em'} height={size??'1em'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{children}</svg>;
}
export const BookIcon=(p:IconProps)=><Icon {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5V5.5M20 18v3H6.5"/><path d="M9 7.5h7M9 11h7"/></Icon>;
export const PaletteIcon=(p:IconProps)=><Icon {...p}><path d="M12 3a9 9 0 1 0 0 18h1.3a2.1 2.1 0 0 0 1.5-3.6 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3c0-5-4-8.8-9-8.8Z"/><circle cx="7.2" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.4" cy="10.4" r="1.1" fill="currentColor" stroke="none"/></Icon>;
export const CloudIconGlyph=(p:IconProps)=><Icon {...p}><path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.5-1A4.5 4.5 0 0 0 7 18Z"/></Icon>;
export const CloudUploadIcon=(p:IconProps)=><Icon {...p}><path d="M7 18H6.5A4.5 4.5 0 0 1 6.5 9 6 6 0 0 1 18 10a4 4 0 0 1 0 8h-1"/><path d="M12 21v-8m0 0-3 3m3-3 3 3"/></Icon>;
export const CloudCheckIcon=(p:IconProps)=><Icon {...p}><path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11.5-1A4.5 4.5 0 0 0 7 18Z"/><path d="m9.5 13 2 2 3.5-4"/></Icon>;
export const UserIcon=(p:IconProps)=><Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></Icon>;
export const SlidersIcon=(p:IconProps)=><Icon {...p}><path d="M4 7h9m4 0h3M4 12h3m4 0h9M4 17h11m4 0h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/></Icon>;
export const TransferIcon=(p:IconProps)=><Icon {...p}><path d="M8 4v13m0 0-3.5-3.5M8 17l3.5-3.5M16 20V7m0 0-3.5 3.5M16 7l3.5 3.5"/></Icon>;
export const MegaphoneIcon=(p:IconProps)=><Icon {...p}><path d="M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1Z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5M8 15l1 5h2.5"/></Icon>;
export const UndoIcon=(p:IconProps)=><Icon {...p}><path d="M8 7H4V3"/><path d="M4.5 7.5A8 8 0 1 1 4 12.5"/></Icon>;
export const RedoIcon=(p:IconProps)=><Icon {...p}><path d="M16 7h4V3"/><path d="M19.5 7.5A8 8 0 1 0 20 12.5"/></Icon>;
export const ExpandIcon=(p:IconProps)=><Icon {...p}><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></Icon>;
export const CollapseIcon=(p:IconProps)=><Icon {...p}><path d="M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6"/></Icon>;
export const LockClosedIcon=(p:IconProps)=><Icon {...p}><rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5M12 14.5v2.5"/></Icon>;
export const LockOpenIcon=(p:IconProps)=><Icon {...p}><rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V7a4 4 0 0 1 7.6-1.7M12 14.5v2.5"/></Icon>;
export const CloseIcon=(p:IconProps)=><Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>;
export const ChevronDownIcon=(p:IconProps)=><Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
export const ChevronRightIcon=(p:IconProps)=><Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>;
export const ArrowUpIcon=(p:IconProps)=><Icon {...p}><path d="M12 19V5m0 0-6 6m6-6 6 6"/></Icon>;
export const ArrowDownIcon=(p:IconProps)=><Icon {...p}><path d="M12 5v14m0 0-6-6m6 6 6-6"/></Icon>;
export const CheckIcon=(p:IconProps)=><Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Icon>;
export const SearchIcon=(p:IconProps)=><Icon {...p}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></Icon>;
export const ExternalIcon=(p:IconProps)=><Icon {...p}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></Icon>;
export const PlusIcon=(p:IconProps)=><Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
export const MinusIcon=(p:IconProps)=><Icon {...p}><path d="M5 12h14"/></Icon>;
export const GearIcon=(p:IconProps)=><Icon {...p}><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 2 3-1 1-3 3-2-1-3 1-3-3-2-3 1Z"/><circle cx="12" cy="11" r="3"/></Icon>;
export const PageIcon=(p:IconProps)=><Icon {...p}><path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5M10 13h5m-5 4h5"/></Icon>;
export const ScreenIcon=(p:IconProps)=><Icon {...p}><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8m-4-4v4"/></Icon>;
export const EditIcon=(p:IconProps)=><Icon {...p}><path d="M4 20h4l11-11-4-4L4 16Z"/><path d="m13 7 4 4"/></Icon>;
export const InfoIcon=(p:IconProps)=><Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8.5v.5"/></Icon>;
export const LocateIconGlyph=(p:IconProps)=><Icon {...p}><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></Icon>;
export const BoltIcon=(p:IconProps)=><Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></Icon>;
export const LinkIcon=(p:IconProps)=><Icon {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/></Icon>;
export const DiceIcon=(p:IconProps)=><Icon {...p}><path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z"/><path d="M4 7l8 4.5L20 7M12 11.5v10"/></Icon>;
