import {defineConfig} from '@playwright/test';
import {randomUUID} from 'node:crypto';
// Shared by the runner and its workers; safe receipts never reuse old-run pixels.
process.env.REVIEWED_LINGUIST_ARTIFACT_RUN||=randomUUID();
process.env.REVIEWED_OBSERVANT_ARTIFACT_RUN||=randomUUID();
process.env.REVIEWED_ALERT_ARTIFACT_RUN||=randomUUID();
process.env.ORDINARY_CASTING_ARTIFACT_RUN||=randomUUID();
process.env.RESOURCE_LEDGER_ARTIFACT_RUN||=randomUUID();
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['catalogWorkerFixture.spec.ts','resourceLedgerControls.spec.ts','ordinaryCasting.spec.ts','alertControls.spec.ts','observantControls.spec.ts','linguistControls.spec.ts','skilledControls.spec.ts','weaponMasterControls.spec.ts','armorFeatControls.spec.ts','attunedInfusionControls.spec.ts','infusionControls.spec.ts','enhancedWeaponControls.spec.ts','returningWeaponControls.spec.ts','arcaneFocusControls.spec.ts','invocationControls.spec.ts','invocationLevel9.spec.ts','invocationDualPayment.spec.ts','invocationAtwillFinal.spec.ts','invocationSkillGuard.spec.ts','infusionCharges.spec.ts','radiantRefueling.spec.ts','reviewedPassiveFeatControls.spec.ts'],outputDir:'.local-evidence/infusion-browser',timeout:45000,expect:{timeout:10000},workers:1,retries:0,reporter:[['list'],['./tests/e2e/reviewedLinguistPrivacyReporter.ts'],['./tests/e2e/reviewedObservantPrivacyReporter.ts'],['./tests/e2e/reviewedAlertPrivacyReporter.ts'],['./tests/e2e/ordinaryCastingPrivacyReporter.ts'],['./tests/e2e/resourceLedgerPrivacyReporter.ts'],['./tests/e2e/rulesIntegrationPrivacyReporter.ts']],
 use:{baseURL:'http://127.0.0.1:5562',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:undefined,trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1512,height:982}}},{name:'narrow',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'"'+process.execPath+'" node_modules/vite/bin/vite.js --config vite.standalone-cloud.config.ts --mode standalone --host 127.0.0.1 --port 5562 --strictPort',url:'http://127.0.0.1:5562/card/',reuseExistingServer:false},
});
