/// <reference path="./full-module.d.ts" />
// Explicit file checks also need the types for this lazy build entry.
export {automationErrors,overlayErrors,schemaErrors,recordErrors,snapshotRecordErrors,recordEdition,validateAutomation,validateOverlay,publicArtifact} from './identity.ts?full';
export type {ValidationIssue} from './identity';
