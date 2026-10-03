// src/identity.ts
var containsCjk = (value) => /[\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{323af}]/u.test(value);

// src/validate/formula.ts
var variable = /^@(?:class\.level|classes\.[a-zA-Z0-9_-]+\.levels|details\.level|prof|abilities\.(?:str|dex|con|int|wis|cha)\.mod|scale\.[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)$/;
function parseFormula(source) {
  if (typeof source !== "string" || !source.trim() || source.length > 160) throw Error("Invalid formula length");
  const tokens = [], variables = /* @__PURE__ */ new Set();
  let cursor = 0, depth = 0, dice = false;
  while (cursor < source.length) {
    const text = source.slice(cursor);
    if (/^\s/.test(text)) {
      cursor++;
      continue;
    }
    const token = /^(?:\d+(?:\.\d+)?|@(?:class\.level|classes\.[a-zA-Z0-9_-]+\.levels|details\.level|prof|abilities\.(?:str|dex|con|int|wis|cha)\.mod|scale\.[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)|(?:floor|ceil|min|max)\b|[dD+*/(),-])/.exec(text)?.[0];
    if (!token) throw Error(`Unexpected formula token at ${cursor}`);
    if (token.startsWith("@")) {
      if (!variable.test(token)) throw Error(`Unknown formula variable ${token}`);
      variables.add(token);
    }
    tokens.push(token);
    cursor += token.length;
  }
  if (tokens.length > 120) throw Error("Formula too complex");
  let index = 0;
  function primary() {
    if (++depth > 24) throw Error("Formula nesting too deep");
    const token = tokens[index++];
    let result2;
    if (token === "+" || token === "-") result2 = { type: "unary", op: token, value: primary() };
    else if (token === "(") {
      result2 = expression(0);
      if (tokens[index++] !== ")") throw Error("Unclosed formula group");
    } else if (["floor", "ceil", "min", "max"].includes(token)) {
      if (tokens[index++] !== "(") throw Error("Function requires parentheses");
      const args = [expression(0)];
      while (tokens[index] === ",") {
        index++;
        args.push(expression(0));
      }
      if (tokens[index++] !== ")" || (["floor", "ceil"].includes(token) ? args.length !== 1 : args.length < 2 || args.length > 8)) throw Error("Invalid function arguments");
      result2 = { type: "call", name: token, args };
    } else if (token?.startsWith("@")) result2 = { type: "variable", name: token };
    else if (token !== void 0 && /^\d/.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value) || value > 1e6) throw Error("Numeric literal too large");
      result2 = { type: "number", value };
    } else throw Error("Expected formula operand");
    depth--;
    return result2;
  }
  function expression(minimum) {
    let left = primary();
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, d: 3, D: 3 };
    while (tokens[index] in precedence && precedence[tokens[index]] >= minimum) {
      const op = tokens[index++];
      const right = expression(precedence[op] + 1);
      if (op.toLowerCase() === "d") {
        if (left.type !== "number" || right.type !== "number" || !Number.isInteger(left.value) || !Number.isInteger(right.value) || left.value < 1 || left.value > 100 || right.value < 2 || right.value > 1e3) throw Error("Invalid dice expression");
        dice = true;
      }
      left = { type: "binary", op, left, right };
    }
    return left;
  }
  const ast = expression(0);
  if (index !== tokens.length) throw Error("Unexpected trailing formula input");
  return { ast, variables: [...variables].sort(), dice };
}

