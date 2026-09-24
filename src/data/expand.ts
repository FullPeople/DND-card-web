import type { Raw } from '../core/model';

const list = (v: any): any[] => Array.isArray(v) ? v : v == null ? [] : [v];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const metadata = new Set(['page', 'otherSources', 'additionalSources', 'referenceSources', 'reprintedAs', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'hasFluff', 'hasFluffImages']);

/** Resolve declarative source copies without executing expressions or scripts. */
export function expandCopies(items: Raw[], templates: Raw[] = []): Raw[] {
  const memo = new Map<Raw, Raw>();
  function resolve(item: Raw, seen = new Set<Raw>()): Raw {
    if (!item._copy) return item;
    if (memo.has(item)) return memo.get(item)!;
    if (seen.has(item)) return item;
    const copy = item._copy;
    const parent = items.find(p => p !== item && (copy.abbreviation ? p.abbreviation === copy.abbreviation : [p.name, p.ENG_name].includes(copy.name)) && (p.source || p.inherits?.source) === copy.source && (!copy.raceName || p.raceName === copy.raceName) && (!copy.raceSource || p.raceSource === copy.raceSource));
    if (!parent) return item;
    const base = structuredClone(resolve(parent, new Set([...seen, item])));
    if (base._copy) return item;
    for (const key of metadata) if (!copy._preserve?.[key] && !copy._preserve?.['*']) delete base[key];
    const applied = (copy._templates || []).map((t:Raw)=>templates.find(v=>[v.name,v.ENG_name].includes(t.name)&&v.source===t.source));
    if(applied.some((t:Raw|undefined)=>!t))return item;
    for(const template of applied)Object.assign(base,structuredClone(template.apply?._root||{}));
    const result = { ...base, ...structuredClone(item) };
    const modifications: Raw={};
    for(const mods of [copy._mod||{},...applied.map((t:Raw)=>t.apply?._mod||{})])for(const [path,changes] of Object.entries(mods))modifications[path]=[...(modifications[path]||[]),...list(changes)];
    for (const [key, value] of Object.entries(item)) if (value === null) delete result[key];
    let supported = true;
    for (const [path, changes] of Object.entries(modifications)) {
      if (path.split('.').some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) { supported = false; continue; }
      const segments = path.split('.'), key = segments.pop()!;
      let target: Raw = result;
      for (const segment of segments) target = target[segment] ||= {};
      for (const change of list(changes)) {
        if (change === 'remove') { delete target[key]; continue; }
        if (change.mode === 'setProp') {const parts=(change.prop ? (path==='_'?'':path+'.')+change.prop : path).split('.');if(parts.some((p:string)=>['__proto__','constructor','prototype'].includes(p))){supported=false;continue;}let dst=result;for(const p of parts.slice(0,-1))dst=dst[p]||={};if(change.value===null)delete dst[parts.at(-1)!];else dst[parts.at(-1)!]=structuredClone(change.value);continue;}
        if (change.mode === 'addSenses') {result.senses||=[];for(const sense of list(change.senses)){const label=({darkvision:'黑暗视觉',blindsight:'盲视',tremorsense:'震颤感知',truesight:'真实视觉'} as Record<string,string>)[sense.type]||sense.type;const index=result.senses.findIndex((v:string)=>v.startsWith(label)||v.startsWith(sense.type));if(index<0)result.senses.push(`${label} ${sense.range}尺`);else if(Number(String(result.senses[index]).match(/\d+/)?.[0]||0)<sense.range)result.senses[index]=`${label} ${sense.range}尺`;}continue;}
        if (change.mode === 'addSkills') {const abilities:Record<string,string>={athletics:'str',acrobatics:'dex','sleight of hand':'dex',stealth:'dex',arcana:'int',history:'int',investigation:'int',nature:'int',religion:'int','animal handling':'wis',insight:'wis',medicine:'wis',perception:'wis',survival:'wis',deception:'cha',intimidation:'cha',performance:'cha',persuasion:'cha'};const cr=Number(result.cr?.cr||result.cr)||0,pb=Math.max(2,Math.ceil(cr/4)+1);result.skill||={};for(const [skill,mult] of Object.entries(change.skills)){const bonus=Math.floor(((result[abilities[skill]]||10)-10)/2)+pb*Number(mult);result.skill[skill]=`${bonus>=0?'+':''}${Math.max(Number(result.skill[skill]||-99),bonus)}`;}continue;}
        if (['addSpells','replaceSpells','removeSpells'].includes(change.mode)) {const caster=result.spellcasting?.[0];if(!caster){supported=false;continue;}const apply=(current:any[],updates:any)=>change.mode==='addSpells'?[...current,...list(updates)]:change.mode==='removeSpells'?current.filter(v=>!list(updates).includes(v)):current.flatMap(v=>{const update=list(updates).find(x=>x.replace===v);return update?list(update.with):[v];});for(const [field,updates] of Object.entries(change)){if(field==='mode')continue;if(field==='spells'){caster.spells||={};for(const [level,data] of Object.entries(updates as Raw)){caster.spells[level]||={spells:[]};if(change.mode==='addSpells')Object.assign(caster.spells[level],{...data as Raw,spells:apply(caster.spells[level].spells,(data as Raw).spells)});else caster.spells[level].spells=apply(caster.spells[level].spells,data);}}else if(Array.isArray(updates))caster[field]=apply(caster[field]||[],updates);else{caster[field]||={};for(const [frequency,data] of Object.entries(updates as Raw))caster[field][frequency]=apply(caster[field][frequency]||[],data);}}continue;}
        if (change.mode === 'replaceTxt' && typeof change.replace === 'string') {
          // Only source-declared regular expressions; reject unbounded nested repetition.
          if(change.replace.length>1000 || /\([^)]*[+*][^)]*\)[+*{]/.test(change.replace)){supported=false;continue;}
          let regex:RegExp;try{regex=new RegExp(change.replace,change.flags?.includes('i')?'gi':'g');}catch{supported=false;continue;}
          const replace=(v:any):any=>typeof v==='string'?v.replace(regex,String(change.with)):Array.isArray(v)?v.map(replace):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,['name','ENG_name'].includes(k) && !change.props?.includes(k) ? value : replace(value)])):v;
          if(path==='*'){for(const field of ['trait','action','bonus','reaction','legendary','mythic','variant','spellcasting','entries'])if(result[field])result[field]=replace(result[field]);}else target[key]=replace(target[key]);continue;
        }
        if (['scalarAddHit','scalarAddDc'].includes(change.mode)) {const tag=change.mode==='scalarAddHit'?'hit':'dc';const regex=new RegExp(`\\{@${tag} ([+-]?\\d+)(?=[|}])`,'g');const walk=(v:any):any=>typeof v==='string'?v.replace(regex,(_,n)=>`{@${tag} ${Number(n)+change.scalar}`):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)])):v;target[key]=walk(target[key]);continue;}
        if (['scalarAddProp','scalarMultProp','prefixSuffixStringProp'].includes(change.mode)) {if(!target[key])continue;const props=change.prop==='*'?Object.keys(target[key]):[change.prop];for(const prop of props){if(['__proto__','constructor','prototype'].includes(prop)){supported=false;continue;}const current=target[key][prop];if(current==null)continue;if(change.mode==='prefixSuffixStringProp')target[key][prop]=`${change.prefix||''}${current}${change.suffix||''}`;else{let value=change.mode==='scalarAddProp'?Number(current)+change.scalar:Number(current)*change.scalar;if(change.floor)value=Math.floor(value);target[key][prop]=typeof current==='string'?`${value>=0?'+':''}${value}`:value;}}continue;}
        if (change.mode==='maxSize') {const order=['T','S','M','L','H','G'];result.size=list(result.size).map(v=>order.indexOf(v)>order.indexOf(change.max)?change.max:v);continue;}
        if (change.mode==='scalarMultXp') {const xp:Record<string,number>={'0':10,'1/8':25,'1/4':50,'1/2':100};const values=[0,200,450,700,1100,1800,2300,2900,3900,5000,5900,7200,8400,10000,11500,13000,15000,18000,20000,22000,25000,33000,41000,50000,62000,75000,90000,105000,120000,135000,155000];const cr=typeof result.cr==='object'?result.cr:{cr:result.cr};const value=(cr.xp??xp[cr.cr]??values[Number(cr.cr)])*change.scalar;result.cr={...cr,xp:change.floor?Math.floor(value):value};continue;}
        const values = list(target[key]), additions = structuredClone(list(change.items));
        if (change.mode === 'appendArr') target[key] = [...values, ...additions];
        else if (change.mode === 'prependArr') target[key] = [...additions, ...values];
        else if (change.mode === 'appendIfNotExistsArr') target[key] = [...values, ...additions.filter(a => !values.some(b => same(a, b)))];
        else if (change.mode === 'insertArr') { values.splice(change.index < 0 ? values.length : change.index, 0, ...additions); target[key] = values; }
        else if (change.mode === 'replaceArr' || change.mode === 'replaceOrAppendArr') {
          const at = typeof change.replace?.index === 'number' ? change.replace.index : values.findIndex(v => v === change.replace || v?.name === change.replace || v?.ENG_name === change.replace);
          if (at >= 0 && at < values.length) values.splice(at, 1, ...additions);
          else if (change.mode === 'replaceOrAppendArr') values.push(...additions);
          else supported = false;
          target[key] = values;
        } else if (change.mode === 'removeArr') target[key] = values.filter(v => !list(change.names).includes(v?.name) && !list(change.names).includes(v?.ENG_name) && !list(change.items).some(x => same(x, v)));
        else supported = false;
      }
    }
    if (!supported) return item;
    delete result._copy;
    result._copySource = { name: copy.name, source: copy.source };
    const pb=Math.max(2,Math.ceil((Number(result.cr?.cr||result.cr)||0)/4)+1);
    const substitute=(v:any):any=>typeof v==='string'?v.replace(/<\$([^$]+)\$>/g,(whole,key)=>['name','short_name','title_short_name'].includes(key)?String(result.shortName||result.name):key.startsWith('spell_dc__')?String(8+pb+Math.floor(((result[key.slice(10)]||10)-10)/2)):whole):Array.isArray(v)?v.map(substitute):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([key,value])=>[key,substitute(value)])):v;
    const expanded=substitute(result);memo.set(item, expanded); return expanded;
  }
  return items.map(item => resolve(item));
}

