#!/usr/bin/env node
// Regenerates the vendored icon modules from lucide-static (ISC). Run after
// changing a mapping below or bumping the lucide-static dev dependency:
//   node tools/lucideIcons.mjs            # writes src/ui/icons.tsx
//   node tools/lucideIcons.mjs --plugin /path/to/obr-suite   # also writes its src/icons.ts
// Keeping the SVG data in the repository means builds need no icon package at
// runtime, and the attribution travels with the code (public/third-party-licenses.txt).
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(join(root,'package.json'));
const lucideRoot=dirname(require.resolve('lucide-static/package.json'));
const lucide=JSON.parse(readFileSync(join(lucideRoot,'package.json'),'utf8'));
const nodes=JSON.parse(readFileSync(join(lucideRoot,'icon-nodes.json'),'utf8'));
const credit=`Lucide Icons v${lucide.version} (https://lucide.dev), ISC License, Copyright (c) 2026 Lucide Icons and Contributors; glyphs inherited from Feather are MIT, Copyright (c) 2013-present Cole Bemis.`;

/** React component name → Lucide icon name. */
export const WEB={
 BookIcon:'book-user',PaletteIcon:'palette',CloudIconGlyph:'cloud',CloudUploadIcon:'cloud-upload',CloudCheckIcon:'cloud-check',CloudOffIcon:'cloud-off',CloudDownloadIcon:'cloud-download',
 UserIcon:'user-round',UsersIcon:'users-round',IdCardIcon:'id-card',KeyIcon:'key-round',ShieldIcon:'shield',ShieldCheckIcon:'shield-check',BadgeCheckIcon:'badge-check',LogInIcon:'log-in',LogOutIcon:'log-out',
 SlidersIcon:'sliders-horizontal',GearIcon:'settings',WrenchIcon:'wrench',TransferIcon:'arrow-right-left',MegaphoneIcon:'megaphone',BellIcon:'bell',InfoIcon:'info',HelpIcon:'circle-question-mark',WarningIcon:'triangle-alert',CircleAlertIcon:'circle-alert',
 UndoIcon:'undo-2',RedoIcon:'redo-2',RefreshIcon:'refresh-cw',RotateIcon:'rotate-ccw',ExpandIcon:'maximize-2',CollapseIcon:'minimize-2',FullscreenIcon:'fullscreen',
 LockClosedIcon:'lock',LockOpenIcon:'lock-open',CloseIcon:'x',CheckIcon:'check',CircleCheckIcon:'circle-check',CircleXIcon:'circle-x',PlusIcon:'plus',MinusIcon:'minus',CirclePlusIcon:'circle-plus',
 ChevronDownIcon:'chevron-down',ChevronUpIcon:'chevron-up',ChevronRightIcon:'chevron-right',ChevronLeftIcon:'chevron-left',ChevronsUpDownIcon:'chevrons-up-down',ArrowUpIcon:'arrow-up',ArrowDownIcon:'arrow-down',ArrowLeftIcon:'arrow-left',ArrowRightIcon:'arrow-right',ArrowUpDownIcon:'arrow-up-down',
 SearchIcon:'search',FunnelIcon:'funnel',ExternalIcon:'external-link',LinkIcon:'link',UnlinkIcon:'unlink',ShareIcon:'share-2',QrIcon:'qr-code',CopyIcon:'copy',ClipboardIcon:'clipboard-copy',
 PageIcon:'file-text',SheetIcon:'file-spreadsheet',ImageIcon:'image',SaveIcon:'save',DownloadIcon:'download',UploadIcon:'upload',FolderOpenIcon:'folder-open',TrashIcon:'trash',EditIcon:'pencil',NotebookIcon:'notebook-pen',ScrollIcon:'scroll-text',
 ScreenIcon:'monitor',GridIcon:'layout-grid',ListIcon:'list',ListChecksIcon:'list-checks',TableIcon:'table',ColumnsIcon:'columns-2',PanelLeftIcon:'panel-left',LayersIcon:'layers',MenuIcon:'menu',EllipsisIcon:'ellipsis',GripIcon:'grip-vertical',MoveIcon:'move',
 LocateIconGlyph:'locate-fixed',MapPinIcon:'map-pin',PinIcon:'pin',BookmarkIcon:'bookmark',TagIcon:'tag',HashIcon:'hash',StarIcon:'star',HeartIcon:'heart',SparklesIcon:'sparkles',WandIcon:'wand-sparkles',FlameIcon:'flame',SkullIcon:'skull',SwordsIcon:'swords',BackpackIcon:'backpack',BookOpenIcon:'book-open',
 BoltIcon:'zap',DiceIcon:'dices',EyeIcon:'eye',EyeOffIcon:'eye-off',SunIcon:'sun',MoonIcon:'moon',SunMoonIcon:'sun-moon',BrushIcon:'paintbrush',SwatchIcon:'swatch-book',PipetteIcon:'pipette',
 WifiIcon:'wifi',WifiOffIcon:'wifi-off',SpinnerIcon:'loader-circle',PlugIcon:'plug',PowerIcon:'power',ActivityIcon:'activity',DatabaseIcon:'database',GlobeIcon:'globe',LanguagesIcon:'languages',HouseIcon:'house',
 PlayIcon:'play',PauseIcon:'pause',SendIcon:'send',LightbulbIcon:'lightbulb',HistoryIcon:'timer-reset',
};
/** Plugin ICONS key → Lucide icon name; keys absent here keep their drawings. */
export const PLUGIN={
 box:'package',telescope:'telescope',music:'music',eye:'eye',eyeOff:'eye-off',pin:'pin',library:'library-big',books:'book-copy',book:'book',clockPause:'timer-off',crosshair:'crosshair',idCard:'id-card',swords:'swords',search:'search',coffee:'coffee',heart:'heart',heartSpark:'heart-pulse',mail:'mail',user:'user-round',warning:'triangle-alert',check:'check',checkCircle:'circle-check',xCircle:'circle-x',sparkle4:'sparkle',sparkles:'sparkles',zap:'zap',shield:'shield',star:'star',stop:'square',portal:'circle-dot-dashed',trickster:'drama',circleImage:'circle-user-round',follow:'navigation',close:'x',chevronDown:'chevron-down',chevronRight:'chevron-right',chevronUp:'chevron-up',chevronLeft:'chevron-left',refresh:'refresh-cw',undo:'undo-2',redo:'redo-2',folder:'folder',clipboard:'clipboard',upload:'upload',download:'download',lock:'lock',link:'link',trash:'trash',plus:'plus',minus:'minus',grip:'grip-vertical',edit:'pencil',film:'film',phone:'smartphone',chart:'chart-column',die:'dice-6',moon:'moon',scales:'scale',help:'circle-question-mark',hand:'hand',brush:'paintbrush',eraser:'eraser',circle:'circle',hexagon:'hexagon',wand:'wand-sparkles',bucket:'paint-bucket',drop:'droplet',door:'door-open',ruler:'ruler',gear:'settings',magnet:'magnet',fit:'scan',
 spinner:'loader-circle',wifi:'wifi',wifiOff:'wifi-off',info:'info',copy:'copy',logIn:'log-in',logOut:'log-out',users:'users-round',key:'key-round',image:'image',save:'save',externalLink:'external-link',sun:'sun',palette:'palette',list:'list',grid:'layout-grid',settings2:'sliders-horizontal',badgeCheck:'badge-check',history:'timer-reset',bell:'bell',send:'send',qr:'qr-code',
};