// src/derive/structured/common.ts
var ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
var SKILLS = ["athletics", "acrobatics", "sleightofhand", "stealth", "arcana", "history", "investigation", "nature", "religion", "animalhandling", "insight", "medicine", "perception", "survival", "deception", "intimidation", "performance", "persuasion"];
var plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var canonical = (value) => String(value ?? "").normalize("NFKC").trim().toLowerCase();
var integer = (value, low = 0, high = 1e4) => typeof value === "number" && Number.isSafeInteger(value) && value >= low && value <= high;
var numeric = (value) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : void 0;
function amount(value) {
  const number = numeric(value);
  if (number !== void 0 && integer(number)) return { value: number };
  if (typeof value === "string") try {
    parseFormula(value);
    return { formula: value };
  } catch {
  }
  return void 0;
}
var result = () => ({ mechanics: {}, unsupported: [], handled: /* @__PURE__ */ new Set() });
function unsupported(out, family, code2, ref) {
  if (!out.unsupported.some((row) => row.family === family && row.code === code2 && row.ref === ref)) out.unsupported.push({ family, code: code2, ...ref && !containsCjk(ref) ? { ref } : {} });
}
function modifier(out, value) {
  (out.mechanics.modifiers ||= []).push(value);
}
function grant(out, value) {
  (out.mechanics.grants ||= []).push(value);
}
function resource(out, value) {
  if (out.mechanics.resources?.some((row) => row.key === value.key)) unsupported(out, "resources", "duplicate-resource", value.key);
  else (out.mechanics.resources ||= []).push(value);
}
function fields(raw, out, names, derive) {
  for (const name of names) if (Object.hasOwn(raw, name)) {
    out.handled.add(name);
    derive(name, raw[name]);
  }
}
function makeContext(rows) {
  const byName = /* @__PURE__ */ new Map();
  for (const row of rows) for (const name of new Set([row.raw.name, row.raw.ENG_name, row.identity.engName].filter(Boolean))) {
    const key = canonical(name);
    byName.set(key, [...byName.get(key) || [], row]);
  }
  const matching = (reference, kind, source) => {
    const [name, book] = reference.replace(/^\{@\w+ ([^}]+)\}$/, "$1").split("|");
    return (byName.get(canonical(name)) || []).filter((row) => (row.identity.kind === kind || kind === "item" && ["baseitem", "magicvariant"].includes(row.identity.kind) || kind === "feature" && ["classFeature", "subclassFeature", "optionalfeature"].includes(row.identity.kind)) && (!book && !source || canonical(row.identity.source) === canonical(book || source)));
  };
  const damage = { b: "bludgeoning", p: "piercing", s: "slashing", a: "acid", c: "cold", f: "fire", o: "force", l: "lightning", n: "necrotic", i: "poison", y: "psychic", r: "radiant", t: "thunder", "\u5F3A\u9178": "acid", "\u5BD2\u51B7": "cold", "\u706B\u7130": "fire", "\u529B\u573A": "force", "\u95EA\u7535": "lightning", "\u6697\u8680": "necrotic", "\u6BD2\u7D20": "poison", "\u5FC3\u7075": "psychic", "\u5149\u8000": "radiant", "\u96F7\u9E23": "thunder", "\u949D\u51FB": "bludgeoning", "\u7A7F\u523A": "piercing", "\u6325\u780D": "slashing" };
  const tokens = { damage, condition: { "\u76EE\u76F2": "blinded", "\u9B45\u60D1": "charmed", "\u8033\u804B": "deafened", "\u6050\u614C": "frightened", "\u64D2\u62B1": "grappled", "\u5931\u80FD": "incapacitated", "\u9690\u5F62": "invisible", "\u9EBB\u75F9": "paralyzed", "\u77F3\u5316": "petrified", "\u4E2D\u6BD2": "poisoned", "\u5012\u5730": "prone", "\u675F\u7F1A": "restrained", "\u9707\u6151": "stunned", "\u660F\u8FF7": "unconscious", "\u529B\u7AED": "exhaustion" }, armor: { "\u8F7B\u7532": "light", "\u4E2D\u7532": "medium", "\u91CD\u7532": "heavy", "\u76FE\u724C": "shield", "light armor": "light", "medium armor": "medium", "heavy armor": "heavy", "shields": "shield" }, weapon: { "\u7B80\u6613\u6B66\u5668": "simple", "\u519B\u7528\u6B66\u5668": "martial", "simple weapons": "simple", "martial weapons": "martial" } };
  const resolve = (reference, kind, source) => {
    const p = reference.split("|");
    if (["feature", "classFeature", "subclassFeature"].includes(kind) && p.length >= 4) {
      const sub = p.length >= 6, book = sub ? p[6] || p[4] || "PHB" : p[4] || p[2] || "PHB";
      const candidates = rows.filter((row) => row.identity.kind === (sub ? "subclassFeature" : "classFeature") && canonical(row.identity.source) === canonical(book) && row.identity.level === Number(p[sub ? 5 : 3]) && [row.raw.name, row.raw.ENG_name, row.identity.engName].some((name) => canonical(name) === canonical(p[0])) && [row.raw.className, row.identity.classEngName].some((name) => canonical(name) === canonical(p[1])) && canonical(row.identity.classSource) === canonical(p[2] || "PHB") && (!sub || canonical(row.identity.subclassSource) === canonical(p[4] || "PHB") && [row.raw.subclassShortName, row.identity.subclassEngShortName].some((name) => canonical(name) === canonical(p[3]))));
      return candidates.length === 1 ? candidates[0] : void 0;
    }
    const matches = matching(reference, kind, source);
    const preferred = kind === "item" ? matches.filter((row) => row.identity.kind === "baseitem") : matches;
    return preferred.length === 1 ? preferred[0] : matches.length === 1 ? matches[0] : void 0;
  };
  return {
    rows,
    resolve,
    className: (name, source) => resolve(`${name}|${source}`, "class")?.identity.engName,
    token: (value, family) => {
      const key = canonical(value);
      if (tokens[family]?.[key]) return tokens[family][key];
      if (family === "weapon" && key === "\u7B80\u6613") return "simple";
      if (family === "weapon" && key === "\u519B\u7528") return "martial";
      if (family === "skill" && SKILLS.includes(key.replace(/[^a-z]/g, ""))) return key.replace(/[^a-z]/g, "");
      if (family === "damage" && new Set(Object.values(damage)).has(key)) return key;
      if (family === "condition" && ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "exhaustion"].includes(key)) return key;
      if (family === "armor" && ["light", "medium", "heavy", "shield"].includes(key)) return key;
      if (family === "weapon" && ["simple", "martial", "simple-melee", "simple-ranged", "martial-melee", "martial-ranged", "firearms"].includes(key)) return key;
      const category = family === "skill" ? "skill" : family === "language" ? "language" : family === "condition" ? "condition" : family === "tool" || family === "weapon" ? "item" : void 0;
      const matches = category ? matching(value, category) : [];
      const identities = new Set(matches.map((row2) => row2.identity.engName));
      const row = identities.size === 1 ? matches[0] : void 0;
      if (row) return family === "skill" ? canonical(row.identity.engName).replace(/[^a-z]/g, "") : ["weapon", "tool"].includes(family) && value.includes("|") ? `${row.identity.engName}|${row.identity.source}` : row.identity.engName;
      return void 0;
    }
  };
}

// src/derive/structured/abilities.ts
function abilities(raw, out) {
  fields(raw, out, ["ability"], (_, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "ability", "ability-shape");
      return;
    }
    for (const [index, block] of value.entries()) {
      if (!plain(block) || Object.keys(block).some((key) => key !== "choose" && !ABILITIES.includes(key))) {
        unsupported(out, "ability", "ability-block", `ability/${index}`);
        continue;
      }
      const alternatives = value.length > 1, set = alternatives ? { setKey: "ability", setOption: index } : {};
      for (const [key, n] of Object.entries(block)) if (ABILITIES.includes(key)) {
        if (!integer(n, -10, 10)) {
          unsupported(out, "ability", "ability-value", `ability/${index}/${key}`);
          continue;
        }
        if (alternatives) grant(out, { type: "abilityScore", fixed: [key], amount: n, ...set });
        else modifier(out, { target: key, op: "add", value: n });
      }
      if (block.choose) {
        const choose = block.choose, weighted = choose.weighted;
        const from = weighted?.from ?? choose.from, weights = weighted?.weights ?? Array.from({ length: Math.min(6, choose.count ?? 1) }, () => choose.amount ?? 1);
        if (!plain(choose) || Object.keys(choose).some((key) => !["weighted", "from", "count", "amount"].includes(key)) || !Array.isArray(from) || !from.length || from.some((key) => !ABILITIES.includes(key)) || new Set(from).size !== from.length || !Array.isArray(weights) || !weights.length || weights.length > from.length || weights.some((n) => !integer(n, 1, 10)) || choose.count !== void 0 && !integer(choose.count, 1, 6)) {
          unsupported(out, "ability", "ability-choice", `ability/${index}/choose`);
          continue;
        }
        grant(out, { type: "abilityScore", choose: { count: weights.length, from, weights }, key: `ability:${index}`, ...set });
      }
    }
  });
}