const damage: Record<string, string> = { acid: '强酸', cold: '寒冷', fire: '火焰', force: '力场', lightning: '闪电', necrotic: '暗蚀', poison: '毒素', psychic: '心灵', radiant: '光耀', thunder: '雷鸣', bludgeoning: '钝击', piercing: '穿刺', slashing: '挥砍' };
function substitute(value: any, item: Raw): any {
  if (typeof value === 'string') return value.replace(/\{\{item\.([\w.]+)}}|\{=([\w]+)(?:\/[^}]+)?}/g, (whole, field, short) => {
    const found = (field || short).split('.').reduce((v: any, k: string) => v?.[k], item);
    return found == null ? whole : list(found).map(v => damage[v] || String(v)).join('、');
  });
  if (Array.isArray(value)) return value.map(v => substitute(v, item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, item)]));
  return value;
}

export function expandItemBody(raw: Raw, body: Raw): Raw {
  function expand(value: any, seen = new Set<string>()): any {
    if (Array.isArray(value)) return value.map(v => expand(v, seen));
    const ref = typeof value === 'string' ? /^\{#itemEntry ([^}]+)}$/.exec(value)?.[1] : value?.type === 'refItemEntry' ? value.itemEntry : undefined;
    if (ref && !seen.has(ref)) {
      const [name, source = 'DMG'] = ref.split('|');
      const template = (body.itemEntry || []).find((e: Raw) => [e.name, e.ENG_name].includes(name) && e.source.toLowerCase() === source.toLowerCase());
      if (template) return expand(substitute(template.entriesTemplate || template.entries, raw), new Set([...seen, ref]));
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, seen)]));
    return substitute(value, raw);
  }
  const entries = expand(raw.entries || []);
  for (const [field, category, key] of [['type', 'itemType', 'abbreviation'], ['property', 'itemProperty', 'abbreviation'], ['mastery', 'itemMastery', 'name']]) {
    for (const uid of list(raw[field])) {
      const [name, source = 'PHB'] = String(uid?.uid || uid).split('|');
      const found = (body[category] || []).find((v: Raw) => v[key] === name && (v.source || 'PHB').toLowerCase() === source.toLowerCase());
      if (found?.entries?.length) {
        const section = { type: 'entries', name: found.name, entries: expand(found.entries) };
        if (!entries.some((e: unknown) => same(e, section))) entries.push(section);
      }
    }
  }
  return { ...raw, entries, additionalEntries: expand(raw.additionalEntries || []) };
}

