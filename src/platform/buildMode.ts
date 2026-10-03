const mode=import.meta.env?.MODE;
export const automationDevelopment=mode==='automation-standalone';
export const standalone=mode==='standalone'||automationDevelopment;