// src/derive/structured/proficiencies.ts
var families = { skillProficiencies: ["skillProficiency", "skill"], toolProficiencies: ["toolProficiency", "tool"], languageProficiencies: ["languageProficiency", "language"], weaponProficiencies: ["weaponProficiency", "weapon"], armorProficiencies: ["armorProficiency", "armor"], savingThrowProficiencies: ["savingThrow", "ability"], expertise: ["expertise", "skill"] };
function proficiencyBlocks(value, type, family, field, ctx, out, scope = "all") {
  const blocks = Array.isArray(value) ? value : typeof value === "string" ? [value] : plain(value) ? [value] : void 0;
  if (!blocks) {
    unsupported(out, "proficiency", "proficiency-shape", field);
    return;
  }
  const token = (input) => family === "ability" ? ABILITIES.includes(input) ? input : void 0 : ctx.token(input, family);
  for (const [index, block] of blocks.entries()) {
    if (typeof block === "string") {
      const fixed2 = token(block);
      if (fixed2) grant(out, { type, fixed: [fixed2], scope, key: `${field}:${index}` });
      else unsupported(out, "proficiency", "unresolved-proficiency", `${field}/${index}`);
      continue;
    }
    if (!plain(block)) {
      unsupported(out, "proficiency", "proficiency-block", `${field}/${index}`);
      continue;
    }
    const alternative = blocks.length > 1 && blocks.every(plain) ? { setKey: `${field}:set`, setOption: index } : {};
    const fixed = Object.entries(block).filter(([, v]) => v === true).flatMap(([key]) => {
      const result2 = token(key);
      if (!result2) unsupported(out, "proficiency", "unresolved-proficiency", `${field}/${index}`);
      return result2 ? [result2] : [];
    });
    if (fixed.length) grant(out, { type, fixed, scope, key: `${field}:${index}:fixed`, ...alternative });
    if (block.proficiency) {
      const fixed2 = typeof block.proficiency === "string" ? token(block.proficiency) : void 0;
      if (fixed2 && !block.optional) grant(out, { type, fixed: [fixed2], scope, key: `${field}:${index}`, ...alternative });
      else unsupported(out, "proficiency", "optional-proficiency", `${field}/${index}`);
    }
    if (block.choose || block.any) {
      const choose = block.choose, count = choose ? choose.count ?? 1 : block.any;
      const from = choose?.from ?? (family === "skill" ? SKILLS : ctx.rows.filter((row) => family === "language" ? row.identity.kind === "language" : row.raw.tool).map((row) => row.identity.engName));
      const normalized = Array.isArray(from) ? [...new Set(from.map((value2) => typeof value2 === "string" ? token(value2) : void 0))] : [];
      if (!integer(count, 1, 100) || !normalized.length || normalized.some((value2) => !value2) || new Set(normalized).size !== normalized.length || count > normalized.length) {
        unsupported(out, "proficiency", "proficiency-choice", `${field}/${index}/choose`);
        continue;
      }
      grant(out, { type, choose: { count, from: normalized }, key: `${field}:${index}`, scope, ...alternative });
    }
    if (Object.entries(block).some(([key, value2]) => !["choose", "any", "proficiency", "optional"].includes(key) && value2 !== true)) unsupported(out, "proficiency", "proficiency-condition", `${field}/${index}`);
  }
}
function proficiencies(raw, ctx, out) {
  fields(raw, out, Object.keys(families), (field, value) => {
    const [type, family] = families[field];
    const groups = raw._proficiencyGroups?.[field];
    if (Array.isArray(groups)) for (const group of groups) proficiencyBlocks(group.value, type, family, `${field}:${group.origin}`, ctx, out);
    else proficiencyBlocks(value, type, family, field, ctx, out);
  });
  fields(raw, out, ["skillToolLanguageProficiencies"], (field) => unsupported(out, "proficiency", "mixed-proficiency-choice", field));
}

// src/derive/structured/traits.ts
var modes = ["walk", "fly", "swim", "climb", "burrow", "hover"];
function traits(raw, ctx, out) {
  fields(raw, out, ["resist", "immune", "vulnerable", "conditionImmune"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "defenses", "defense-shape", field);
      return;
    }
    for (const part of value) {
      if (typeof part !== "string") {
        unsupported(out, "defenses", "conditional-defense", field);
        continue;
      }
      const token = ctx.token(part, field === "conditionImmune" ? "condition" : "damage");
      if (!token || !/^[a-z-]+$/.test(token)) unsupported(out, "defenses", "defense-token", field);
      else modifier(out, { target: `${field}:${token}`, op: "set", value: true });
    }
  });
  fields(raw, out, ["speed"], (field, value) => {
    if (integer(value, 0, 1e3)) {
      modifier(out, { target: "speed.walk", op: "set", value });
      return;
    }
    if (!plain(value)) {
      unsupported(out, "movement", "speed-shape", field);
      return;
    }
    for (const [key, speed] of Object.entries(value)) {
      const number = plain(speed) ? speed.number : speed;
      if (!modes.includes(key) || !integer(number, 0, 1e3)) {
        unsupported(out, "movement", "conditional-speed", `speed/${key}`);
        continue;
      }
      if (plain(speed) && Object.keys(speed).some((key2) => key2 !== "number")) {
        unsupported(out, "movement", "conditional-speed", `speed/${key}`);
        continue;
      }
      modifier(out, { target: `speed.${key}`, op: "set", value: number });
    }
  });
  fields(raw, out, ["darkvision"], (field, value) => {
    if (integer(value, 0, 1e4)) modifier(out, { target: "sense:darkvision", op: "max", value });
    else unsupported(out, "senses", "sense-shape", field);
  });
  fields(raw, out, ["senses"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "senses", "sense-shape", field);
      return;
    }
    for (const part of value) if (plain(part)) for (const [sense, range] of Object.entries(part)) {
      if (/^[a-z]+$/.test(sense) && integer(range)) modifier(out, { target: `sense:${sense}`, op: "max", value: range });
      else unsupported(out, "senses", "conditional-sense", field);
    }
    else unsupported(out, "senses", "sense-shape", field);
  });
  fields(raw, out, ["size"], (field, value) => {
    if (Array.isArray(value) && value.length === 1 && ["T", "S", "M", "L", "H", "G"].includes(value[0])) modifier(out, { target: "size", op: "set", value: value[0] });
    else unsupported(out, "size", "size-choice", field);
  });
  fields(raw, out, ["modifySpeed"], (field) => unsupported(out, "movement", "relative-speed", field));
}

// src/derive/structured/resources.ts
function recovery(value) {
  if (value === void 0 || value === "manual") return [];
  if (["sr", "short", "restShort"].includes(String(value))) return [{ period: "short", amount: "all" }, { period: "long", amount: "all" }];
  if (["lr", "long", "restLong"].includes(String(value))) return [{ period: "long", amount: "all" }];
  if (value === "dawn" || value === "\u62C2\u6653") return [{ period: "dawn", amount: "all" }];
  if (plain(value)) {
    const rows = [];
    for (const [period, n] of Object.entries(value)) {
      if (!["short", "long", "dawn", "manual"].includes(period) || n !== "all" && !integer(n)) return;
      rows.push({ period, amount: n });
    }
    return rows;
  }
  if (Array.isArray(value)) {
    const rows = [];
    for (const rule of value) {
      const period = { sr: "short", lr: "long", dawn: "dawn", "\u62C2\u6653": "dawn", short: "short", long: "long", manual: "manual" }[rule?.period];
      const n = rule?.type === "recoverAll" ? "all" : amount(rule?.formula ?? rule?.amount);
      if (!period || !n) return;
      rows.push({ period, amount: n === "all" ? "all" : "value" in n ? n.value : n.formula });
    }
    return rows;
  }
}
function resources(raw, out) {
  const fieldsPresent = ["resources", "resource", "uses", "system"].filter((key) => Object.hasOwn(raw, key));
  fieldsPresent.forEach((key) => out.handled.add(key));
  const value = Array.isArray(raw.resources) ? raw.resources : plain(raw.resource) ? [raw.resource] : plain(raw.uses) ? [{ ...raw.uses, recovery: raw.uses.recovery ?? raw.uses.per }] : plain(raw.system?.uses) ? [raw.system.uses] : [];
  if (!value.length && fieldsPresent.some((key) => key !== "system")) unsupported(out, "resources", "resource-shape");
  for (const [index, spec] of value.entries()) {
    const maximum = spec?.max ?? spec?.value ?? (spec?.type === "dicePool" ? spec.count : void 0);
    const normalized = typeof maximum === "string" ? maximum.replace(/<\$level\$>/g, "@class.level") : maximum;
    const max = amount(normalized), periods = recovery(spec?.recovery ?? spec?.recharge);
    if (!max || !periods) {
      unsupported(out, "resources", "resource-definition", `resources/${index}`);
      continue;
    }
    const formula = typeof spec.formula === "string" ? amount(spec.formula) : void 0;
    if (spec.formula !== void 0 && !formula) unsupported(out, "resources", "resource-formula", `resources/${index}`);
    if (spec.type === "dicePool") unsupported(out, "dicePool", "dice-pool-roll-expression", `resources/${index}`);
    resource(out, { key: `resource:${index}`, max, recovery: periods, ...formula && "formula" in formula ? { formula: formula.formula } : {} });
  }
  fields(raw, out, ["consumes"], (field) => unsupported(out, "resources", "external-consumption", field));
}

