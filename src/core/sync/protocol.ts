import type {Character} from '../model';
/** Wire contract of the Go backend (docs/protocol, openapi.yaml). Pure types only. */
export interface CharacterSnapshot {
  id: string; ownerId: string; system: 'dnd5e'; schemaVersion: 1;
  revision: number; document: Character; createdAt: string; updatedAt: string;
}
export interface CharacterMeta { id: string; ownerId: string; system: 'dnd5e'; schemaVersion: 1; revision: number; createdAt: string; updatedAt: string }
export type Operation =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'unset'; path: string }
  | { op: 'inc'; path: string; value: number }
  | { op: 'entity.upsert'; path: string; entityId: string; value: Record<string, unknown> }
  | { op: 'entity.delete'; path: string; entityId: string }
  | { op: 'order.move'; path: string; entityId: string; beforeId?: string | null };
export interface OperationBatch { operationId: string; clientId: string; baseRevision: number; operations: Operation[] }
export interface OperationResult extends OperationBatch {
  characterId: string; revision: number; origin: string; touchedPaths: string[]; updatedAt: string; rebased: boolean;
}
export interface Conflict { path: string; serverValue?: unknown; serverExists: boolean; clientValue?: unknown }
export type ErrorCode = 'validation_error' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'revision_conflict' | 'schema_mismatch' | 'resync_required' | 'duplicate_operation'
  | 'invalid_operation' | 'invalid_path' | 'payload_too_large' | 'rate_limited' | 'internal_error';
export interface ApiError { code: ErrorCode; message: string; currentRevision?: number; baseRevision?: number; conflicts?: Conflict[] }
export type WebSocketMessage =
  | ({ type: 'character.operations' } & OperationResult)
  | { type: 'subscribed'; characterId: string; revision: number }
  | { type: 'unsubscribed'; characterId: string }
  | ({ type: 'error' | 'resync_required'; characterId?: string } & ApiError)
  | { type: 'pong' };
export interface Account { id: string; name: string }
/** Registered identity-bearing arrays; every other array is an atomic leaf. */
export const ENTITY_COLLECTIONS = ['selections', 'quickbarCopies', 'quickbarActions', 'adjustments', 'rulePacks'] as const;
export const RESOURCE_COLLECTION = '/runtime/resources';
/** Server-managed or immutable document metadata, never addressed by operations. */
export const PROTECTED_ROOTS = ['id', 'schemaVersion', 'revision', 'createdAt', 'updatedAt'] as const;
/** Root fields addressable by operations (the properties of backend/schemas/character/v1.json). */
export const DOCUMENT_ROOTS = ['name', 'player', 'edition', 'abilities', 'baseHp', 'identity', 'biography', 'portrait', 'illustration', 'palette',
  'selections', 'answers', 'reviewed', 'notes', 'profile', 'runtime', 'inventory', 'spellSettings', 'backgroundChoices', 'hpProgression', 'rulePacks',
  'quickbar', 'quickbarCopies', 'quickbarActions', 'quickbarLayout', 'proficiencies', 'expertise', 'jackOfAllTrades', 'training', 'size', 'sheetBonuses',
  'skillBonuses', 'dismissedFeatures', 'featureLayout', 'adjustments', 'externalSnapshot', 'locked', 'automation'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const plain = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Validate an inbound result before it can touch confirmed state. */
export function isOperationResult(value: unknown): value is OperationResult {
  return plain(value) && typeof value.characterId === 'string' && Number.isSafeInteger(value.revision) && value.revision >= 1
    && Number.isSafeInteger(value.baseRevision) && typeof value.operationId === 'string' && typeof value.clientId === 'string'
    && Array.isArray(value.operations) && Array.isArray(value.touchedPaths) && typeof value.updatedAt === 'string' && typeof value.origin === 'string';
}
export function isSnapshot(value: unknown): value is CharacterSnapshot {
  return plain(value) && typeof value.id === 'string' && Number.isSafeInteger(value.revision) && value.revision >= 1 && plain(value.document) && value.schemaVersion === 1;
}
export function isApiError(value: unknown): value is ApiError { return plain(value) && typeof value.code === 'string'; }
