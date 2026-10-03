// Generated semantic adapter; no runtime dependencies.
import { envelopeSchema, overlaysSchema, recordSchema } from './schema-validation.js';
import { containsCjk, createIdentity, identityKey } from './identity.ts';
import { parseFormula } from './formula.ts';
import type { AutomationEnvelope, AutomationRecord, OverlayRecord } from './protocol.ts';

export interface ValidationIssue { code: string; path: string; message: string }
const bodyFields = new Set(['entries', 'entriesHigherLevel', 'additionalEntries', 'description', 'description.value', 'fluff', 'text']);
const editionForSource = (source: string): string | undefined => ['PHB', 'DMG', 'MM'].includes(source) ? '2014' : ['XPHB', 'XDMG', 'XMM'].includes(source) ? '2024' : undefined;
export const recordEdition = (record: AutomationRecord): string | undefined => record.edition === 'both' ? undefined : record.edition || editionForSource(record.identity.source);
function scan(value: unknown, issues: ValidationIssue[], path = '', depth = 0): void {
  if (depth > 48) { issues.push({ code: 'depth', path, message: 'Input nesting exceeds the validation limit' }); return; }
  if (typeof value === 'string') { if (containsCjk(value)) issues.push({ code: 'cjk', path, message: 'CJK text is not allowed in public mechanism data' }); return; }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (containsCjk(key) || bodyFields.has(key)) issues.push({ code: 'prose', path: `${path}/${key}`, message: 'Publisher prose fields are prohibited' });
    if (key !== 'notes' || depth !== 2 || !path.startsWith('/records/')) scan(child, issues, `${path}/${key}`, depth + 1);
  }
}
function issue(issues: ValidationIssue[], code: string, path: string, message: string): void { issues.push({ code, path, message }); }
function nonempty(value: unknown): boolean { return Array.isArray(value) ? value.length > 0 : !!value && typeof value === 'object' && Object.values(value).some(child => Array.isArray(child) ? child.length > 0 : child !== undefined); }
function formulas(value: unknown, issues: ValidationIssue[], path: string): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const location = `${path}/${key}`;
    if (typeof child === 'string' && (['formula', 'preparedFormula', 'damage', 'versatileDamage', 'dc'].includes(key) || key === 'amount' && child !== 'all')) {
      try { parseFormula(child); } catch { issue(issues, 'formula', location, 'Formula is outside the arithmetic and variable whitelist'); }
    } else formulas(child, issues, location);
  }
}
function validDate(value: string): boolean { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value; }
function recordChecks(record: AutomationRecord, index: Map<string, AutomationRecord>, issues: ValidationIssue[], path: string): void {
  try { createIdentity(record.identity); if (identityKey(record.identity) !== record.identity.key) issue(issues, 'identity-key', `${path}/identity/key`, 'Identity key does not match canonical fields'); }
  catch { issue(issues, 'identity', `${path}/identity`, 'Identity fields are invalid or have incomplete parents'); }
  const expectedEdition = editionForSource(record.identity.source);
  if (expectedEdition && record.edition && record.edition !== expectedEdition) issue(issues, 'edition-source', `${path}/edition`, 'Core source and edition disagree');
  const mechanics = record.mechanics;
  const hasMechanics = mechanics && Object.values(mechanics).some(nonempty);
  if (record.verdict === 'automated' && !hasMechanics) issue(issues, 'empty-mechanics', `${path}/mechanics`, 'An automated record requires operative mechanisms');
  if (record.verdict === 'noMechanics' && hasMechanics) issue(issues, 'no-mechanics-conflict', `${path}/mechanics`, 'A noMechanics record cannot contain operative mechanisms');
  if (record.verdict === 'noMechanics' && record.unsupported.length) issue(issues, 'no-mechanics-conflict', `${path}/unsupported`, 'Unimplemented mechanisms require an explicit partial verdict');
  if (record.verdict === 'automated' && ((mechanics?.effects?.length || 0) > 0 || mechanics?.actions?.some(action => action.deferred || ['attack', 'save', 'check', 'damage', 'heal', 'summon', 'enchant', 'teleport', 'transform'].includes(action.type)))) issue(issues, 'deferred', `${path}/mechanics`, 'Deferred execution cannot count as complete automation');
  if (record.evidence?.quote && record.evidence.quote.trim().split(/\s+/).length > 15) issue(issues, 'quote-length', `${path}/evidence/quote`, 'Evidence quotes may contain at most 15 words');
  for (const provenance of record.provenance) if (provenance.layer === 'overlay') {
    if (!provenance.reviewer?.trim() || !provenance.reviewedAt || !validDate(provenance.reviewedAt) || !record.evidence?.page) issue(issues, 'review', `${path}/provenance`, 'Overlay records require a reviewer, valid review date and page evidence');
  }
  for(const [i,modifier]of (mechanics?.modifiers||[]).entries())if(modifier.value!==undefined){
    const boolean=modifier.target==='speed.hover'||/^(?:resist|immune|vulnerable|conditionImmune):/.test(modifier.target),size=modifier.target==='size';
    if(boolean?typeof modifier.value!=='boolean':size?typeof modifier.value!=='string'||!['T','S','M','L','H','G'].includes(modifier.value):typeof modifier.value!=='number')issue(issues,'modifier-type',`${path}/mechanics/modifiers/${i}`,'Modifier value must match its declared target type');
  }
  formulas(mechanics, issues, `${path}/mechanics`);
  const resources = new Set<string>();
  const scaleKeys = new Set<string>();
  for (const [i, scale] of (mechanics?.scales || []).entries()) {
    if (scaleKeys.has(scale.key)) issue(issues, 'duplicate-scale', `${path}/mechanics/scales/${i}`, 'Scale keys must be unique'); scaleKeys.add(scale.key);
    if (scale.values.some((point, at) => at > 0 && point.level <= scale.values[at - 1].level)) issue(issues, 'scaling-order', `${path}/mechanics/scales/${i}/values`, 'Scale levels must be unique and ascending');
  }
  for (const [i, resource] of (mechanics?.resources || []).entries()) {
    const key = resource.key.normalize('NFKC').trim().toLowerCase();
    if (resources.has(key)) issue(issues, 'duplicate-resource', `${path}/mechanics/resources/${i}`, 'Resource keys must be unique within an entry'); resources.add(key);
    const levels = resource.scaling?.map(row => row.level) || [];
    if (levels.some((level, at) => at > 0 && level <= levels[at - 1])) issue(issues, 'scaling-order', `${path}/mechanics/resources/${i}/scaling`, 'Scaling levels must be unique and ascending');
    const periods = resource.recovery.map(row => row.period);
    if (new Set(periods).size !== periods.length) issue(issues, 'duplicate-recovery', `${path}/mechanics/resources/${i}/recovery`, 'A resource may have one recovery definition per period');
  }
  const reference = (key: string, location: string, kind?: string): void => {
    let parts:string[];try{parts=key.split(':').map(decodeURIComponent);}catch{issue(issues,'reference-key',location,'Referenced identity has an invalid encoding');return;}
    if(parts.length!==12||!parts[0]||!parts[1]||!parts[2]||!parts[3]){issue(issues,'reference-key',location,'Referenced identity is not a canonical identity key');return;}
    const edition=editionForSource(parts[2].toUpperCase());if(edition&&recordEdition(record)&&edition!==recordEdition(record))issue(issues,'edition-reference',location,'A reference crosses the 2014 and 2024 boundary');
    const kinds=kind==='feature'?['classfeature','subclassfeature','optionalfeature']:kind==='item'?['item','baseitem','magicvariant']:kind?[kind.toLowerCase()]:undefined;
    if(kinds&&!kinds.includes(parts[1].toLowerCase())){issue(issues,'reference-kind',location,'Referenced identity has the wrong kind');return;}
    const target = index.get(key);
    if(!target){issue(issues,'reference-missing',location,'Referenced identity is missing in this snapshot');return;}
    if(kinds&&!kinds.includes(target.identity.kind.toLowerCase())){issue(issues,'reference-kind',location,'Referenced identity has the wrong kind in this version');return;}
    if(recordEdition(record)&&recordEdition(target)&&recordEdition(record)!==recordEdition(target))issue(issues,'edition-reference',location,'A reference crosses the 2014 and 2024 boundary');
  };
  for (const [i, grant] of (mechanics?.grants || []).entries()) {
    const progression=grant.choiceProgression?.map(point=>point.level)||[];
    if(progression.some((level,index)=>index>0&&level<=progression[index-1]))issue(issues,'scaling-order',`${path}/mechanics/grants/${i}/choiceProgression`,'Choice quotas must use unique ascending levels, never additive duplicate grants');
    if (grant.choose?.weights && grant.choose.weights.length !== grant.choose.count) issue(issues, 'choice-weights', `${path}/mechanics/grants/${i}`, 'Weighted choices need one weight per choice');
    if (grant.choose?.from && (new Set(grant.choose.from).size !== grant.choose.from.length || grant.choose.count > grant.choose.from.length)) issue(issues, 'choice-count', `${path}/mechanics/grants/${i}`, 'Choice options must be distinct and satisfy the count');
    for(const [key,encoded]of Object.entries(grant.referenceAliases||{})){
      try{const decoded=decodeURIComponent(encoded),[uid,level]=decoded.split('#'),[name,source='PHB']=uid.split('|'),identitySource=decodeURIComponent(key.split(':')[2]||'');
        if(!['spell','feat','feature','item'].includes(grant.type)||![...(grant.fixed||[]),...(grant.choose?.from||[])].includes(key)||!name||name.length>1000||/[\u0000-\u001f]/.test(decoded)||source.toLowerCase()!==identitySource.toLowerCase()||level!==undefined&&(grant.type!=='spell'||!/^(c|[1-9])$/.test(level)||level!=='c'&&Number(level)!==grant.spellLevel))throw Error();
      }catch{issue(issues,'reference-alias',`${path}/mechanics/grants/${i}/referenceAliases`,'Legacy aliases must encode declared identities and matching casting levels');}
    }
    if (grant.type === 'spell') {
      for (const key of [...(grant.fixed || []), ...(grant.choose?.from || [])]) reference(key, `${path}/mechanics/grants/${i}`, 'spell');
      const filter = grant.choose?.filter;
      for (const source of [filter?.classSource, ...(Array.isArray(filter?.source) ? filter.source : filter?.source ? [filter.source] : [])]) if (typeof source === 'string' && recordEdition(record) && editionForSource(source) && recordEdition(record) !== editionForSource(source)) issue(issues, 'edition-reference', `${path}/mechanics/grants/${i}/choose/filter`, 'A spell filter crosses the edition boundary');
      if (filter && ![...index.values()].some(candidate => candidate.identity.kind === 'spell' && (!recordEdition(record) || !recordEdition(candidate) || recordEdition(record) === recordEdition(candidate)) && (filter.level === undefined || candidate.mechanics?.spellModel?.level === filter.level) && (filter.school === undefined || candidate.mechanics?.spellModel?.school === filter.school) && (!filter.source || (Array.isArray(filter.source) ? filter.source : [filter.source]).includes(candidate.identity.source)) && (!filter.class || candidate.mechanics?.spellModel?.classes?.some(clazz => clazz.engName === filter.class && (!filter.classSource || clazz.source === filter.classSource))))) issue(issues, 'spell-filter', `${path}/mechanics/grants/${i}/choose/filter`, 'Spell filter has no matching catalogue entries in this version');
    }
    if(['feat','feature','item'].includes(grant.type)&&!grant.origin?.startsWith('rulePackChoice:'))for(const key of [...(grant.fixed||[]),...(grant.choose?.from||[])])reference(key,`${path}/mechanics/grants/${i}`,grant.type);
    if (grant.resource && !resources.has(grant.resource.trim().toLowerCase())) issue(issues, 'resource-reference', `${path}/mechanics/grants/${i}/resource`, 'Granted spell references an undeclared resource');
  }
  for (const [i, action] of (mechanics?.actions || []).entries()) {
    if (action.spell) reference(action.spell, `${path}/mechanics/actions/${i}/spell`, 'spell');
    if (action.consumes && !resources.has(action.consumes.resource.trim().toLowerCase())) issue(issues, 'resource-reference', `${path}/mechanics/actions/${i}/consumes`, 'Action references an undeclared resource');
  }
  for (const field of ['classFeatures', 'subclassFeatures'] as const) for (const key of mechanics?.classModel?.[field] || []) reference(key, `${path}/mechanics/classModel/${field}`,field==='classFeatures'?'classFeature':'subclassFeature');
  for(const [i,block]of (mechanics?.startingEquipment?.blocks||[]).entries())for(const [j,option]of block.options.entries())for(const [k,item]of option.items.entries())if(item.identity)reference(item.identity,`${path}/mechanics/startingEquipment/blocks/${i}/options/${j}/items/${k}`,'item');
  for(const [key,encoded]of Object.entries(mechanics?.classModel?.referenceAliases||{}))try{
    const uid=decodeURIComponent(encoded),parts=uid.split('|'),sub=parts.length>=6,keyParts=key.split(':').map(decodeURIComponent);
    if(![...(mechanics?.classModel?.classFeatures||[]),...(mechanics?.classModel?.subclassFeatures||[])].includes(key)||parts.length<4||uid.length>3000||/[\u0000-\u001f]/.test(uid)||keyParts[1]!== (sub?'subclassfeature':'classfeature')||Number(keyParts[8])!==Number(parts[sub?5:3])||keyParts[2]!==String(sub?parts[6]||parts[4]||'PHB':parts[4]||parts[2]||'PHB').toLowerCase())throw Error();
  }catch{issue(issues,'reference-alias',`${path}/mechanics/classModel/referenceAliases`,'Feature aliases must encode declared identities with matching kind, source and level');}
  if (mechanics?.equipmentModel?.baseItem) reference(mechanics.equipmentModel.baseItem, `${path}/mechanics/equipmentModel/baseItem`);
}
export function schemaErrors(value: unknown, overlay = false): ValidationIssue[] {
  const validate = overlay ? overlaysSchema : envelopeSchema;
  return validate(value) ? [] : (validate.errors || []).map(error => ({ code: 'schema', path: error.instancePath, message: error.message || 'Schema validation failed' }));
}
export function automationErrors(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []; scan(value, issues);
  if (issues.some(row => row.code === 'depth')) return issues;
  const errors = schemaErrors(value); issues.push(...errors); if (errors.length) return issues;
  const envelope = value as AutomationEnvelope, index = new Map<string, AutomationRecord>();
  for (const [i, record] of envelope.records.entries()) { if (index.has(record.identity.key)) issue(issues, 'duplicate-identity', `/records/${i}/identity/key`, 'Identity keys must be unique after merging'); index.set(record.identity.key, record); }
  envelope.records.forEach((record, i) => recordChecks(record, index, issues, `/records/${i}`));
  const inputs = new Set<string>();
  for (const [i, input] of envelope.versionLock.inputs.entries()) { const key = `${input.namespace}/${input.path}`; if (inputs.has(key)) issue(issues, 'duplicate-input', `/versionLock/inputs/${i}`, 'Version lock inputs must be unique'); inputs.add(key); }
  if (!validDate(envelope.versionLock.kiweeChangelogDate) || !Number.isFinite(Date.parse(envelope.versionLock.fetchedAt))) issue(issues, 'version-date', '/versionLock', 'Version lock dates are invalid');
  return issues;
}
export function overlayErrors(value: unknown, catalogue: AutomationRecord[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = []; scan(value, issues);
  if (issues.some(row => row.code === 'depth')) return issues;
  const errors = schemaErrors(value, true); issues.push(...errors); if (errors.length) return issues;
  const overlays = value as OverlayRecord[], index = new Map(catalogue.map(row => [row.identity.key, row]));
  const keys = new Set<string>();
  overlays.forEach((row, i) => { if (keys.has(row.identity.key)) issue(issues, 'duplicate-identity', `/${i}/identity/key`, 'An overlay file cannot contain duplicate identities'); keys.add(row.identity.key); index.set(row.identity.key, { ...row, provenance: [] }); });
  overlays.forEach((row, i) => recordChecks({ ...row, provenance: [{ layer: 'overlay', ref: row.batch, reviewer: row.reviewer, reviewedAt: row.reviewedAt }] }, index, issues, `/${i}`));
  return issues;
}
function throwIssues(issues: ValidationIssue[]): void { if (issues.length) throw Error(issues.slice(0, 20).map(row => `${row.code} ${row.path}: ${row.message}`).join('\n')); }
export function validateAutomation(value: unknown): asserts value is AutomationEnvelope { throwIssues(automationErrors(value)); }
export function validateOverlay(value: unknown, catalogue: AutomationRecord[] = []): asserts value is OverlayRecord[] { throwIssues(overlayErrors(value, catalogue)); }
export function publicArtifact(envelope: AutomationEnvelope): AutomationEnvelope {
  const output = { ...envelope, records: envelope.records.map(({ notes: _notes, ...record }) => record) };
  validateAutomation(output); return output;
}

export function recordErrors(value:unknown,catalogue:AutomationRecord[]=[]):ValidationIssue[]{
 const issues:ValidationIssue[]=[];scan(value,issues);
 if(!recordSchema(value)){issues.push(...(recordSchema.errors||[]).map(error=>({code:'schema',path:error.instancePath,message:error.message||'Schema validation failed'})));return issues;}
 const record=value as AutomationRecord,index=new Map(catalogue.map(row=>[row.identity.key,row]));index.set(record.identity.key,record);recordChecks(record,index,issues,'');return issues;
}

export const snapshotRecordErrors=(value:unknown,catalogue:AutomationRecord[]=[])=>recordErrors(value,catalogue).filter(issue=>!['reference-missing','spell-filter'].includes(issue.code));