export function prepareBody(body: Raw): Raw {
  const result = { ...body };
  const equipment = expandCopies([...(body.baseitem || []), ...(body.item || []), ...(body.itemGroup || [])]);
  let offset = 0;
  for (const key of ['baseitem', 'item', 'itemGroup']) { const size = body[key]?.length || 0; if (body[key]) result[key] = equipment.slice(offset, offset + size).map(raw => expandItemBody(raw, body)); offset += size; }
  for (const key of Object.keys(body)) if (Array.isArray(body[key]) && !['baseitem', 'item', 'itemGroup'].includes(key)) result[key] = expandCopies(body[key]);
  if (result.magicvariant) result.magicvariant = result.magicvariant.map((raw: Raw) => {
    const merged = { ...raw.inherits, ...raw, source: raw.source || raw.inherits?.source };
    return expandItemBody(merged, body);
  });
  return result;
}

export function expandVersions(raw: Raw): Raw[] {
  const output: Raw[] = [];
  for (const version of raw._versions || []) {
    const versions = version._abstract ? (version._implementations || []).map((implementation: Raw) => {
      const variables = implementation._variables || {};
      const replace = (v: any): any => typeof v === 'string' ? v.replace(/\{\{(\w+)}}/g, (all, key) => variables[key] ?? all) : Array.isArray(v) ? v.map(replace) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, value]) => [k, replace(value)])) : v;
      return replace({ ...version._abstract, ...implementation });
    }) : [version];
    for (const variant of versions) {
      const base = { ...raw }; delete base._versions;
      const item = { ...variant, _copy: { name: base.name, source: base.source, _preserve: { '*': true }, _mod: variant._mod } };
      const expanded = expandCopies([base, item])[1];
      expanded._versionBaseName = raw.name;
      delete expanded._mod; delete expanded._variables;
      output.push(expanded);
    }
  }
  return output;
}