// src/derive/structured/classes.ts
function classes(row, ctx, out) {
  const raw = row.raw, model = {};
  const addProgression = (field, target) => fields(raw, out, [field], (_, value) => {
    if (Array.isArray(value) && value.length <= 20 && value.every((n) => integer(n, 0, 100))) model[target] = value.slice();
    else unsupported(out, "classCasting", "progression-shape", field);
  });
  fields(raw, out, ["hd"], (field, value) => {
    if (plain(value) && value.number === 1 && [4, 6, 8, 10, 12].includes(value.faces)) model.hitDie = value.faces;
    else unsupported(out, "hitDice", "hit-die-shape", field);
  });
  fields(raw, out, ["proficiency"], (field, value) => proficiencyBlocks(value, "savingThrow", "ability", field, ctx, out, "firstClass"));
  for (const [field, scope] of [["startingProficiencies", "firstClass"], ["multiclassing", "multiclass"]]) fields(raw, out, [field], (_, value) => {
    const block = field === "multiclassing" ? value?.proficienciesGained : value;
    if (block) {
      for (const [name, type, family] of [["skills", "skillProficiency", "skill"], ["tools", "toolProficiency", "tool"], ["languages", "languageProficiency", "language"], ["armor", "armorProficiency", "armor"], ["weapons", "weaponProficiency", "weapon"]]) if (block[name] !== void 0) proficiencyBlocks(block[name], type, family, `${field}.${name}`, ctx, out, scope);
    }
    if (field === "multiclassing" && (value?.requirements || value?.requirementsSpecial || value?.spellcasting)) unsupported(out, "multiclassing", "multiclass-eligibility", field);
  });
  fields(raw, out, ["casterProgression"], (field, value) => {
    const mapped = { "1/2": "half", "1/3": "third" }[value] || value;
    if (["full", "half", "third", "artificer", "pact", "none"].includes(mapped)) model.casterProgression = mapped;
    else unsupported(out, "classCasting", "caster-progression", field);
  });
  fields(raw, out, ["spellcastingAbility"], (field, value) => {
    if (ABILITIES.includes(value)) model.spellcastingAbility = value;
    else unsupported(out, "classCasting", "casting-ability", field);
  });
  addProgression("cantripProgression", "cantripProgression");
  addProgression("preparedSpellsProgression", "preparedProgression");
  addProgression("spellsKnownProgression", "knownProgression");
  fields(raw, out, ["preparedSpells"], (field, value) => {
    if (typeof value !== "string") {
      unsupported(out, "classCasting", "prepared-formula", field);
      return;
    }
    const formula = value.replace(/<\$level\$>/g, "@class.level").replace(/<\$(str|dex|con|int|wis|cha)_mod\$>/g, "@abilities.$1.mod");
    model.preparedFormula = formula;
  });
  for (const field of ["preparedSpellsChange", "cantripChange"]) fields(raw, out, [field], (_, value) => {
    if (["level", "restLong", "manual"].includes(value)) model[field === "preparedSpellsChange" ? "preparedChange" : "cantripChange"] = value;
    else unsupported(out, "classCasting", "change-period", field);
  });
  fields(raw, out, ["spellsKnownProgressionFixed"], (field, value) => {
    if (plain(value) && Object.entries(value).every(([level, n]) => integer(Number(level), 1, 20) && integer(n, 0, 100))) {
      let count = 0;
      model.bookProgression = Array.from({ length: 20 }, (_, i) => count += value[String(i + 1)] || 0);
    } else if (Array.isArray(value) && value.length <= 20 && value.every((n) => integer(n, 0, 100))) {
      let count = 0;
      model.bookProgression = value.map((n) => count += n);
    } else unsupported(out, "classCasting", "book-progression", field);
  });
  fields(raw, out, ["classTableGroups", "subclassTableGroups"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "classTable", "table-shape", field);
      return;
    }
    for (const group of value) {
      if (group.rowsSpellProgression) {
        const rows = group.rowsSpellProgression;
        if (Array.isArray(rows) && rows.length <= 20 && rows.every((r) => Array.isArray(r) && r.length <= 9 && r.every((n) => integer(n, 0, 100)))) {
          if (model.spellSlots) unsupported(out, "classCasting", "multiple-slot-tables", field);
          else model.spellSlots = structuredClone(rows);
        } else unsupported(out, "classCasting", "slot-table-shape", field);
      }
      if (Array.isArray(group.rows) && group.rows.some((r) => Array.isArray(r) && r.some((n) => typeof n === "number"))) unsupported(out, "classTable", "named-table-requires-link", field);
    }
  });
  fields(raw, out, ["classFeatures", "subclassFeatures"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "featureProgression", "feature-ref-shape", field);
      return;
    }
    const resolved = [];
    for (const ref of value) {
      const uid = typeof ref === "string" ? ref : ref?.[field === "classFeatures" ? "classFeature" : "subclassFeature"];
      if (typeof uid !== "string") {
        unsupported(out, "featureProgression", "feature-ref-shape", field);
        continue;
      }
      const p = uid.split("|"), sub = field === "subclassFeatures", source = sub ? p[6] || p[4] || "PHB" : p[4] || p[2] || "PHB", level = Number(p[sub ? 5 : 3]);
      const candidates = ctx.rows.filter((candidate) => candidate.identity.kind === (sub ? "subclassFeature" : "classFeature") && candidate.identity.source.toLowerCase() === source.toLowerCase() && candidate.identity.level === level && [candidate.raw.name, candidate.raw.ENG_name].includes(p[0]) && [candidate.raw.className, candidate.identity.classEngName].includes(p[1]) && candidate.identity.classSource?.toLowerCase() === (p[2] || "PHB").toLowerCase() && (!sub || [candidate.raw.subclassShortName, candidate.identity.subclassEngShortName].includes(p[3])));
      if (candidates.length === 1 && row.edition && candidates[0].edition && row.edition !== candidates[0].edition) {
        unsupported(out, "featureProgression", "cross-edition-feature-ref", field);
        continue;
      }
      if (candidates.length === 1) {
        resolved.push(candidates[0].identity.key);
        (model.referenceAliases ||= {})[candidates[0].identity.key] = encodeURIComponent(uid);
      } else unsupported(out, "featureProgression", "unresolved-feature-ref", field);
    }
    if (resolved.length) model[field === "classFeatures" ? "classFeatures" : "subclassFeatures"] = resolved;
  });
  fields(raw, out, ["cantripBonus"], (field, value) => {
    if (integer(value, 0, 100)) modifier(out, { target: "cantrips", op: "add", value });
    else unsupported(out, "classCasting", "cantrip-bonus", field);
  });
  fields(raw, out, ["optionalfeatureProgression"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "featureProgression", "optional-progression-shape", field);
      return;
    }
    for (const [index, part] of value.entries()) {
      if (!Array.isArray(part?.featureType) || !part.featureType.length || part.featureType.some((v) => typeof v !== "string" || containsCjk(v)) || !plain(part.progression)) {
        unsupported(out, "featureProgression", "optional-progression-shape", field);
        continue;
      }
      const progression = [];
      let invalid = false;
      for (const [level, n] of Object.entries(part.progression)) {
        if (!integer(n, 0, 100) || level !== "*" && !integer(Number(level), 1, 20)) {
          unsupported(out, "featureProgression", "optional-progression-shape", field);
          invalid = true;
          continue;
        }
        progression.push({ level: level === "*" ? 0 : Number(level), count: n });
      }
      progression.sort((a, b) => a.level - b.level);
      const first = progression.find((point) => point.count > 0);
      if (!invalid && first) grant(out, { type: "feature", choose: { count: first.count, filter: { kind: "optionalfeature", featureType: part.featureType } }, key: `optionalfeature:${index}`, atLevel: first.level, choiceProgression: progression });
    }
  });
  fields(raw, out, ["feats"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "featGrant", "feat-grant-shape", field);
      return;
    }
    for (const [index, part] of value.entries()) if (plain(part)) for (const [ref, n] of Object.entries(part)) {
      if (ref === "any" && integer(n, 1, 100)) grant(out, { type: "feat", choose: { count: n, filter: { kind: "feat" } }, key: `feats:${index}` });
      else if (n === true) {
        const target = ctx.resolve(ref, "feat", ref.includes("|") ? void 0 : row.identity.source);
        if (target && row.edition && row.edition !== "both" && target.edition && target.edition !== "both" && row.edition !== target.edition) unsupported(out, "featGrant", "edition-reference", field);
        else if (target) grant(out, { type: "feat", fixed: [target.identity.key], referenceAliases: { [target.identity.key]: encodeURIComponent(ref) }, key: `feats:${index}` });
        else unsupported(out, "featGrant", "unresolved-feat", field);
      } else unsupported(out, "featGrant", "feat-grant-shape", field);
    }
  });
  if (Object.keys(model).length) out.mechanics.classModel = model;
}

