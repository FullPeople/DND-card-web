export const standalone=import.meta.env.MODE==='standalone';
// Opt in only for the domestic website; regular standalone and Suite keep their chrome.
export const domesticCompact=standalone&&import.meta.env.VITE_DOMESTIC_COMPACT==='true';