/** The upstream catalog stores magic item families as templates, not concrete weapons. */
export function specificMagicItems(body: Raw): Raw[] {
  const result: Raw[] = [];
  const match = (candidate: any, conditions: any, all: boolean): boolean => {
    if (!candidate || !conditions) return false;
    const checks = Object.entries(conditions).map(([key, value]) => Array.isArray(value) ? list(candidate[key]).some(v => value.includes(v)) : value && typeof value === 'object' ? match(candidate[key], value, all) : list(candidate[key]).includes(value));
    return all ? checks.every(Boolean) : checks.some(Boolean);
  };
  const edition = (raw: Raw) => ['classic', '经典'].includes(raw.edition) || ['PHB', 'DMG'].includes(raw.source) ? '2014' : ['one', '一'].includes(raw.edition) || ['XPHB', 'XDMG'].includes(raw.source) ? '2024' : '';
  for (const base of body.baseitem || []) for (const variant of body.magicvariant || []) {
    if (base.packContents || base._copy || variant._copy || !variant.inherits) continue;
    if (edition(base) && edition(variant) && edition(base) !== edition(variant)) continue;
    if (!list(variant.requires).some(req => match(base, req, true)) || match(base, variant.excludes, false)) continue;
    const inherits = variant.inherits, item = { ...structuredClone(base), ...structuredClone(inherits) };
    for (const key of ['value', ...metadata]) if (!(key in inherits)) delete item[key];
    const name = inherits.nameRemove ? base.name.split(inherits.nameRemove).join('') : base.name;
    item.name = `${inherits.namePrefix || ''}${name}${inherits.nameSuffix || ''}`;
    item.ENG_name = `${base.ENG_name || base.name} (${variant.ENG_name || variant.name})`;
    item.edition = edition(base) === '2014' ? 'classic' : edition(base) === '2024' ? 'one' : variant.edition;
    item._variantIdentity = `${base.source}|${base.ENG_name || base.name}|${variant.source}|${variant.ENG_name || variant.name}`;
    item.baseItem = `${base.name}|${base.source}`;
    item.entries = [...substitute(inherits.entries || [], { ...base, ...inherits }), ...(base.entries || [])];
    if (inherits.propertyAdd) item.property = [...new Set([...(base.property || []), ...inherits.propertyAdd])];
    for (const field of ['weight', 'value']) {
      if (typeof inherits[`${field}Mult`] === 'number') item[field] = (base[field] || 0) * inherits[`${field}Mult`];
      const expression = inherits[`${field}Expression`];
      if (expression) {
        const parts = /^\[\[baseItem\.(weight|value)\]\]\s*([+*])\s*(\d+(?:\.\d+)?)$/.exec(expression);
        if (parts) item[field] = parts[2] === '*' ? (base[parts[1]] || 0) * Number(parts[3]) : (base[parts[1]] || 0) + Number(parts[3]);
        else item._unresolvedVariant = true;
      }
    }
    result.push(item);
  }
  return result;
}