// src/derive/structured/equipment.ts
var code = (value) => String(value || "").split("|")[0].toUpperCase();
function equipment(row, ctx, out) {
  const raw = row.raw, model = {};
  if (["item", "baseitem", "magicvariant"].includes(row.identity.kind)) {
    out.handled.add("type");
    const type = code(raw.type), category = { LA: "lightArmor", MA: "mediumArmor", HA: "heavyArmor", S: "shield", M: "weapon", R: "weapon" }[type];
    model.category = category || "other";
    if (type === "M" || type === "R") model.weaponType = type === "M" ? "melee" : "ranged";
    if (type === "MA") model.dexCap = 2;
    fields(raw, out, ["ac", "strength", "weight", "value"], (field, value) => {
      const number = numeric(value);
      if (number !== void 0 && number >= 0 && number <= 1e6 && (field === "weight" || Number.isInteger(number))) model[field] = number;
      else unsupported(out, "equipment", "equipment-number", field);
    });
    fields(raw, out, ["stealth"], (field, value) => {
      if (typeof value === "boolean") model.stealthDisadvantage = value;
      else unsupported(out, "equipment", "stealth-condition", field);
    });
    fields(raw, out, ["reqAttune"], (field, value) => {
      if (typeof value === "boolean" || value === "YES") model.requiresAttunement = !!value;
      else if (typeof value === "string") {
        model.requiresAttunement = true;
        unsupported(out, "attunement", "attunement-prerequisite", field);
      } else unsupported(out, "attunement", "attunement-shape", field);
    });
    fields(raw, out, ["weaponCategory"], (field, value) => {
      if (["simple", "martial"].includes(value)) model.weaponCategory = value;
      else unsupported(out, "weapon", "weapon-category", field);
    });
    fields(raw, out, ["dmg1", "dmg2"], (field, value) => {
      if (typeof value === "string") try {
        parseFormula(value);
        model[field === "dmg1" ? "damage" : "versatileDamage"] = value;
        return;
      } catch {
      }
      unsupported(out, "weapon", "weapon-damage", field);
    });
    fields(raw, out, ["dmgType"], (field, value) => {
      if (typeof value === "string") {
        const token = ctx.token(value, "damage");
        if (token) {
          model.damageType = token;
          return;
        }
      }
      unsupported(out, "weapon", "damage-type", field);
    });
    fields(raw, out, ["property"], (field, value) => {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) model.properties = value.map(code);
      else unsupported(out, "weapon", "weapon-property-shape", field);
    });
    fields(raw, out, ["baseItem"], (field, value) => {
      const target = typeof value === "string" ? ctx.resolve(value, "item") : void 0;
      if (target && row.edition && target.edition && row.edition !== target.edition) unsupported(out, "equipment", "cross-edition-base-item", field);
      else if (target) model.baseItem = target.identity.key;
      else unsupported(out, "equipment", "unresolved-base-item", field);
    });
    fields(raw, out, ["firearm"], (field, value) => {
      if (typeof value === "boolean") model.firearm = value;
      else unsupported(out, "weapon", "firearm-shape", field);
    });
    fields(raw, out, ["scfType"], (field, value) => {
      if (["holy", "arcane", "druid"].includes(value)) model.spellFocus = value;
      else unsupported(out, "equipment", "focus-shape", field);
    });
    for (const [field, target] of [["bonusWeapon", "attackBonus"], ["bonusWeaponAttack", "attackBonus"], ["bonusWeaponDamage", "damageBonus"], ["bonusSpellAttack", "spellAttackBonus"], ["bonusSpellSaveDc", "spellDcBonus"]]) fields(raw, out, [field], (_, value) => {
      const n = numeric(value);
      if (n !== void 0 && integer(n, -100, 100)) {
        if (field === "bonusWeapon") {
          model.attackBonus = (model.attackBonus || 0) + n;
          model.damageBonus = (model.damageBonus || 0) + n;
        } else model[target] = (model[target] || 0) + n;
      } else unsupported(out, "equipment", "equipment-bonus", field);
    });
    fields(raw, out, ["charges"], (field, value) => {
      const max = amount(value), periods = recovery(raw.recharge);
      out.handled.add("recharge");
      out.handled.add("rechargeAmount");
      if (!max || !periods) {
        unsupported(out, "charges", "charge-definition", field);
        return;
      }
      if (raw.rechargeAmount !== void 0) {
        const rawAmount = typeof raw.rechargeAmount === "string" ? raw.rechargeAmount.replace(/^\{@dice ([^{}]+)\}$/, "$1") : raw.rechargeAmount, n = amount(rawAmount);
        if (!n) unsupported(out, "charges", "charge-recovery-amount", "rechargeAmount");
        else for (const r of periods) r.amount = "value" in n ? n.value : n.formula;
      }
      resource(out, { key: "charges", max, recovery: periods });
    });
    out.mechanics.equipmentModel = model;
  }
  for (const [field, target] of [["bonusAc", "ac"], ["bonusSavingThrow", "save"], ["bonusAbilityCheck", "check"], ["bonusProficiencyBonus", "proficiency"]]) fields(raw, out, [field], (_, value) => {
    const n = numeric(value);
    if (n === void 0 || !integer(n, -100, 100)) {
      unsupported(out, "equipment", "equipment-bonus", field);
      return;
    }
    if (target === "save") for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) modifier(out, { target: `save:${ability}`, op: "add", value: n, ...model.requiresAttunement ? { condition: { target: "attuned", op: "eq", value: true } } : {} });
    else if (target === "check") unsupported(out, "checks", "all-ability-check-bonus", field);
    else modifier(out, { target, op: "add", value: n });
  });
  fields(raw, out, ["grantsProficiency", "grantsLanguage"], (field) => unsupported(out, "equipmentGrant", "equipment-grant-shape", field));
  fields(raw, out, ["startingEquipment"], (field, value) => {
    const blocks = Array.isArray(value) ? value : value?.defaultData;
    if (!Array.isArray(blocks)) {
      if (value) unsupported(out, "startingEquipment", "equipment-package-shape", field);
      return;
    }
    const output = [];
    for (const [i, block] of blocks.entries()) {
      if (!plain(block) || Object.values(block).some((v) => !Array.isArray(v))) {
        unsupported(out, "startingEquipment", "equipment-package-shape", `${field}/${i}`);
        continue;
      }
      const options = [];
      for (const [key, items] of Object.entries(block)) {
        const parts = [];
        for (const item of items) {
          const quantity = typeof item === "string" ? 1 : item?.quantity ?? 1;
          if (!integer(quantity, 1, 3e3)) {
            unsupported(out, "startingEquipment", "equipment-quantity", `${field}/${i}/${key}`);
            continue;
          }
          const ref = typeof item === "string" ? item : item?.item, part = { quantity };
          if (ref) {
            const target = typeof ref === "string" ? ctx.resolve(ref, "item") : void 0;
            if (target) part.identity = target.identity.key;
            else {
              unsupported(out, "startingEquipment", "unresolved-equipment", `${field}/${i}/${key}`);
              part.unresolved = true;
            }
          } else if (item?.equipmentType) {
            if (["weaponSimple", "weaponMartial", "focusSpellcastingHoly", "focusSpellcastingArcane", "focusSpellcastingDruidic"].includes(item.equipmentType)) part.category = item.equipmentType;
            else {
              unsupported(out, "startingEquipment", "equipment-category", `${field}/${i}/${key}`);
              part.unresolved = true;
            }
          } else if (item?.special) {
            unsupported(out, "startingEquipment", "special-equipment", `${field}/${i}/${key}`);
            part.unresolved = true;
          }
          const copper = item?.value ?? item?.containsValue;
          if (copper !== void 0) {
            if (!integer(copper, 0, 1e8)) {
              unsupported(out, "startingEquipment", "equipment-currency", `${field}/${i}/${key}`);
              continue;
            }
            part.copper = copper;
          }
          if (!part.identity && !part.category && part.copper === void 0 && !part.unresolved) {
            unsupported(out, "startingEquipment", "equipment-part-shape", `${field}/${i}/${key}`);
            continue;
          }
          parts.push(part);
        }
        options.push({ key, items: parts });
      }
      if (options.length) output.push({ key: String(i), options });
    }
    out.mechanics.startingEquipment = { blocks: output, scope: row.identity.kind === "class" ? "firstClass" : "all" };
  });
}

