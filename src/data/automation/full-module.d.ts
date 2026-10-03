// The query gives the full-data validator its own lazy build entry while both
// entries use the same hash-locked source file and explicit public signatures.
declare module '*identity.ts?full' {
  export const automationErrors: typeof import('./identity').automationErrors;
  export const overlayErrors: typeof import('./identity').overlayErrors;
  export const schemaErrors: typeof import('./identity').schemaErrors;
  export const recordErrors: typeof import('./identity').recordErrors;
  export const snapshotRecordErrors: typeof import('./identity').snapshotRecordErrors;
  export const recordEdition: typeof import('./identity').recordEdition;
  export const validateAutomation: typeof import('./identity').validateAutomation;
  export const validateOverlay: typeof import('./identity').validateOverlay;
  export const publicArtifact: typeof import('./identity').publicArtifact;
}
