export const automationDevelopment=import.meta.env.MODE==='automation-standalone';
export const standalone=import.meta.env.MODE==='standalone'||import.meta.env.MODE==='cloud-library'||automationDevelopment;
