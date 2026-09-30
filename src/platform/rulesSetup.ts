export const RULES_SETUP_KEY='dnd-card:rules-setup:v1';
export function rulesSetupComplete(){try{return localStorage.getItem(RULES_SETUP_KEY)==='done';}catch{return false;}}
export function rememberRulesSetup(){try{localStorage.setItem(RULES_SETUP_KEY,'done');}catch{/* The current session can still finish setup. */}}