const camel=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const node=(icon)=>{const shape=nodes[icon];if(!shape)throw Error('Unknown Lucide icon: '+icon);return shape;};
const jsx=icon=>node(icon).map(([tag,attrs])=>`<${tag}${Object.entries(attrs).map(([k,v])=>` ${k.startsWith('data-')?k:camel(k)}="${v}"`).join('')}/>`).join('');
const html=icon=>node(icon).map(([tag,attrs])=>`<${tag}${Object.entries(attrs).map(([k,v])=>` ${k}="${v}"`).join('')}/>`).join('');

export function webModule(){
 return `import type {CSSProperties,SVGProps} from 'react';
/* Generated by tools/lucideIcons.mjs — edit the mapping there, not this file.
 * ${credit}
 * Full licence texts: public/third-party-licenses.txt.
 * One family: 24-unit grid, stroke 2, round caps and joins. An icon is sized
 * by its owning control (.ui-icon size classes in uiRefresh.css) and is
 * decorative; the control carries the accessible name. */
export const ICON_CREDIT=${JSON.stringify(`图标：Lucide v${lucide.version}（ISC 许可）`)};
export type IconProps=SVGProps<SVGSVGElement>&{size?:number|string};
export function Icon({size,children,className,style,...rest}:IconProps){
 // An explicit size wins over the --icon the surrounding control sets (uiRefresh.css).
 const sized=size===undefined?style:{...style,'--icon':typeof size==='number'?size+'px':size} as CSSProperties;
 return <svg className={\`ui-icon\${className?' '+className:''}\`} viewBox="0 0 24 24" width={size??'1em'} height={size??'1em'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={sized} {...rest}>{children}</svg>;
}
${Object.entries(WEB).map(([name,icon])=>`/** lucide: ${icon} */\nexport const ${name}=(p:IconProps)=><Icon {...p}>${jsx(icon)}</Icon>;`).join('\n')}
`;
}