// src/derive/structured/spells.ts
var coreEdition = (source) => ["PHB", "DMG"].includes(source) ? "2014" : ["XPHB", "XDMG"].includes(source) ? "2024" : void 0;
function filter(input, source, ctx) {
  const result2 = {};
  for (const part of input.split("|")) {
    const match = /^([a-zA-Z]+)=(.+)$/.exec(part.trim());
    if (!match) return;
    const [, key, value] = match;
    if (key === "level") {
      if (!/^\d$/.test(value)) return;
      result2.level = Number(value);
    } else if (key === "class") {
      const parent = ctx.resolve(`${value}|${source}`, "class") || ctx.resolve(`${value}|PHB`, "class");
      if (!parent) return;
      result2.class = parent.identity.engName;
      result2.classSource = parent.identity.source;
    } else if (key === "school") {
      if (!/^[A-Za-z]+$/.test(value)) return;
      result2.school = value;
    } else if (key === "source") {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) return;
      result2.source = value.toUpperCase();
    } else return;
  }
  return Object.keys(result2).length ? result2 : void 0;
}
function spells(row, ctx, out) {
  const raw = row.raw;
  if (row.identity.kind === "spell") {
    fields(raw, out, ["level"], (field, value) => {
      if (integer(value, 0, 9)) out.mechanics.spellModel = { level: value };
      else unsupported(out, "spellMetadata", "spell-level", field);
    });
    if (out.mechanics.spellModel) {
      fields(raw, out, ["school"], (field, value) => {
        if (typeof value === "string" && /^[A-Za-z]+$/.test(value)) out.mechanics.spellModel.school = value;
        else unsupported(out, "spellMetadata", "spell-school", field);
      });
      if (raw.meta?.ritual === true) out.mechanics.spellModel.ritual = true;
      if (Array.isArray(raw.duration) && raw.duration.some((d) => d?.concentration)) out.mechanics.spellModel.concentration = true;
      const lists = [];
      const add = (name, source) => {
        const english = ctx.className(name, source);
        if (!english) {
          unsupported(out, "spellMetadata", "unresolved-spell-class", "classes");
          return;
        }
        if (!lists.some((c) => c.engName === english && c.source === source)) lists.push({ engName: english, source });
      };
      for (const list of [...raw.classes?.fromClassList || [], ...raw.classes?.fromClassListVariant || []]) if (list?.name) add(list.name, list.source || "PHB");
      for (const [source, names] of Object.entries(raw._spellClasses || {})) if (plain(names)) for (const name of Object.keys(names)) add(name, source);
      if (lists.length) out.mechanics.spellModel.classes = lists.sort((a, b) => `${a.source}/${a.engName}`.localeCompare(`${b.source}/${b.engName}`));
      out.handled.add("classes");
      out.handled.add("_spellClasses");
      out.handled.add("meta");
    }
    fields(raw, out, ["time", "range", "components", "duration"], (field) => unsupported(out, field === "duration" ? "spellDuration" : "spellCastingMetadata", "casting-metadata-pending", field));
  }
  fields(raw, out, ["additionalSpells"], (field, value) => {
    if (!Array.isArray(value)) {
      unsupported(out, "additionalSpells", "additional-spells-shape", field);
      return;
    }
    for (const [index, block] of value.entries()) {
      if (!plain(block) || Object.keys(block).some((key) => !["name", "ENG_name", "ability", "known", "prepared", "innate", "expanded", "resourceName"].includes(key))) {
        unsupported(out, "additionalSpells", "spell-set-shape", `${field}/${index}`);
        continue;
      }
      let ability;
      if (ABILITIES.includes(block.ability)) ability = block.ability;
      else if (plain(block.ability) && Array.isArray(block.ability.choose) && block.ability.choose.length && block.ability.choose.every((v) => ABILITIES.includes(v))) ability = { choose: [...block.ability.choose] };
      else if (block.ability !== void 0) unsupported(out, "additionalSpells", "spell-ability", `${field}/${index}`);
      const set = value.length > 1 ? { setKey: "additionalSpells", setOption: index } : {};
      for (const kind of ["known", "prepared", "innate", "expanded"]) {
        const levels = block[kind];
        if (levels === void 0) continue;
        if (!plain(levels)) {
          unsupported(out, "additionalSpells", "spell-gates", `${field}/${index}/${kind}`);
          continue;
        }
        for (const [gate, lists] of Object.entries(levels)) {
          const gating = gate === "_" ? { atLevel: 0 } : /^\d+$/.test(gate) && integer(Number(gate), 0, 20) ? { atLevel: Number(gate) } : /^s[0-9]$/.test(gate) ? { atSpellLevel: Number(gate.slice(1)) } : void 0;
          if (!gating) {
            unsupported(out, "additionalSpells", "spell-gate", `${field}/${index}/${kind}`);
            continue;
          }
          const add = (list, path, usage, count, period) => {
            if (!Array.isArray(list)) {
              unsupported(out, "additionalSpells", "spell-list", `${field}/${index}/${kind}/${gate}/${path}`);
              return;
            }
            const pool = `source-spell:${index}/${kind}/${gate}/${path}`;
            const ambiguous = !!count && !count.endsWith("e") && list.reduce((sum, node) => sum + (typeof node === "string" ? 1 : node?.count ?? node?.choose?.count ?? 1), 0) > 1;
            if (ambiguous) unsupported(out, "additionalSpells", "spell-usage-pool-ambiguous", pool);
            for (const [nodeIndex, node] of list.entries()) {
              let selection, spellLevel;
              const referenceAliases = {};
              const ref = (value2) => {
                const [uid, level] = value2.split("#"), target = ctx.resolve(uid, "spell", uid.includes("|") ? void 0 : "PHB");
                if (level && !/^(c|[1-9])$/.test(level) || level === "c" && target?.raw.level !== 0) return;
                const edition = row.edition || coreEdition(row.identity.source), targetEdition = target?.edition || coreEdition(target?.identity.source || "");
                if (target && edition && edition !== "both" && targetEdition && targetEdition !== "both" && edition !== targetEdition) return;
                if (level && level !== "c") spellLevel = Number(level);
                if (target) referenceAliases[target.identity.key] = encodeURIComponent(value2);
                return target?.identity.key;
              };
              if (typeof node === "string") {
                const key = ref(node);
                if (key) selection = { fixed: [key] };
              } else if (plain(node) && node.choose) {
                const choose = node.choose, count2 = node.count ?? (plain(choose) ? choose.count : void 0) ?? 1;
                if (integer(count2, 1, 100)) {
                  if (typeof choose === "string") {
                    const book = (row.edition || coreEdition(row.identity.source)) === "2024" ? "XPHB" : "PHB", parsed = filter(choose, book, ctx);
                    if (parsed) {
                      const options = ctx.rows.filter((candidate) => candidate.identity.kind === "spell" && (!row.edition || !candidate.edition || candidate.edition === row.edition) && (parsed.level === void 0 || candidate.raw.level === parsed.level) && (!parsed.source || candidate.identity.source === parsed.source) && (!parsed.school || candidate.raw.school === parsed.school) && (!parsed.class || Object.keys(candidate.raw._spellClasses?.[String(parsed.classSource)] || {}).some((name) => ctx.className(name, String(parsed.classSource)) === parsed.class) || candidate.raw.classes?.fromClassList?.some((c) => ctx.className(c.name, c.source || "PHB") === parsed.class && (c.source || "PHB") === parsed.classSource)));
                      if (options.length >= count2) selection = { choose: { count: count2, filter: parsed } };
                      else unsupported(out, "additionalSpells", "unresolved-spell-filter", pool);
                    }
                  } else if (plain(choose) && Array.isArray(choose.from)) {
                    const from = choose.from.map((uid) => typeof uid === "string" ? ref(uid) : void 0);
                    if (from.length && from.every(Boolean)) selection = { choose: { count: count2, from } };
                  }
                }
              }
              if (!selection) {
                unsupported(out, "additionalSpells", "unresolved-spell-choice", `${pool}/${nodeIndex}`);
                continue;
              }
              const max = count ? count.replace(/e$/, "") === "pb" ? { formula: "@prof" } : amount(count.replace(/e$/, "")) : void 0;
              if (count && (!max || !period)) {
                unsupported(out, "additionalSpells", "spell-frequency", pool);
                continue;
              }
              grant(out, { type: "spell", ...selection, ...Object.keys(referenceAliases).length ? { referenceAliases } : {}, key: `${pool}/${nodeIndex}`, origin: kind, ...set, ...gating, usage: kind === "expanded" ? "expanded" : usage, canUseSlots: kind === "known" || kind === "prepared", ...ability ? { ability, abilityChoiceKey: `additionalSpells:${index}:ability` } : {}, ...spellLevel ? { spellLevel } : {}, ...max && period ? { uses: { max, recovery: [{ period, amount: "all" }] }, usagePool: pool } : {}, ...ambiguous ? { ambiguous: true } : {} });
            }
          };
          const baseUsage = kind === "known" || kind === "prepared" ? "slotOrUses" : kind === "expanded" ? "expanded" : "uses";
          if (Array.isArray(lists)) {
            add(lists, "_", baseUsage);
            continue;
          }
          if (!plain(lists)) {
            unsupported(out, "additionalSpells", "spell-schedule", `${field}/${index}/${kind}/${gate}`);
            continue;
          }
          for (const [schedule, values] of Object.entries(lists)) {
            if (["_", "will", "ritual"].includes(schedule)) {
              add(values, schedule, schedule === "will" ? "free" : schedule === "ritual" ? "ritual" : baseUsage);
              continue;
            }
            if (["daily", "rest"].includes(schedule) && plain(values)) for (const [count, list] of Object.entries(values)) {
              if (/^(?:[1-9]\d?e?|pbe?)$/.test(count)) add(list, `${schedule}/${count}`, "uses", count, schedule === "daily" ? "long" : "short");
              else unsupported(out, "additionalSpells", "spell-frequency", `${field}/${index}/${kind}/${gate}/${schedule}`);
            }
            else unsupported(out, "additionalSpells", "spell-schedule", `${field}/${index}/${kind}/${gate}/${schedule}`);
          }
        }
      }
    }
  });
}

