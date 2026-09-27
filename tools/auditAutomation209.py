"""Read-only inventory of local upstream snapshots. Outputs counts, never publisher text.
This is structural coverage evidence, NOT a rule-correctness test or completion score.
Usage: python tools/auditAutomation209.py --output work/automation209-corpus.json DIR ...
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('directories', nargs='+', type=Path)
args = parser.parse_args()
files = {}
for directory in args.directories:
    for path in directory.glob('*.json'):
        if path.name not in files or path.stat().st_mtime > files[path.name].stat().st_mtime:
            files[path.name] = path
counts = collections.Counter()
fields = collections.Counter()
by_source = collections.Counter()
equipment = collections.Counter()
grants = collections.Counter()
failures = []
manifest = []
card_types = {'class', 'subclass', 'classFeature', 'subclassFeature', 'race', 'subrace', 'background', 'feat', 'optionalfeature', 'baseitem', 'item', 'magicvariant', 'spell'}
for name, path in sorted(files.items()):
    try:
        content = path.read_bytes()
        data = json.loads(content.decode('utf-8-sig'))
        manifest.append({'file': name, 'sha256': hashlib.sha256(content).hexdigest()})
        if not isinstance(data, dict):
            continue
        for kind, rows in data.items():
            if not isinstance(rows, list):
                continue
            counts[kind] += len(rows)
            for raw in rows:
                if not isinstance(raw, dict) or kind not in card_types:
                    continue
                by_source[str(raw.get('source', 'unspecified'))] += 1
                for field in raw:
                    fields[field] += 1
                item_type = str(raw.get('type', '')).split('|')[0]
                if kind in {'baseitem', 'item'}:
                    if item_type in {'LA', 'MA', 'HA', 'S'}:
                        equipment['armor_or_shield'] += 1
                        equipment['armor_with_numeric_ac' if isinstance(raw.get('ac'), (int, float)) else 'armor_needs_resolution'] += 1
                    if item_type in {'M', 'R'}:
                        equipment['weapon'] += 1
                        equipment['weapon_with_damage' if raw.get('dmg1') is not None else 'weapon_needs_resolution'] += 1
                    if raw.get('_copy') or raw.get('inherits'):
                        equipment['inheritance'] += 1
                    if raw.get('charges') or raw.get('recharge') or raw.get('rechargeAmount'):
                        equipment['resource_or_recovery'] += 1
                    if raw.get('reqAttune'):
                        equipment['attunement'] += 1
                blocks = raw.get('additionalSpells')
                if not isinstance(blocks, list):
                    continue
                grants['entries_with_additionalSpells'] += 1
                if len(blocks) > 1:
                    grants['multiple_sets'] += 1
                for block in blocks:
                    if not isinstance(block, dict):
                        grants['invalid_block'] += 1
                        continue
                    if isinstance(block.get('ability'), dict):
                        grants['ability_choice_or_expression'] += 1
                    for category in ['known', 'prepared', 'innate', 'expanded']:
                        if category in block:
                            grants[category + '_blocks'] += 1
                    def visit(value):
                        if isinstance(value, list):
                            for child in value:
                                visit(child)
                        elif isinstance(value, dict):
                            for key, child in value.items():
                                if key in {'choose', 'daily', 'rest', 'resource', 'will', 'ritual'}:
                                    grants[key + '_nodes'] += 1
                                visit(child)
                    for category in ['known', 'prepared', 'innate', 'expanded']:
                        visit(block.get(category))
    except (ValueError, OSError) as error:
        failures.append({'file': name, 'error': str(error)})
result = {
    'scope': 'Local snapshots only; no complete-catalog or semantic coverage claim.',
    'deduplication': 'Same cache filename: newest file mtime. Different files may still contain overlapping entries.',
    'files': len(manifest), 'recordsByType': dict(counts), 'cardRecordsBySource': dict(by_source),
    'equipmentShapes': dict(equipment), 'spellGrantShapes': dict(grants), 'cardFields': dict(fields.most_common()),
    'missingDomains': [kind for kind in ['class', 'subclass', 'classFeature', 'subclassFeature', 'spell'] if not counts[kind]],
    'failures': failures, 'manifest': manifest,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: result[key] for key in ['files', 'equipmentShapes', 'spellGrantShapes', 'missingDomains', 'failures']}, ensure_ascii=True))