export function pluginModule(previous){
 // Entries that are not mapped keep their current artwork verbatim.
 const kept=[];const lines=previous.split('\n');
 for(let i=0;i<lines.length;i++){const m=lines[i].match(/^  ([a-zA-Z0-9_]+): svg\(/);if(!m||PLUGIN[m[1]])continue;
  const block=[];let j=i;while(j>i-6&&j>0&&/^\s*\/\//.test(lines[j-1]))j--;for(let k=j;k<i;k++)block.push(lines[k]);
  let depth=0;for(let k=i;k<lines.length;k++){block.push(lines[k]);depth+=(lines[k].match(/\(/g)||[]).length-(lines[k].match(/\)/g)||[]).length;if(depth<=0)break;}
  kept.push(block.join('\n'));}
 return `// Generated by DND-card-web/tools/lucideIcons.mjs --plugin — edit the mapping there.
// ${credit}
// Full licence texts: THIRD-PARTY-NOTICES.md. Entries marked "custom" are this
// project's own drawings (dragon, d20, status wheel, sort triangles).
//
// Inline SVG strings share a 24×24 viewBox, currentColor strokes and 1em
// sizing, so an icon follows the font size of the control that contains it.
// Use in HTML templates:   \`\${ICONS.swords} 武器 / 攻击\`
// Use in Preact JSX:       <span dangerouslySetInnerHTML={{ __html: ICONS.swords }} />
export const ICON_CREDIT = ${JSON.stringify(`图标：Lucide v${lucide.version}（ISC 许可）`)};

function svg(content: string, opts: { fill?: string; sw?: number } = {}): string {
  const fill = opts.fill ?? "none";
  const sw = opts.sw ?? 2;
  return (
    \`<svg class="ui-icon" width="1.15em" height="1.15em" viewBox="0 0 24 24" fill="\${fill}" \` +
    \`stroke="currentColor" stroke-width="\${sw}" stroke-linecap="round" stroke-linejoin="round" \` +
    \`aria-hidden="true" focusable="false" style="vertical-align:-0.22em;flex:none">\${content}</svg>\`
  );
}

export const ICONS = {
${Object.entries(PLUGIN).map(([key,icon])=>`  // lucide: ${icon}\n  ${key}: svg(\`${html(icon)}\`),`).join('\n')}
  // custom
${kept.join('\n')}
};

export type IconName = keyof typeof ICONS;
`;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 writeFileSync(join(root,'src/ui/icons.tsx'),webModule());console.log('wrote src/ui/icons.tsx ('+Object.keys(WEB).length+' icons)');
 const flag=process.argv.indexOf('--plugin');
 if(flag>0){const plugin=resolve(process.argv[flag+1]||''),file=join(plugin,'src/icons.ts');if(!existsSync(file))throw Error('No plugin icon module at '+file);writeFileSync(file,pluginModule(readFileSync(file,'utf8')));console.log('wrote '+file);}
}