// src/derive/structured/choices.ts
function choices(row, ctx, out) {
  const walk = (value, path, depth = 0) => {
    if (depth > 12) {
      unsupported(out, "inlineChoice", "choice-depth-limit", path);
      return;
    }
    if (!Array.isArray(value)) return;
    value.forEach((node, index) => {
      if (!plain(node)) return;
      const here = `${path}:${index}`;
      if (node.type === "options") {
        const count = node.count === void 0 ? 1 : node.count;
        if (!integer(count, 1, 100) || !Array.isArray(node.entries)) {
          unsupported(out, "inlineChoice", "inline-choice-shape", here);
          return;
        }
        const targets = node.entries.map((part) => {
          const ref = part?.classFeature || part?.subclassFeature || part?.optionalfeature, target = typeof ref === "string" ? ctx.resolve(ref, "feature", ref.includes("|") ? void 0 : row.identity.source) : void 0;
          return target && (!row.edition || !target.edition || row.edition === target.edition) ? target.identity.key : void 0;
        });
        if (targets.length < count || targets.some((target) => !target) || new Set(targets).size !== targets.length) {
          unsupported(out, "inlineChoice", "unresolved-inline-choice", here);
          return;
        }
        grant(out, { type: "feature", choose: { count, from: targets }, key: `text-option:${here}` });
        return;
      }
      if (node.entries) walk(node.entries, here, depth + 1);
      if (node.items) walk(node.items, `${here}:items`, depth + 1);
    });
  };
  walk(row.raw.entries, "entries");
}

// src/fetch/manifest.ts
var CORE_KINDS = ["class", "subclass", "classFeature", "subclassFeature", "race", "subrace", "background", "feat", "optionalfeature", "spell", "item", "baseitem", "magicvariant"];
var EXTRA_KINDS = ["charoption", "reward", "psionic", "boon", "condition", "disease", "action", "sense", "skill", "language", "itemMastery", "itemProperty", "itemType", "itemGroup", "variantrule"];
var KINDS = [...CORE_KINDS, ...EXTRA_KINDS];
var STRUCTURED_FIELDS = ["ability", "skillProficiencies", "toolProficiencies", "languageProficiencies", "weaponProficiencies", "armorProficiencies", "savingThrowProficiencies", "skillToolLanguageProficiencies", "expertise", "resist", "immune", "conditionImmune", "vulnerable", "speed", "size", "darkvision", "senses", "additionalSpells", "resources", "resource", "uses", "consumes", "cantripBonus", "optionalfeatureProgression", "feats", "hd", "proficiency", "startingProficiencies", "multiclassing", "casterProgression", "cantripProgression", "cantripChange", "preparedSpells", "preparedSpellsProgression", "preparedSpellsChange", "spellsKnownProgression", "spellsKnownProgressionFixed", "classTableGroups", "subclassTableGroups", "spellcastingAbility", "startingEquipment", "ac", "bonusAc", "strength", "stealth", "dmg1", "dmg2", "dmgType", "property", "weaponCategory", "bonusWeapon", "bonusWeaponAttack", "bonusWeaponDamage", "bonusSpellAttack", "bonusSpellSaveDc", "bonusSavingThrow", "bonusAbilityCheck", "bonusProficiencyBonus", "reqAttune", "charges", "recharge", "rechargeAmount", "modifySpeed", "grantsProficiency", "grantsLanguage", "level", "school", "time", "range", "components", "duration", "scfType", "mastery", "weight", "value"];

// src/derive/structured/index.ts
function deriveStructured(row, ctx) {
  const out = result(), raw = row.raw;
  if (["classFeature", "subclassFeature", "optionalfeature"].includes(row.identity.kind) && row.identity.level !== void 0) out.handled.add("level");
  abilities(raw, out);
  proficiencies(raw, ctx, out);
  traits(raw, ctx, out);
  resources(raw, out);
  classes(row, ctx, out);
  equipment(row, ctx, out);
  spells(row, ctx, out);
  choices(row, ctx, out);
  for (const field of STRUCTURED_FIELDS) if (Object.hasOwn(raw, field) && !out.handled.has(field)) unsupported(out, "structuredField", "unmapped-field", field);
  for (const [field, family, code2] of [["script", "scripts", "script-execution-deferred"], ["_custom", "customRule", "custom-rule-conversion-required"], ["_workbenchCustom", "customRule", "custom-rule-conversion-required"], ["attackBonus", "manualWeapon", "manual-weapon-data"], ["items", "equipmentBundle", "equipment-bundle-pending"]]) if (Object.hasOwn(raw, field)) {
    out.handled.add(field);
    unsupported(out, family, code2, field);
  }
  if (raw._copy) unsupported(out, "inheritance", "unresolved-copy");
  if (raw._unresolvedParent || raw._unresolvedVariant) unsupported(out, "inheritance", "unresolved-parent");
  const sanitize = (value, path) => {
    if (typeof value === "string" && containsCjk(value)) {
      unsupported(out, "normalization", "unresolved-token", path);
      return void 0;
    }
    if (Array.isArray(value)) return value.map((part, i) => sanitize(part, `${path}/${i}`)).filter((part) => part !== void 0);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).flatMap(([key, part]) => {
      if (["formula", "preparedFormula"].includes(key) && typeof part === "string") try {
        parseFormula(part);
      } catch {
        unsupported(out, "formula", "unmapped-formula", path);
        return [];
      }
      const next = sanitize(part, `${path}/${key}`);
      return next === void 0 ? [] : [[key, next]];
    }));
    return value;
  };
  out.mechanics = sanitize(out.mechanics, "mechanics");
  return out;
}
export {
  deriveStructured,
  makeContext
};
